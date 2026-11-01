import { describe, expect, it, vi, afterEach } from "vitest";
import { AudioSystem } from "../src/audio/Audio";
import { environmentSamples, splashSamples } from "../src/audio/physicalSounds";
import { VoiceDirector } from "../src/audio/VoiceDirector";
import { Vector3 } from "../src/babylon";
import type { Resident } from "../src/crowds/Crowd";
import { VehicleContactAudio } from "../src/audio/VehicleContactAudio";

afterEach(() => vi.useRealTimers());

function fakeContext(state: AudioContextState = "running") {
  const ctx = { state, currentTime: 10, resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), createBufferSource: vi.fn() };
  return ctx as unknown as AudioContext & typeof ctx;
}

describe("audio world lifecycle", () => {
  it("a gesture cannot resume the main context while an alternate world owns audio", () => {
    const audio = new AudioSystem(), ctx = fakeContext("suspended"); audio.ctx = ctx;
    audio.setPaused(true);
    audio.unlock();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(audio.ready).toBe(false);
    audio.setPaused(false);
    expect(ctx.resume).toHaveBeenCalledOnce();
  });

  it("cancels decoded-later speech, street calls and effects when a world is paused", async () => {
    const audio = new AudioSystem(), ctx = fakeContext(); audio.ctx = ctx;
    let finish!: (buffer: AudioBuffer) => void;
    const pending = new Promise<AudioBuffer>(resolve => { finish = resolve; });
    Object.assign(audio, { voices: new Map([["voice/test", pending], ["sfx/test", pending]]) });
    audio.voice("test", null);
    audio.callClip("test", new Vector3());
    audio.clipAt("test", new Vector3());
    audio.setPaused(true);
    audio.setPaused(false); // even a later return cannot revive old pending lines
    finish({ duration: 1 } as AudioBuffer);
    await pending; await Promise.resolve();
    expect(ctx.createBufferSource).not.toHaveBeenCalled();
    expect(audio.voiceBusy()).toBe(false);
  });

  it("stops sounding and scheduled transients rather than freezing them for return", () => {
    vi.useFakeTimers();
    const audio = new AudioSystem(); audio.ctx = fakeContext();
    const source = { addEventListener: vi.fn(), stop: vi.fn() } as unknown as AudioScheduledSourceNode;
    (audio as unknown as { track(src: AudioScheduledSourceNode, seconds: number): void }).track(source, 1);
    audio.setPaused(true);
    expect(source.stop).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(audio.oneShots).toBe(0);
  });
});

describe("original water audio", () => {
  it("generates a bounded, finite splash with a short attack and a decaying tail", () => {
    const sr = 24000, sample = splashSamples(sr);
    expect(sample.length).toBe(Math.ceil(sr * 0.78));
    const peak = Math.max(...Array.from(sample, Math.abs));
    expect(peak).toBeGreaterThan(0.1); expect(peak).toBeLessThan(0.95);
    expect(sample.every(Number.isFinite)).toBe(true);
    expect(sample[0]).toBe(0);
    const energy = (start: number, end: number): number => sample.slice(Math.floor(start * sr), Math.floor(end * sr)).reduce((sum, n) => sum + n * n, 0);
    expect(energy(0.02, 0.12)).toBeGreaterThan(energy(0.65, 0.75) * 20);
    const environment = environmentSamples(sr);
    expect(environment[0]).toBeCloseTo(0, 8); expect(environment.at(-1)).toBeCloseTo(0, 8);
  });
});

describe("voice catalog locale", () => {
  it("English Canada residents cannot receive Punjabi lines through generic or named matches", () => {
    const resident = { id: "gill", name: "Casey", locale: "en-CA", pos: new Vector3(), look: { sex: "m", age: "adult", beard: "none" } } as unknown as Resident;
    for (const who of [["anyone"], ["any-man"], [resident.id]]) expect(VoiceDirector.fits(resident, who)).toBe(false);
    expect(VoiceDirector.words("talk", resident)).toBeNull();
    expect(VoiceDirector.words("rain-start", resident)).toBeNull();
    expect(new VoiceDirector().pick("talk", resident, new Vector3())).toBeNull();
  });
});

describe("vehicle surface sound budget", () => {
  it("runs no tyre sources without ground contact and releases both sources after stopping", () => {
    const param = () => ({ value: 0, setTargetAtTime: vi.fn() });
    const node = () => ({ connect: vi.fn(function(this: unknown, destination: unknown) { return destination; }), disconnect: vi.fn() });
    const scheduled = () => ({ ...node(), start: vi.fn(), stop: vi.fn() });
    const source = scheduled(), oscillator = { ...scheduled(), frequency: param() };
    const context = {
      currentTime: 5,
      createBufferSource: vi.fn(() => source), createOscillator: vi.fn(() => oscillator),
      createGain: () => ({ ...node(), gain: param() }),
      createBiquadFilter: () => ({ ...node(), frequency: param() }),
      createPanner: () => ({ ...node(), positionX: param(), positionY: param(), positionZ: param() }),
    };
    const voice = new VehicleContactAudio(context as unknown as AudioContext, node() as unknown as AudioNode, {} as AudioBuffer);
    const contact = { pos: new Vector3(), speed: 12, lateralSpeed: 4, grounded: false, gravel: false, braking: true };
    voice.update(contact, 0.1);
    expect(context.createBufferSource).not.toHaveBeenCalled();
    voice.update({ ...contact, grounded: true }, 0.1);
    voice.update({ ...contact, grounded: true, gravel: true }, 0.1);
    expect(context.createBufferSource).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledOnce();
    voice.update(null, 0.6);
    expect(source.stop).toHaveBeenCalledOnce(); expect(oscillator.stop).toHaveBeenCalledOnce();
    voice.dispose(); // cleanup is idempotent
    expect(source.stop).toHaveBeenCalledOnce();
  });
});
