import { afterEach, expect, it, vi } from "vitest";
import { Input } from "../src/input/Input";

afterEach(()=>vi.unstubAllGlobals());
it("restores keyboard remaps in the next input owner and clears controller drift on transfer",()=>{
  const storage=new Map<string,string>();
  vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)});
  vi.stubGlobal("window",new EventTarget());vi.stubGlobal("document",new EventTarget());
  const buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[2]!.pressed=true;
  vi.stubGlobal("navigator",{getGamepads:()=>[{connected:true,buttons,axes:[0.9,-0.7,0,0]}]});
  const canvas=new EventTarget() as HTMLCanvasElement;
  const first=new Input(canvas);first.rebind("interact","KeyT");first.dispose();
  const next=new Input(canvas);
  try {
    expect(next.bindings.interact[0]).toBe("KeyT");next.gameplayActive=true;next.pollGamepad(1/60);
    expect(next.wasPressed("interact")).toBe(true);expect(next.axis("left","right")).toBeGreaterThan(0.5);
    next.clear();expect(next.axis("left","right")).toBe(0);expect(next.axis("back","forward")).toBe(0);expect(next.wasPressed("interact")).toBe(false);
  } finally {next.dispose();}
});
