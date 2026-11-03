import { describe, expect, it } from "vitest";
import { beginTractorSponsorship as begin, chooseTractorCommitment as choose, finishTractorSponsorship as finish, freshTractorSponsorship as fresh, interruptTractorSponsorship as interrupt, normalizeTractorSponsorship as normalize, recordTractorOutcome as record, type TractorCommitment } from "../src/missions/TractorSponsorship";
const running = (choice:TractorCommitment = "purse") => begin(choose(fresh(), choice)!)!.state;
describe("tractor sponsorship", () => {
  it("requires a commitment and permits one active attempt", () => {
    expect(begin(fresh())).toBeNull();
    const s = running();
    expect(begin(s)).toBeNull(); expect(choose(s,"village")).toBeNull(); expect(finish(s)).toBeNull();
  });
  it.each(["purse", "village"] as const)("qualifies %s and returns a single receipt", choice => {
    const s = running(choice);
    const report = record(s,s.attemptId,{finished:true,rank:choice === "purse" ? 3 : 4,elapsed:150}).state;
    expect(report.stage).toBe("report");
    const paid = finish(normalize(JSON.parse(JSON.stringify(report))))!;
    expect(paid).toMatchObject({money:choice === "purse" ? 300 : 100,rep:choice === "purse" ? 2 : 8});
    expect(normalize(paid.state)).toMatchObject({stage:"done",receipt:true,outcome:report.outcome});
    expect(finish(normalize(paid.state))).toBeNull(); expect(choose(paid.state,"purse")).toBeNull();
  });
  it("rejects duplicates, stale attempts and malformed evidence", () => {
    const s=running(); const outcome={finished:true,rank:1,elapsed:140};
    expect(record(s,s.attemptId-1,outcome).accepted).toBe(false);
    for(const bad of [{...outcome,rank:0},{...outcome,rank:5},{...outcome,rank:1.5},{...outcome,elapsed:NaN},{...outcome,elapsed:Infinity},{...outcome,elapsed:0}]) expect(record(s,s.attemptId,bad).accepted).toBe(false);
    const report=record(s,s.attemptId,outcome).state;
    expect(record(report,s.attemptId,outcome).accepted).toBe(false);
    expect(interrupt(report,s.attemptId)).toBeNull();
  });
  it("fails unfinished laps even in first place and permits retry or a changed commitment", () => {
    const s=running();
    const failed=record(s,s.attemptId,{finished:false,rank:1,elapsed:180}).state;
    expect(failed.stage).toBe("failed"); expect(finish(failed)).toBeNull();
    expect(normalize(failed).stage).toBe("failed");
    const next=begin(choose(failed,"village")!)!.state;
    expect(next.attemptId).toBe(s.attemptId+1);
    expect(record(next,s.attemptId,{finished:true,rank:1,elapsed:140}).accepted).toBe(false);
    const fourth=record(running(),1,{finished:true,rank:4,elapsed:170}).state;
    expect(fourth.stage).toBe("failed");
  });
  it("resets interrupted/reloaded laps and preserves choice and attempt identity", () => {
    const s=running("village");
    expect(interrupt(s,s.attemptId-1)).toBeNull();
    for(const reset of [interrupt(s,s.attemptId),normalize(s)]) expect(reset).toMatchObject({stage:"ready",choice:"village",attemptId:1,outcome:null});
    const next=begin(normalize(s))!.state;
    expect(next.attemptId).toBe(2);
    expect(record(next,1,{finished:true,rank:1,elapsed:120}).accepted).toBe(false);
  });
  it("normalizes corrupt saves without manufacturing a completed result", () => {
    expect(normalize({version:2,receipt:true}).stage).toBe("available");
    expect(normalize({...running(),stage:"report",outcome:{finished:false,rank:1,elapsed:180}}).stage).toBe("ready");
    expect(normalize({...running(),stage:"done",receipt:true,outcome:{finished:true,rank:5,elapsed:150}}).receipt).toBe(false);
    expect(begin({...running(),stage:"ready",attemptId:Number.MAX_SAFE_INTEGER-1})).toBeNull();
  });
});
