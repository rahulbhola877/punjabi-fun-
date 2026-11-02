import fs from 'node:fs';
import {chromium} from 'playwright';
import {browserOptions} from './browser.mjs';

// Count-only diagnostic. Does not edit the guard, presets, source or visibility.
// Launch only with an exclusive browser slot, under an outer timeout.
const targets=JSON.parse(process.env.TARGETS??JSON.stringify([
  {source:'b4c9aa50',base:'http://127.0.0.1:4194/',boundsAwareLOD:false},
  {source:'f3fada9',base:'http://127.0.0.1:4174/',boundsAwareLOD:true},
  {source:'19843e1',base:'http://127.0.0.1:4193/',boundsAwareLOD:true},
]));
const views={bazaar:'-12,2,-44,-2,1.5,-44',colony:'45,4,-20,62,1.5,-36',street:'0,1.8,-110,0,1.6,-20'};
const selected=process.env.VIEWS?.split(',')??Object.keys(views);
const out=process.env.OUT??'artifacts/low-budget-diagnosis';fs.mkdirSync(out,{recursive:true});
const result={complete:false,targets,settings:{quality:'low',post:false,shadows:'off',renderScale:.7},viewport:[960,540],
  note:'Same three historical guard cameras/settings. Four-second title warmup; then freeze simulation and attribute one real rendered frame. Actual triangle/draw counts, not FPS. No render or visibility suppression.',rows:[],comparisons:[],errors:[]};
let browser;
const save=()=>fs.writeFileSync(`${out}/checks.json`,JSON.stringify(result,null,2));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{result.interrupted=signal;save();await browser?.close();process.exit(124);});

function compare(a,b){
  const delta=(left,right,key)=>{
    const aa=new Map(left.map(r=>[r[key],r])),bb=new Map(right.map(r=>[r[key],r]));
    return [...new Set([...aa.keys(),...bb.keys()])].map(name=>({name,
      triangles:(bb.get(name)?.triangles??0)-(aa.get(name)?.triangles??0),
      draws:(bb.get(name)?.draws??0)-(aa.get(name)?.draws??0),before:aa.get(name)??null,after:bb.get(name)??null,
    })).filter(r=>r.triangles||r.draws).sort((a,b)=>Math.abs(b.triangles)-Math.abs(a.triangles));
  };
  return{view:a.view,from:a.source,to:b.source,
    triangles:b.attributed.triangles-a.attributed.triangles,draws:b.attributed.draws-a.attributed.draws,
    groups:delta(a.attributed.groups,b.attributed.groups,'name'),meshes:delta(a.attributed.meshes,b.attributed.meshes,'name')};
}

