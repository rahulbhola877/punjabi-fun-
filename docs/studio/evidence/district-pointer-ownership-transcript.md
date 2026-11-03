# District pointer ownership: transcript evidence

Recorded 2026-11-03 by the gameplay/UI worker after the focused runs. **This file transcribes tool-output excerpts; it is not an untouched raw process log.** Neither run redirected stdout/stderr to disk. The baseline was not rerun to manufacture a log. Existing evidence files were not overwritten.

## Source and scope

- Production repair: `src/alternate/DistrictControls.ts` only.
- Focused regressions: `tests/districtControls.test.ts`; existing `tests/secondaryTouchClick.test.ts` also exercised after repair, without edits.
- Pre-repair production file blob shown by the diff: `9ea9673`.
- At note creation, checkout HEAD was `eb4e8174748a6b1edfdf2215836844147d249837`; the production repair and test additions were working-tree changes. This records the checkout when the note was written, not an independently captured commit ID from the earlier test invocation.
- Repaired production file SHA-256: `cf16fea4f64947a7b90a62229dd7a45e3588f692cafa5f007c65def9e928452f`.
- Updated test file SHA-256: `3845ad65ccadb6de21b80871f70473fb574fe01bdb3fcb96915ed3ffcd1e1319`.

The tests use real `Input` and `DistrictControls`, a minimal DOM/gamepad shim, and explicit bubbling events with pointer IDs. They do not run a browser's native pointer-capture machinery. Map rendering is mocked. No full suite, build or browser was run by this worker for this repair.

## Baseline: new regressions, production handlers unchanged

Working directory: `/workspace/punjabi-original-repair`.

Command:

```text
npx vitest run tests/districtControls.test.ts --maxWorkers=1
```

Tool session `98304`, process exit code `1`. Relevant output excerpt:

```text
 RUN  v4.1.12 /workspace/punjabi-original-repair

 ❯ tests/districtControls.test.ts (16 tests | 10 failed) 81ms
   × keeps the right look thumb active when the left stick emits pointerup 24ms
   × keeps the right look thumb active when the left stick emits pointercancel 4ms
   × keeps the right look thumb active when the left stick emits lostpointercapture 3ms
   × ignores an unrelated pointer's pointerup in both gesture owners 5ms
   × ignores an unrelated pointer's pointercancel in both gesture owners 2ms
   × ignores an unrelated pointer's lostpointercapture in both gesture owners 2ms
   × does not let another contact steal either active gesture 3ms
   × clears gesture ownership on pause and ignores stale moves 3ms
   × clears gesture ownership on blur and ignores stale moves 2ms
   × clears gesture ownership on dispose and ignores stale moves 3ms

 Test Files  1 failed (1)
      Tests  10 failed | 6 passed (16)
   Start at  17:32:50
   Duration  1.52s (transform 363ms, setup 0ms, import 1.10s, tests 81ms, environment 0ms)
```

Failure details transcribed from the same output:

| Case | Expected | Received | First failing assertion |
| --- | --- | --- | --- |
| Left-stick `pointerup` / `pointercancel` / `lostpointercapture`, then right-look move | Look delta `30` | `0` | Test line 102 |
| Unrelated pointer terminal event on stick | Forward axis `1` | `0` | Test line 111 |
| Second contact attempts to replace stick owner | Forward axis `1` | `-0.7142857142857143` | Test line 127 |
| Pause / blur / dispose gesture reset | Knob transform `""` | `"translate(0px,-30px)"` | Test line 148 |

The interruption cases stopped at their first failing visual-reset assertion on the baseline. Their later stale-move/capture/fresh-gesture assertions are present in the tests and executed successfully after repair; they are not claimed as separately observed baseline failures.

## Repaired focused run

Command:

```text
npx vitest run tests/districtControls.test.ts tests/secondaryTouchClick.test.ts --maxWorkers=1
```

Tool session `51603`, process exit code `0`. Relevant output excerpt:

```text
 RUN  v4.1.12 /workspace/punjabi-original-repair

 Test Files  2 passed (2)
      Tests  25 passed (25)
   Start at  17:33:31
   Duration  1.53s (transform 357ms, setup 0ms, import 1.01s, tests 71ms, environment 1ms)
```

The 25 passing cases comprise 10 new pointer-ownership cases, six existing district controller/focus cases, and nine unchanged secondary-touch-button helper cases. Both outputs also contained an unrelated npm upgrade notice, omitted here.

`git diff --check -- src/alternate/DistrictControls.ts tests/districtControls.test.ts` completed with exit code `0` and no output. The source and tests were then released to the lead. Browser owner-release validation and exact-source integrated tests/build were not assessed by this worker.
