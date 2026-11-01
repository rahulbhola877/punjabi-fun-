import { launch, waitFor, sleep } from './pt-lib.mjs';
const { browser, page, log } = await launch(`${process.argv[2] ?? 'http://127.0.0.1:4173/'}?probe`, { w: 1280, h: 720, settings: { quality: 'low' } });
try {
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 240000 });
  await page.locator('#title .menu button').first().click({ timeout: 120000 });
  await page.locator('#title .looks button').first().click({ timeout: 120000 });
  await waitFor(page, s => s.state === 'playing', 240000);
  const parked = await page.evaluate(() => window.__pfs.snapshot().vehicles.find(v => v.id === 'plane_airfield'));
  if (!parked) throw Error('The plane is missing from the airfield apron');
  await page.evaluate(p => { window.__pfs.teleport(p.x-10,p.z+9,0); window.__pfs.holdCamera({eye:{x:p.x-11,y:4,z:p.z+13},at:{x:p.x,y:1.6,z:p.z},fov:0.8}); }, parked);
  await sleep(4000);
  await page.screenshot({path:'/tmp/punjabi-plane.png',timeout:180000});
  await page.evaluate(() => window.__pfs.holdCamera(null));
  const id = await page.evaluate(() => window.__pfs.driveAt('plane', 410, 1891, Math.PI / 2));
  if (!id) throw Error('Could not enter plane');
  const hierarchy = await page.evaluate(id => {
    const scene = window.__pfs.scene(), prop = scene.getTransformNodeByName(`${id}_prop`), root = scene.getTransformNodeByName(`${id}_vis`);
    const body = scene.meshes.filter(m => m.name.startsWith(`${id}_body|`));
    return { prop: !!prop, propMeshes: prop?.getChildMeshes().length ?? 0, bodyMeshes: body.length, bodyOnRoot: body.every(m => m.parent === root) };
  }, id);
  if (!hierarchy.prop || !hierarchy.propMeshes || !hierarchy.bodyMeshes || !hierarchy.bodyOnRoot) throw Error(`Invalid aircraft/propeller hierarchy: ${JSON.stringify(hierarchy)}`);
  const first = await page.evaluate(() => window.__pfs.ride());
  const deadline = Date.now() + 360000;
  let ride = first;
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  try {
    while (ride.y < 15) {
      if (Date.now() > deadline || ride.simTime - first.simTime > 25) throw Error(`Plane did not take off: ${JSON.stringify(ride)}`);
      if (ride.up < 0.65 || ride.y < -1) throw Error(`Plane overturned or fell: ${JSON.stringify(ride)}`);
      await sleep(250);
      ride = await page.evaluate(() => window.__pfs.ride());
      if (!ride) throw Error('Unexpectedly left the aircraft');
    }
  } finally { await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); }
  const airborne = ride;
  // Controlled approach: keep enough airspeed, lower the nose, and flare if
  // descent steepens. Wait for simulation time as software WebGL is slow.
  const keys = new Set();
  const setKey = async (key, down) => {
    if (down && !keys.has(key)) { keys.add(key); await page.keyboard.down(key); }
    if (!down && keys.has(key)) { keys.delete(key); await page.keyboard.up(key); }
  };
  const landingDeadline = Date.now() + 360000;
  let worstSink = 0;
  try {
    while (!(ride.grounded && ride.y < 1)) {
      if (Date.now() > landingDeadline || ride.simTime - airborne.simTime > 40) throw Error(`Plane did not land: ${JSON.stringify(ride)}`);
      if (ride.up < 0.65 || ride.y < -1) throw Error(`Plane overturned on approach: ${JSON.stringify(ride)}`);
      if (ride.y > 0.4 && ride.y < 1.5) worstSink = Math.max(worstSink, -ride.vy);
      await setKey('KeyW', ride.v < 20);
      await setKey('Space', ride.vy < -2);
      await setKey('ShiftLeft', ride.vy >= -2);
      await sleep(150);
      ride = await page.evaluate(() => window.__pfs.ride());
      if (!ride) throw Error('Unexpectedly left the aircraft');
    }
  } finally { for (const key of keys) await page.keyboard.up(key); }
  if (worstSink >= 6) throw Error(`Landing too hard (${worstSink} m/s): ${JSON.stringify(ride)}`);
  const errors = await page.evaluate(() => window.__pfs.snapshot().errors);
  if (errors.length || page.__external.length || log.some(s => /^\[(error|pageerror|http )/.test(s))) throw Error(JSON.stringify({ errors, external: page.__external, log }));
  console.log(JSON.stringify({ parked, hierarchy, first, airborne, landed: ride, worstSink, errors, log }));
} finally { await browser.close(); }
