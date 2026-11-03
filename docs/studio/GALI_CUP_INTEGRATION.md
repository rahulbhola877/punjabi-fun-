# Gali da Cup host contract

Gameplay/narrative implementation role: contained pure mission state and Cricket extension. No world/actor ownership changes. Existing park pitch, existing cricket ball and cricket-owned children are reused. No Home-owned actors move.

## Additive save and admission

Store a `GaliCupState` additive field. `freshGaliCup()` supplies the default; `normalizeGaliCup(unknown)` validates loaded state. The normalizer converts an in-progress short round to the last preparation checkpoint, preserves bowling seed and sets `resumed`; show `cupObjective` feedback. Preserve ordinary `c_cricket` (played), all phone/story/home fields and historic saves.

A static visible invitation at Sant Nagar park calls `inviteCup`. Ground/open choice calls `chooseCupRules`. Ground caps four/six shots to two with target 10; open retains boundaries with target 20 and a nearby loose-ball collection following the first six. Practice has three balls, batting target four, then interception/return. Batting readiness and fielding readiness accumulate independently across practice attempts, allowing focused retries.

Before admission recheck food/passenger/carry/vehicle/other activity eligibility after any asynchronous dialogue. `beginCupRound(state, practice?)` returns null when uninvited, already active, or attempting a cup before practice readiness. Otherwise persist its returned `state` BEFORE calling:

```ts
cricket.start({ mode: round.mode, rules: round.rules, seed: round.seed,
  onComplete(result) {
    const outcome = recordCupResult(savedCup, result);
    if (!outcome.accepted) return;
    savedCup = outcome.state;
    // If firstReward, apply the named local relationship consequence here.
    // Persist both receipt and consequence synchronously, then open result UI.
  }
});
```

`recordCupResult` returns `{state,accepted,firstReward,relationship}`. Relationship descriptor currently names `Gali team`, delta 3; host maps this to its named local invitation character/relationship. First winning cup alone sets receipt. Later wins update separate ground/open best scores, medals and win counts without another first consequence. Result target/won values are not trusted for cup receipt: state recomputes rule target plus successful return. Each accepted attempt advances seed by 97; duplicate/stale completion is rejected. On loss, keep stage ready and offer focused practice or immediate rematch. Passing `practice=true` allows optional practice after qualification/win without erasing stage/records.

## Input, pause and cancellation

`CricketGame.start()` still starts ordinary cricket with its existing rewards/results and six-ball behavior. Configured cup/practice rounds emit typed `CricketResult` synchronously and do not award ordinary money or show their own results.

Keep gameplay movement locked while active as ordinary cricket already requires. Map remapped action/attack and touch action to `cricket.swing()` throughout ALL active phases. `host.aim()` must expose held lateral direction from keyboard, touch or controller in range -1..1. No hardcoded key is needed by new phases. Configured prompts say Action; ordinary cricket retains its legacy Q text.

After batting, the player is placed inside the park for a two-step fielding action. Lateral aim moves the catcher at four metres/second; action must intercept within 0.85 metres of the ball lane while approach time is 1.25–2.15 seconds. A second action must return between 0.6–1.2 seconds. Missing either fails fielding and yields a recoverable loss. Open loose-ball recovery moves laterally to the visible yellow ball and requires action nearby; it has no timeout. No idle auto-success.

Continue calling `update(dt)` only during unpaused, focused gameplay. Post-shot delay now uses gameplay dt rather than an uncancellable wall-clock timeout, so pause/focus also pauses progression. Stop/dispose increments an attempt token and clears pending continuation. On host cancellation call `cricket.stop()` and save `interruptCupRound(state)`; no completion/reward fires. Reload validation provides the same restart checkpoint. Dispose on scene teardown.

## Verification and remaining integration evidence

Focused command: `npx vitest run tests/cricket.test.ts tests/cricketCup.test.ts tests/galiCup.test.ts --maxWorkers=2` — 14 tests passed on 2026-11-03. Covers ordinary scoring/pitch, rule differences, input-dependent interception/return, no-input failure, stop/restart continuation, open-six collection gate, invitation/practice admission, interrupted checkpoint, duplicate/stale receipt, records and corrupt save handling.

Root must validate exact integrated TypeScript/build and ordinary-input invitation, remapped keyboard/touch, pause/focus, recovery visuals, rule choices, loss/rematch, reload and actual relationship consequence in browser. No browser journey, duration, fun or device FPS claim is made by this implementation. The previous six-ball activity alone is not evidence of the requested first-play duration.
