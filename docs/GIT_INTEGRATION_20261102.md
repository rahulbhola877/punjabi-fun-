# Git source verification and isolated integration

Fresh fetch of all origin heads used the separate `refs/remotes/inspect-20261102/*`
namespace, preserving existing branches. Main is
`f3fada9ee7ccded22e52c60ae47b4104c1f99531` (2026-11-01 16:20 UTC).

Local original `work` is `16d38eaacb0d120a4ed43ce8f8c12408aa1ceaf2`,
“Improve performance and make worlds accessible”, 2026-11-01 10:24 UTC.
It is an ancestor of main, exactly one commit behind. Main's foliage/physics/audio
commit and all available original work are already ancestors of this recovery.
No additional original game commit was identified to merge. This is an ancestry
verification, not recovery of unpublished bytes. `git fsck --full --no-reflogs
--unreachable` found no unreachable commits. No merge commit was manufactured.
The parent has requested the specific additional branch/link from Rahul.

| Fresh remote head | SHA | Ahead of main | Behind main |
| --- | --- | ---: | ---: |
| claude/charming-hawking-kjy81z | `660cec9342e1` | 0 | 190 |
| codex/rendering-vehicles-connected-map | `b6d639256a28` | 0 | 62 |
| dependabot/npm_and_yarn/babylonjs/core-9.32.1 | `c82fa808bf3c` | 1 | 2 |
| dependabot/npm_and_yarn/capacitor/core-8.6.0 | `a5cd34db8ce4` | 1 | 2 |
| dependabot/npm_and_yarn/playwright-1.64.1 | `c9e0db6444bc` | 1 | 2 |
| dependabot/npm_and_yarn/three-character-kit-21b48e933f | `f7d212b87585` | 1 | 2 |
| dependabot/npm_and_yarn/typescript-7.0.2 | `43ab301caaa2` | 1 | 2 |
| first-mission | `b4c9aa50c146` | 0 | 3 |
| life-and-sounds | `0fb014316f7c` | 0 | 193 |
| main | `f3fada9ee7cc` | 0 | 0 |
| open-world | `f9ce1c4bb0be` | 0 | 197 |

Every nondependency side branch is fully contained in main. The five exclusive
Dependabot commits change package files only; they are not the missing game work
and were not merged. Local `work` and remote main remain unchanged.

## Investigation quarantine

`recovery/pursuit-investigation-a4b1641` preserves the complete attempted patrol
spawn/filter changes and the failing authored-map investigation test. Real gameplay
still did not produce the expected close pursuit within 60 simulated seconds.
The test showed the patrol's (-152,-256) position IS on an authored road, disproving
our off-road diagnosis. No successful road-response fix or fresh pursuit clip is
claimed. On `recovery/integration-20261102`, only those unverified changes to
Police/Traffic and their new helper/test are restored to the earlier `442973e`
versions. This retains the existing moving cinematic, opening/material/pond fixes,
wheel support reuse and static-shadow work. All experiment history remains intact.

No main push, deployment, force push, reset or branch deletion was performed.
