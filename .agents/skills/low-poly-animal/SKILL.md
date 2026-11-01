---
name: low-poly-animal
description: Build a lightweight low-poly 3D animal game asset fully in code (one smooth skin, painted colours, relevant moves only) and export GLB / glTF / FBX / three.js r187. For detailed animals use procedural-3d-animal.
---

# Low-poly animal asset (Low-Poly Menagerie, light version)

Use this skill whenever the user wants a **low-poly**, **lightweight**, **game-ready** or **"very low poly"** animal. For a **detailed** animal (fur shells, many face parts, expressive toon face, habitats, every move) use **procedural-3d-animal** instead. Humans use human-toon-character.

The deliverable is a **toon asset**, not a scene: one interactive page (published as an artifact) that previews the animal on a neutral studio backdrop (habitat optional behind a Background toggle) and downloads it.

## Two looks (ask if unclear, default = stylised realistic)
| Look | Use when | Recipe |
|---|---|---|
| **Stylised realistic** (default) | "low poly but realistic", "light", game crowds | ONE welded skinned mesh, smooth normals, colours painted per face, real proportions, natural light, no outline |
| **Toon low poly** | "toon", "cute low poly" | flat facets per face, 3-step toon light, chunky 9-tri tufts, low-segment face parts, inverted-hull outline |

## Reference pages (read with read_artifact, save locally, patch with a Python make.py)
- Stylised-realistic spotted pig (one mesh, ~2.6k tris, 6 moves, 410 KB GLB): https://claude.ai/artifact/R8RDDAzp4LHvxeffesQXdh
- Toon low-poly golden retriever (~5k tris + outline): https://claude.ai/artifact/6QVprmiAi1P8a4nYqRnDVu
- Detailed retriever with the full export kit (the base both were built from): https://claude.ai/artifact/N22CmRx9Y3CJa3z7AVhFmy
The pages contain the hand-written WebGL2 engine, the QEM decimator (`qemDecimate`) and the export kit (`/* TOON ASSET KIT */`). No libraries, no Meshy, no model files.

## Pipeline
1. **Sculpt at full detail** with an SDF (smin of ellipsoids/cones): body, head, snout, ears, tail, hooves/paws, all in one field so the result is ONE continuous skin with no cuts. Real proportions; search for reference photos first.
2. **Mesh**: surfaceNets (cell ≈0.016–0.019 m) → relax 3 → orient. Compute skin weights (inverse distance to bone segments, top 4) on this fine mesh.
3. **Decimate** with QEM edge collapse (quadrics, link condition, fold-over check, survivor keeps its attributes) to the budget, with an importance map: eyes ×12–30, face/snout ×6, ears ×6, paws/hooves and the hoof line ×10, tail ×6, spot edges ×9. Budget: 1.2–2.5k tris (very low), 3–5k (low).
4. **Shading**:
   - Realistic: keep the welded **smooth normals**. For crisp hand-painted patches, unweld the corners but copy the smooth normal to each corner and colour per FACE (smooth shading + crisp polygonal colour edges). Users read flat facets on a realistic animal as "rough skin".
   - Toon: unweld with one flat normal per face.
5. **Paint per face** from masks computed on the face centroid (kept on the CPU so a Breed/Colour row recolours instantly): base, belly/snout pink, spots (many seeded blobs with a slightly noisy edge, varied shade, spread over back AND sides, a few on head/ears/legs), points/belts for breeds, snout disc + nostrils, hooves, eye lid ring, baked AO = clamp(sdf(c+n·0.06)/0.06) → colour × (0.66+0.34·ao), ±3% jitter.
6. **Eyes must be visible**: merge two small low-poly eyeballs (10×7 spheres, pupil/iris/highlight by vertex colour, rigid on the head joint) into the SAME mesh, so it stays one mesh / one material. Aim ears so they don't hide the eyes (build lop-ear frames from explicit axes).
7. **Rig**: reuse a template rig (quadruped: root, hips, spine, chest, neck, head, ears, 2-bone legs, 5 tail bones). Keep effect helper nodes out of the file with `node.noExport=1`.
8. **Moves: only relevant ones.** Idle, walk, run + 2–3 species behaviours (pig: root/eat, mud roll, sleep; bird: perch, fly, soar, land; predator: stalk, attack; horse: graze, trot, gallop). Set `KIT.clips=[...]` and trim the ACTS buttons to match. Never ship borrowed moves (a pig doesn't bark or play-bow).
9. **Export** (Asset row): GLB, glTF, FBX 7.4 ASCII, three.js r187 starter page, plus "All (.zip)".
   - Compact glTF: COLOR_0 / JOINTS_0 / WEIGHTS_0 as normalized bytes (weights fixed to sum 255); omit normals only for the faceted toon look; animations at 15 fps, in place, loops blended end→start; channels pruned when they never move.
   - FBX ASCII is indentation-sensitive for three's FBXLoader: arrays at the exact tab depth, long arrays continue on lines with NO leading whitespace; vertex colours in sRGB; rotations as FBX XYZ (= three 'ZYX'); skip the outline mesh in FBX.
   - Artifact viewer: declare the `downloads` capability, save via `await claude.use('downloads')` → `save({filename,data})`, and wrap .glb/.gltf/.fbx in a .zip (they are not allowlisted).
10. **Verify** with three.js r187's own loaders: `git clone --depth 1 --branch r187 --filter=blob:none --sparse https://github.com/mrdoob/three.js` + sparse-checkout `/build/ /examples/jsm/` (npm is blocked), serve with `python3 -m http.server`, load GLB/glTF/FBX in Playwright, check meshes / skinned / bones / clips, render a posed frame. Make export winding follow the normals.
11. **Report honestly**: triangle count, mesh/material count, file size and what the size is made of (usually animations).

## Targets (spotted pig reference)
~2.4k body tris + 2 eyeballs, 1 mesh, 1 material, 21 joints, 6 clips, GLB ≈410 KB, loads and animates in three.js r187 as GLB, glTF and FBX.

## Style the user wants
Stylised realistic, very light, one smooth skin with no cuts, visible eyes, painted markings that look like the reference (many small spots, not a few big ones), background optional, only relevant animations, downloadable asset first.
