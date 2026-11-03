import { describe, expect, it } from "vitest";
import { beginKotliRound, cancelKotliRound, chooseKotliRole, finishKotliSelection, freshKotliSelection, inviteKotliSelection, normalizeKotliSelection, recordKotliEvent, type KotliSelectionState } from "../src/missions/KotliSelection";
import type { KabaddiSelectionEvent } from "../src/minigames/Kabaddi";
function raid(s: KotliSelectionState, n: number, touches: number, reason: "home"|"caught"|"empty" = touches ? "home" : "empty") {
  return recordKotliEvent(s,{kind:"raid",attemptId:s.attemptId,cup:false,raid:n,reason,touches}).state;
}
function practice() {
  let s=beginKotliRound(inviteKotliSelection(freshKotliSelection())!)!.state;
  for(let n=1;n<=4;n++)s=raid(s,n,n===1?1:0);
  return recordKotliEvent(s,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).state;
}
describe("Kotli selection story",()=>{
  it("requires invitation and a real scoring return before role choice",()=>{
    expect(beginKotliRound(freshKotliSelection())).toBeNull();
    expect(chooseKotliRole(freshKotliSelection(),"captain")).toBeNull();
    expect(practice()).toMatchObject({stage:"choose",practiceComplete:true});
    let s=beginKotliRound(inviteKotliSelection(freshKotliSelection())!)!.state;
    for(let n=1;n<=4;n++)s=raid(s,n,2,"caught");
    expect(recordKotliEvent(s,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).state.stage).toBe("practice");
  });
  it.each(["captain","raider"] as const)("qualifies %s through distinct player actions and pays once",role=>{
    let s=beginKotliRound(chooseKotliRole(practice(),role)!)!.state;
    for(let n=1;n<=4;n++)s=raid(s,n,role==="captain" ? n<=3?1:0 : n===1?2:0);
    expect(s.stage).toBe("playing");expect(finishKotliSelection(s)).toBeNull();
    s=recordKotliEvent(s,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).state;
    const normalized=normalizeKotliSelection(JSON.parse(JSON.stringify(s)));
    expect(normalized.stage).toBe("report");
    const result=finishKotliSelection(normalized)!;
    expect(result.money).toBe(role==="captain"?150:300);expect(result.relationship.amount).toBe(role==="captain"?3:1);
    expect(finishKotliSelection(normalizeKotliSelection(result.state))).toBeNull();
  });
  it("rejects duplicate, skipped, stale, cup, malformed and premature completion callbacks",()=>{
    const s=beginKotliRound(chooseKotliRole(practice(),"raider")!)!.state;
    const event:KabaddiSelectionEvent={kind:"raid",attemptId:s.attemptId,cup:false,raid:1,reason:"home",touches:2};
    const first=recordKotliEvent(s,event).state;
    expect(recordKotliEvent(first,event).accepted).toBe(false);
    for(const e of [{...event,raid:3},{...event,attemptId:s.attemptId-1},{...event,cup:true},{...event,touches:5},{...event,touches:NaN},{...event,reason:"empty" as const}])expect(recordKotliEvent(s,e).accepted).toBe(false);
    expect(recordKotliEvent(first,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).accepted).toBe(false);
  });
  it("failed qualification can retry another role and old events remain invalid",()=>{
    let s=beginKotliRound(chooseKotliRole(practice(),"captain")!)!.state;const old=s.attemptId;
    for(let n=1;n<=4;n++)s=raid(s,n,n===1?2:0);
    s=recordKotliEvent(s,{kind:"complete",attemptId:old,cup:false,raids:4}).state;
    expect(s.stage).toBe("failed");expect(finishKotliSelection(s)).toBeNull();
    s=beginKotliRound(chooseKotliRole(s,"raider")!)!.state;
    expect(s.attemptId).toBeGreaterThan(old);
    expect(recordKotliEvent(s,{kind:"raid",attemptId:old,cup:false,raid:1,reason:"home",touches:2}).accepted).toBe(false);
  });
  it("reload/cancel restarts match evidence but retains earned practice and choice",()=>{
    let s=beginKotliRound(inviteKotliSelection(freshKotliSelection())!)!.state;s=raid(s,1,1);
    expect(normalizeKotliSelection(s).stage).toBe("choose");expect(cancelKotliRound(s)?.stage).toBe("choose");
    s=beginKotliRound(chooseKotliRole(practice(),"raider")!)!.state;s=raid(s,1,2);
    const restored=normalizeKotliSelection(JSON.parse(JSON.stringify(s)));
    expect(restored).toMatchObject({stage:"ready",role:"raider",practiceComplete:true,scoringRaids:0,bestTouches:0});
    expect(cancelKotliRound(s)).toMatchObject({stage:"ready",bestTouches:0});
    expect(normalizeKotliSelection(undefined)).toEqual(freshKotliSelection());
  });
});
