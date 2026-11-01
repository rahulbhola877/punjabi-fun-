import fs from 'node:fs';
import { launch, sleep, waitFor } from './pt-lib.mjs';

// Production-compatible interaction checks via the existing ?probe API.
// Optional dev-only audio taps measure scheduled PCM, not subjective quality.
const url = new URL(process.argv[2] ?? 'http://127.0.0.1:5173/');
url.searchParams.set('probe', ''); url.searchParams.set('gfx', 'low');
const { browser, page, log } = await launch(url.href, { w: 800, h: 450, blockWebSockets: true, settings: { quality: 'low', renderScale: 0.7, shadows: 'off', post: false } });
const report = { renderer: process.env.SOFTWARE === '1' ? 'software' : 'default', checks: {} };
const sampledSounds = [];
async function snapshot() {
  const s = await page.evaluate(() => window.__pfs.snapshot());
  sampledSounds.push(...(s.audio?.heard ?? []));
  return s;
}
async function until(predicate, message, timeout = 150000) {
  const end = Date.now() + timeout;
  let last;
  do {
    last = await snapshot();
    if (predicate(last)) return last;
    await sleep(100);
  } while (Date.now() < end);
  throw Error(`${message}: ${JSON.stringify(last).slice(0, 900)}`);
}
try {
  // blockWebSockets prevents HMR before the first navigation. Reloading during
  // startup would abort a valid in-flight Havok WASM download and pollute logs.
  await page.waitForFunction(() => window.__pfs?.snapshot().state === 'title', null, { timeout: 180000 });
  await page.locator('#title .menu button').getByText('New Game', { exact: true }).click();
  await page.locator('#title .looks button').first().click();
  await waitFor(page, s => s.state === 'playing', 180000);
  report.audioTapAvailable = await page.evaluate(() => {
    const game = window.__game;
    if (!game?.audio.ctx) return false;
    const audio = game.audio, ctx = audio.ctx;
    window.__foundationAudio = { splashes: 0, samples: [], maxContactSources: 0, sourcesAfterExit: null };
    const originalSplash = audio.splash.bind(audio);
    audio.splash = (...args) => {
      window.__foundationAudio.splashes++;
      const originalCreate = ctx.createBufferSource.bind(ctx);
      ctx.createBufferSource = () => {
        const source = originalCreate(), analyser = ctx.createAnalyser(), sink = ctx.createGain();
        analyser.fftSize = 256; sink.gain.value = 0;
        source.connect(analyser); analyser.connect(sink).connect(ctx.destination);
        const buffer = new Float32Array(256), sample = { rms: 0, ended: false };
        window.__foundationAudio.samples.push(sample);
        const timer = setInterval(() => {
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0; for (const n of buffer) sum += n * n;
          sample.rms = Math.max(sample.rms, Math.sqrt(sum / buffer.length));
        }, 25);
        source.addEventListener('ended', () => { clearInterval(timer); analyser.disconnect(); sink.disconnect(); sample.ended = true; });
        return source;
      };
      try { return originalSplash(...args); } finally { ctx.createBufferSource = originalCreate; }
    };
    const originalContact = audio.vehicleContact.bind(audio);
    audio.vehicleContact = (...args) => {
      originalContact(...args);
      const n = audio.contactVoice?.active?.sources.length ?? 0;
      window.__foundationAudio.maxContactSources = Math.max(window.__foundationAudio.maxContactSources, n);
      if (!args[0]) window.__foundationAudio.sourcesAfterExit = n;
    };
    return true;
  });
  await page.evaluate(() => window.__pfs.weather(false));

  // A real bridge deck above the canal must stay dry, despite sharing its Z.
  await page.evaluate(() => window.__pfs.teleport(0, 170, 0));
  await sleep(2000);
  const bridge = await snapshot();
  if (bridge.swimming || bridge.player.y < -0.3) throw Error(`Bridge falsely treated as water: ${JSON.stringify(bridge.player)}`);
  report.checks.bridge = bridge.player;
  console.log('Bridge deck stays dry.');

  // Walk down the actual bathing steps with ordinary input; no swimming flag,
  // body velocity or underwater teleport is set by this harness.
  await page.evaluate(() => window.__pfs.teleport(45, 182.5, Math.PI));
  const before = await snapshot(), propsBefore = await page.evaluate(() => window.__pfs.sandbox().slice(-2));
  const entrySoundsAt = sampledSounds.filter(s => s === 'splash').length;
  const audioEntryCount = await page.evaluate(() => window.__foundationAudio?.splashes ?? null);
  await page.keyboard.down('KeyW');
  let entry;
  try { entry = await until(s => s.swimming, 'Walking down bathing steps did not enter water'); }
  finally { await page.keyboard.up('KeyW'); }
  const ripple = await page.evaluate(() => window.__pfs.scene().meshes.filter(m => m.name.startsWith('contactRipple') && m.isEnabled()).length);
  if (entry.player.y >= -1 || entry.player.z <= 162 || entry.player.z >= 178) throw Error('Swimming outside actual canal volume');
  const floating = await until(s => s.swimming && s.player.x > entry.player.x + 0.3 && s.player.y > -2.45 && s.player.y < -1.45, 'Idle swimmer did not float and drift with the current');
  const propsAfter = await page.evaluate(() => window.__pfs.sandbox().slice(-2));
  if (!ripple) throw Error('Water entry created no visible contact ripple');
  if (propsAfter.length !== 2 || propsAfter.some(p => !Number.isFinite(p.x + p.y + p.z) || p.y < -2.2 || p.y > -0.45)) throw Error(`Bathing-step props did not float stably: ${JSON.stringify(propsAfter)}`);
  if (propsAfter.some((p, i) => p.x <= propsBefore[i].x)) throw Error('Floating props did not move downstream');
  const splashCount = sampledSounds.filter(s => s === 'splash').length - entrySoundsAt;
  if (splashCount < 1 || entry.audio.state !== 'running') throw Error(`No scheduled water entry audio: ${splashCount}, ${entry.audio.state}`);
  report.checks.water = { approach: before.player, entered: entry.player, floating: floating.player, rippleCount: ripple, propsBefore, propsAfter, scheduledSplashes: splashCount };
  console.log('Natural water entry, current, ripples and floating props passed.');
  if (report.audioTapAvailable) {
    const tap = await page.evaluate(() => window.__foundationAudio);
    if (tap.splashes - audioEntryCount !== 1) throw Error(`Natural entry splashed ${tap.splashes - audioEntryCount} times without another entry`);
    if (!tap.samples.some(s => s.rms > 0.0001)) throw Error(`Scheduled splash produced no measured PCM: ${JSON.stringify(tap.samples)}`);
    report.checks.water.measuredSplashPcmRms = Math.max(...tap.samples.map(s => s.rms));
  }

  // Real driving controls on a known continuous bypass road, followed by
  // service braking (S) and ordinary exit (E), not a scripted position tween.
  await page.evaluate(() => window.__pfs.teleport(-1100, -650, 0));
  const vehicle = await page.evaluate(() => window.__pfs.driveAt('car', -1100, -650, 0));
  if (!vehicle) throw Error('Could not enter the test car');
  await page.keyboard.down('KeyW');
  let moving;
  try { moving = await until(s => s.vehicle && s.vehicle.speed > 4 && s.vehicle.z > -643, 'Car did not accelerate and move on the road'); }
  finally { await page.keyboard.up('KeyW'); }
  if (moving.vehicle.upY < 0.8 || moving.vehicle.y < -0.5) throw Error(`Car lost ground support: ${JSON.stringify(moving.vehicle)}`);
  await page.keyboard.down('KeyS');
  let stopped;
  try { stopped = await until(s => s.vehicle && Math.abs(s.vehicle.speed) < 0.45, 'Car did not stop under braking'); }
  finally { await page.keyboard.up('KeyS'); }
  await page.keyboard.press('KeyE');
  await until(s => !s.vehicle, 'Could not exit stopped car');
  await sleep(2200);
  report.checks.driving = { moving: moving.vehicle, stopped: stopped.vehicle };
  console.log('Road acceleration, service braking and vehicle exit passed.');
  if (report.audioTapAvailable) {
    const tap = await page.evaluate(() => window.__foundationAudio);
    if (tap.maxContactSources !== 2 || tap.sourcesAfterExit !== 0) throw Error(`Contact source budget or cleanup failed: ${JSON.stringify(tap)}`);
    report.checks.driving.contactAudioSourcesWhileDriving = tap.maxContactSources;
    report.checks.driving.contactAudioSourcesAfterExit = tap.sourcesAfterExit;
  }
  const final = await snapshot();
  const errors = log.filter(s => /^\[(http|error|pageerror)/.test(s));
  if (errors.length || page.__external.length || final.errors.length) throw Error(JSON.stringify({ errors, external: page.__external, game: final.errors }));
  report.passed = true;
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = String(error); process.exitCode = 1; console.error(error);
} finally {
  fs.mkdirSync('artifacts/foundation', { recursive: true });
  fs.writeFileSync('artifacts/foundation/physics-smoke.json', JSON.stringify(report, null, 2));
  await browser.close();
}