try{
  browser=await chromium.launch(browserOptions());
  for(const target of targets)for(const view of selected){
    console.log(new Date().toISOString(),'start',target.source,view);save();
    const page=await browser.newPage({viewport:{width:960,height:540}});
    try{
      await page.addInitScript(settings=>localStorage.setItem('pfs.settings.v1',JSON.stringify(settings)),result.settings);
      page.on('pageerror',error=>result.errors.push({source:target.source,view,error:String(error)}));
      await page.goto(`${target.base}?probe&view=${views[view]}`,{waitUntil:'load',timeout:90000});
      await page.waitForFunction(()=>window.__pfs?.snapshot()?.state==='title',null,{timeout:90000});
      await page.waitForTimeout(4000);
      const row=await page.evaluate(({source,view,boundsAwareLOD})=>{
        const probe=window.__pfs,scene=probe.scene(),engine=scene.getEngine(),camera=scene.activeCamera;
        const snapshot=probe.snapshot();
        const guard={triangles:scene.getActiveIndices()/3,draws:snapshot.drawCalls,vertices:snapshot.totalVertices};
        probe.captureHold(true);
        const draws=[],restores=[];let context=null;
        for(const mesh of scene.meshes){
          if(typeof mesh._draw!=='function')continue;
          const original=mesh._draw;
          mesh._draw=function(subMesh,...args){const before=context;context={mesh,subMesh};try{return original.call(this,subMesh,...args);}finally{context=before;}};
          restores.push(()=>{mesh._draw=original;});
        }
        for(const method of ['drawElementsType','drawArraysType']){
          const original=engine[method];
          engine[method]=function(fillMode,start,count,instances,...args){
            const mesh=context?.mesh,subMesh=context?.subMesh,material=subMesh?.getMaterial();
            draws.push({id:mesh?.uniqueId??-1,name:mesh?.name??'(unattributed)',material:material?.name??null,
              subMesh:subMesh?._id??null,fillMode,indices:count,instances:instances??1,
              triangles:fillMode===0?count*(instances??1)/3:0});
            return original.call(this,fillMode,start,count,instances,...args);
          };
          restores.push(()=>{engine[method]=original;});
        }
        try{engine.beginFrame();scene.render();engine.endFrame();engine._gl?.finish();}finally{for(const restore of restores.reverse())restore();}
        const groups=new Map(),meshes=new Map();
        const detail=mesh=>{
          const sphere=mesh?.getBoundingInfo?.().boundingSphere,box=mesh?.getBoundingInfo?.().boundingBox;
          const level=mesh?.getLODLevels?.().find(level=>level.mesh===null),distance=level?.distanceOrScreenCoverage??null;
          const centerDistance=sphere?sphere.centerWorld.subtract(camera.globalPosition).length():null;
          const oldDistance=distance===null?null:distance-(boundsAwareLOD&&mesh.name.startsWith('world_')?sphere.radiusWorld:0);
          return{material:mesh?.material?.name??null,vertices:mesh?.getTotalVertices?.()??0,indices:mesh?.getTotalIndices?.()??0,
            enabled:mesh?.isEnabled(),skeleton:!!mesh?.skeleton,center:sphere?.centerWorld.asArray(),radius:sphere?.radiusWorld,
            min:box?.minimumWorld.asArray(),max:box?.maximumWorld.asArray(),centerDistance,lodDistance:distance,oldDistance,
            oldCenterWouldCull:oldDistance!==null&&centerDistance>oldDistance,
            metadata:mesh?.metadata?{authoredCullDistance:mesh.metadata.authoredCullDistance,detailCull:mesh.metadata.detailCull,shadowDepthOnly:mesh.metadata.shadowDepthOnly}:null};
        };
        for(const call of draws){
          const name=call.name.replace(/[_\-:.]?\d+.*$/,'').slice(0,28),group=groups.get(name)??{name,triangles:0,draws:0};
          group.triangles+=call.triangles;group.draws++;groups.set(name,group);
          const mesh=scene.getMeshByUniqueId(call.id),item=meshes.get(call.name)??{name:call.name,triangles:0,draws:0,...detail(mesh)};
          item.triangles+=call.triangles;item.draws++;meshes.set(call.name,item);
        }
        const uniqueGeometry=new Set(scene.meshes.map(mesh=>mesh.geometry).filter(Boolean));
        return{source,view,guard,attributed:{triangles:draws.reduce((sum,call)=>sum+call.triangles,0),draws:draws.length,
          groups:[...groups.values()].sort((a,b)=>b.triangles-a.triangles),meshes:[...meshes.values()].sort((a,b)=>b.triangles-a.triangles),calls:draws},
          boundsOnly:[...meshes.values()].filter(mesh=>mesh.name.startsWith('world_')&&mesh.oldCenterWouldCull),
          uniqueGeometryVertices:[...uniqueGeometry].reduce((sum,geometry)=>sum+geometry.getTotalVertices(),0),
          resolution:[engine.getRenderWidth(),engine.getRenderHeight()],camera:camera.position.asArray(),target:camera.getTarget().asArray(),
          renderer:engine.getInfo(),errors:snapshot.errors};
      },{source:target.source,view,boundsAwareLOD:target.boundsAwareLOD});
      result.rows.push(row);save();
      console.log(new Date().toISOString(),'captured',target.source,view,JSON.stringify({guard:row.guard,attributed:{triangles:row.attributed.triangles,draws:row.attributed.draws},boundsOnly:row.boundsOnly.map(m=>({name:m.name,triangles:m.triangles,draws:m.draws}))}));
    }finally{await page.close();}
  }
  for(const view of selected){
    const rows=result.rows.filter(row=>row.view===view);
    for(let i=1;i<rows.length;i++)result.comparisons.push(compare(rows[i-1],rows[i]));
  }
  result.complete=true;save();console.log('complete',result.rows.length,'rows');
}catch(error){result.error=String(error.stack??error);save();console.error(error);process.exitCode=1;}
finally{await browser?.close();save();}
