import fs from 'node:fs';
import path from 'node:path';
import {decode} from '@jridgewell/sourcemap-codec';
const build=process.env.PROFILE_BUILD??'/tmp/gedi-profile-9b1a147';
const maps=new Map();
function source(frame){
 try{
  const file=path.join(build,new URL(frame.url).pathname),key=file+'.map';
  if(!maps.has(key)){const m=JSON.parse(fs.readFileSync(key,'utf8'));maps.set(key,{...m,decoded:decode(m.mappings)});}
  const map=maps.get(key),line=map.decoded[frame.lineNumber]??[];let at=null;
  for(const segment of line){if(segment[0]>frame.columnNumber)break;if(segment.length>=4)at=segment;}
  if(at)return `${map.sources[at[1]]}:${at[2]+1} ${map.names[at[4]]??frame.functionName}`;
 }catch{}
 return `${frame.url||'(runtime)'}:${frame.lineNumber+1} ${frame.functionName}`;
}
export function summarize(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map();
 for(const n of profile.nodes)for(const c of n.children??[])parent.set(c,n.id);
 const self=new Map(),inclusive=new Map();let elapsed=0;
 for(let i=0;i<(profile.samples?.length??0);i++){
  const dt=profile.timeDeltas[i]??0,id=profile.samples[i];elapsed+=dt;self.set(id,(self.get(id)??0)+dt);
  for(let p=id;p;p=parent.get(p))inclusive.set(p,(inclusive.get(p)??0)+dt);
 }
 const top=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,us])=>({source:source(nodes.get(id).callFrame),ms:us/1000,percent:100*us/elapsed,caller:parent.has(id)?source(nodes.get(parent.get(id)).callFrame):null}));
 return{sampledElapsedMs:elapsed/1000,samples:profile.samples.length,self:top(self),inclusive:top(inclusive)};
}
export function cpuDelta(before,after,frames){
 const start=new Map(before.processInfo.map(p=>[p.id,p]));
 return after.processInfo.filter(p=>start.has(p.id)).map(p=>({type:p.type,pid:p.id,cpuMs:1000*(p.cpuTime-start.get(p.id).cpuTime),cpuMsPerFrame:1000*(p.cpuTime-start.get(p.id).cpuTime)/frames}));
}
export function geometryInventory(){
 const scene=window.__pfs.scene(),allBuffers=new Set(),depthBuffers=new Set(),geometries=new Set(),depthGeometries=new Set();
 const add=(geometry,set)=>{for(const vertex of Object.values(geometry.getVertexBuffers()??{})){const buffer=vertex.getBuffer();if(buffer)set.add(buffer);}const index=geometry.getIndexBuffer();if(index)set.add(index);};
 for(const mesh of scene.meshes){const g=mesh.geometry;if(!g)continue;geometries.add(g);add(g,allBuffers);if(mesh.metadata?.shadowDepthOnly){depthGeometries.add(g);add(g,depthBuffers);}}
 const bytes=set=>[...set].reduce((n,b)=>n+b.capacity,0);
 return{uniqueGeometries:geometries.size,gpuBufferBytes:bytes(allBuffers),depthGeometries:depthGeometries.size,depthGpuBufferBytes:bytes(depthBuffers),depthVertices:[...depthGeometries].reduce((n,g)=>n+g.getTotalVertices(),0),evaluatedVerticesCounter:scene.getTotalVertices(),note:'GPU buffer allocation capacities, deduplicated by actual DataBuffer; not total VRAM or texture/driver memory.'};
}
export async function instrumentSystems(cdp,page){
 // Inspect the existing probe closure using CDP; no production debug API or
 // application code is added. All wrappers live in this disposable page.
 await cdp.send('Debugger.enable');const f=await cdp.send('Runtime.evaluate',{expression:'window.__pfs.tick'});
 const b=await cdp.send('Debugger.setBreakpointOnFunctionCall',{objectId:f.result.objectId});
 const paused=new Promise((resolve,reject)=>cdp.once('Debugger.paused',async e=>{try{
  const r=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:e.callFrames[0].callFrameId,expression:'window.__costGame=this; Boolean(this.world&&this.crowd&&this.physics)',returnByValue:true});
  if(!r.result.value)throw Error('Game profile handle unavailable');resolve();
 }catch(error){reject(error);}finally{await cdp.send('Debugger.removeBreakpoint',{breakpointId:b.breakpointId});await cdp.send('Debugger.resume');}}));
 await Promise.all([paused,cdp.send('Runtime.evaluate',{expression:'window.__pfs.tick(0)'})]);await cdp.send('Debugger.disable');
 await page.evaluate(()=>{
  const g=window.__costGame,spans=window.__costSpans=new Map(),stack=[],seen=new WeakMap();
  const wrap=(object,key,label,after)=>{
   if(!object||typeof object[key]!=='function')return;let keys=seen.get(object);if(!keys){keys=new Set();seen.set(object,keys);}if(keys.has(key))return;keys.add(key);
   const original=object[key];object[key]=function(...args){const item={child:0},start=performance.now(),parent=stack.at(-1);stack.push(item);try{const result=original.apply(this,args);after?.(result);return result;}finally{const total=performance.now()-start;stack.pop();if(parent)parent.child+=total;const r=spans.get(label)??{calls:0,total:0,self:0};r.calls++;r.total+=total;r.self+=total-item.child;spans.set(label,r);}};
  };
  for(const key of ['playingFrame','step','updateFolk','pickInteraction','gatherInteractions','updateHud','updateBubbles','updateWeather','outerAnchors'])wrap(g,key,'game.'+key);
  for(const [object,prefix,methods]of [[g.world,'world',['update','followShadows','syncVisibilityAt','updateOuterRegions']],[g.physics,'physics',['step','raycast']],[g.crowd,'crowd',['fixedUpdate','update','updateKit','spawn']],[g.traffic,'traffic',['fixedUpdate','update','spawnOne','seatDriver','clearAhead']],[g.audio,'audio',['update']],[g.buses,'buses',['fixedUpdate','update']],[g.animals,'animals',['fixedUpdate','update']]])for(const key of methods)wrap(object,key,prefix+'.'+key);
  const surface=v=>{if(v)wrap(v,'surface','vehicle.surface');};for(const v of g.vehicles)surface(v);wrap(g,'spawnVehicle','vehicle.spawn',surface);
  wrap(Object.getPrototypeOf(g.vehicles[0]),'fixedUpdate','vehicle.fixedUpdate');
  for(const r of g.crowd.residents){wrap(Object.getPrototypeOf(r.anim),'update','legacyHuman.animate');if(r.kit)wrap(Object.getPrototypeOf(r.kit.a),'update','kitHuman.animate');}
  if(g.scene.skeletons[0])wrap(Object.getPrototypeOf(g.scene.skeletons[0]),'prepare','skinning.prepare');
 });
}
