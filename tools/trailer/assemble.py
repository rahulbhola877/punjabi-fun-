"""Cut the trailer: python3 tools/trailer/assemble.py → tools/out/trailer/gedi-route-trailer.mp4

Shots come from tools/out/trailer/<shot>/NNNN.jpg (tools/trailer/shot.mjs), cards from cards/<id>.png
(tools/trailer/cards.mjs). No music: the sound is the place. Each shot gets its own ambience (AMBI: air, birds,
crowd, crickets, fire, claps, the game's horn and cooker samples), and on top, at the frame the game made them,
the doorbell chime, the voice clips and the fireworks (each shot's heard.json), the Bullet's engine and the train.
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools/out/trailer")
FPS, SR = 30, 48000

# (kind, id, seconds or [first frame, last frame])
TIMELINE = [
    ("card", "place", 2.6),
    ("shot", "dawn", [0, 149]),
    ("shot", "bazaar", [0, 149]),
    ("card", "gali", 2.2),
    ("shot", "holi", [0, 119]),
    ("shot", "ride", [0, 119]),
    ("shot", "naka", [0, 429]),
    ("shot", "train", [0, 179]),
    ("card", "bell", 2.6),
    ("shot", "doorbell", [0, 329]),
    ("card", "year", 2.2),
    ("shot", "diwali", [0, 164]),
    ("shot", "lohri", [0, 134]),
    ("shot", "teeyan", [0, 149]),
    ("shot", "cricket", [0, 149]),
    ("shot", "factory", [0, 134]),
    ("card", "logo", 5.0),
]
# Frames below are a frame number, or a moment the shot logged plus an offset: "mark:papers+148" (a mark its
# script set), "v:police_gaddi_rok" (a voice the game played), "say:Chakka" (a speech bubble starting so).
# Lower-third subtitles burnt over a shot: (shot, from, to, card id in cards/).
SUBS = [
    ("doorbell", 196, 252, "sub-jaggi"), ("doorbell", 256, 329, "sub-aunty"),
    ("naka", "v:police_gaddi_rok", "v:police_gaddi_rok+88", "sub-rok"),
    ("naka", "mark:papers", "mark:papers+144", "sub-papers"),
    ("naka", "mark:papers+148", "mark:bhola-2", "sub-bhola"),
    ("naka", "mark:bhola", "mark:bhola+80", "sub-kaun"),
    ("teeyan", "v:gossip_a", "v:gossip_a+110", "sub-gossip"),
    ("cricket", "say:Chakka", "say:Chakka+75", "sub-chakka"),
]
# Lines laid in by hand (shot, frame, sound): the greeting at the gate, the naka's papers. "v:" clips come from
# public/audio/voice/ or, for lines recorded for the trailer, tools/trailer/voice/.
CUES = [
    ("doorbell", 196, "v:player_ssa_m"), ("doorbell", 256, "v:v2_gate_03"),
    ("naka", "mark:papers", "v:naka_papers_cut"), ("naka", "mark:papers+148", "v:player_bhola_m"), ("naka", "mark:bhola", "v:naka_kaun"),
]


def at_frame(ref, events):
    """A frame number, or a logged moment plus an offset (see SUBS); None when the shot never logged it."""
    if isinstance(ref, int):
        return ref
    off = 0
    for sign in ("+", "-"):
        if sign in ref[2:]:
            name, n = ref.rsplit(sign, 1)
            ref, off = name, int(n) * (1 if sign == "+" else -1)
            break
    hit = next((f for f, e in events if e == ref or (ref.startswith("say:") and e.startswith(ref))), None)
    return None if hit is None else hit + off


def run(*a):
    subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def load(path, gain=1.0):
    """Any audio file as stereo float at SR."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2) * gain


def tone(f, dur, g, f1=None, decay=4.0):
    t = np.arange(int(dur * SR)) / SR
    freq = f if f1 is None else f * (f1 / f) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    env = np.exp(-decay * t / dur) * np.minimum(1, t / 0.005)
    return np.sin(ph) * env * g


def chime():
    """The game's doorbell: 880 then 659 Hz with two partials (Audio.doorbell)."""
    out = np.zeros(int(1.4 * SR))
    for f, t0 in ((880, 0), (659, 0.38)):
        s = int(t0 * SR)
        for mul, g, d in ((1, 0.16, 0.9), (2.76, 0.05, 0.4), (5.4, 0.02, 0.25)):
            x = tone(f * mul, d, g)
            out[s:s + len(x)] += x
    return np.stack([out, out], 1) * 3.0


def firework(dist=60):
    rng = np.random.default_rng(len(str(dist)))
    out = np.zeros(int(2.4 * SR))
    w = tone(700, 0.7, 0.03, 2600, 1.0)
    out[:len(w)] += w
    s = int((0.55 + dist / 343) * SR)
    n = rng.standard_normal(int(1.2 * SR)) * np.exp(-np.arange(int(1.2 * SR)) / SR * 6)
    out[s:s + len(n)] += n[: len(out) - s] * 0.35
    return np.stack([out, out * 0.9], 1) * 2.0


def train(dur):
    """A goods train going by: a two-tone diesel horn, then the rumble and the wheels on the rail joints."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    rumble = np.zeros(n)
    acc = 0.0
    for i in range(n):  # one-pole low-pass
        acc += 0.012 * (noise[i] - acc)
        rumble[i] = acc
    swell = np.clip(t / (dur * 0.55), 0, 1) ** 1.5
    out = rumble * 2.2 * swell
    for k in np.arange(dur * 0.45, dur, 0.42):  # clack-clack
        for d in (0, 0.09):
            s0 = int((k + d) * SR)
            c = rng.standard_normal(int(0.04 * SR)) * np.exp(-np.arange(int(0.04 * SR)) / SR * 90) * 0.25
            out[s0:s0 + len(c)] += c[: max(0, n - s0)]
    horn = np.zeros(n)
    hn = int(1.6 * SR)
    ht = np.arange(hn) / SR
    env = np.minimum(1, ht / 0.08) * np.minimum(1, (1.6 - ht) / 0.3)
    for f in (277, 349, 415):
        horn[:hn] += np.sign(np.sin(2 * np.pi * f * ht)) * 0.03 * env
    out += np.roll(horn, int(0.4 * SR))
    return np.stack([out, out], 1)


def place(track, clip, at):
    s = int(at * SR)
    if s >= len(track):
        return
    e = min(len(track), s + len(clip))
    track[s:e] += clip[: e - s]


def shaped(dur, lo, hi, seed, tilt=1.0):
    """Noise between lo and hi Hz with a 1/f^tilt slope, as stereo (two decorrelated channels)."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(2):
        spec = np.fft.rfft(rng.standard_normal(n))
        f = np.fft.rfftfreq(n, 1 / SR)
        mask = (f >= lo) & (f <= hi)
        spec *= mask / np.maximum(f, 1) ** (tilt / 2)
        x = np.fft.irfft(spec, n)
        out.append(x / (np.abs(x).max() + 1e-9))
    return np.stack(out, 1)


def birds(dur, seed):
    """Sparrows and mynas: little rising and falling whistles in twos and threes."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    t = rng.uniform(0, 0.6)
    while t < dur:
        f0, pan = rng.uniform(2600, 4800), rng.uniform(0.2, 0.8)
        for k in range(rng.integers(2, 5)):
            d = rng.uniform(0.06, 0.16)
            c = tone(f0, d, 1.0, f0 * rng.uniform(0.75, 1.35), 2.0) * np.sin(np.linspace(0, np.pi, int(d * SR)))
            s0 = int((t + k * (d + 0.05)) * SR)
            if s0 + len(c) < n:
                out[s0:s0 + len(c), 0] += c * (1 - pan)
                out[s0:s0 + len(c), 1] += c * pan
        t += rng.uniform(0.5, 1.8)
    return out


def murmur(dur, seed):
    """A crowd talking: voice-band noise that swells and falls."""
    x = shaped(dur, 250, 2400, seed, 0.6)
    t = np.arange(len(x)) / SR
    rng = np.random.default_rng(seed + 1)
    am = 0.6 + 0.4 * sum(np.sin(2 * np.pi * rng.uniform(0.3, 2.5) * t + rng.uniform(0, 6)) for _ in range(4)) / 4
    return x * am[:, None]


def crickets(dur, seed):
    n = int(dur * SR)
    t = np.arange(n) / SR
    chirp = np.sin(2 * np.pi * 4600 * t) * (np.sin(2 * np.pi * 28 * t) > 0.2) * (np.sin(2 * np.pi * 0.9 * t + seed) > -0.1)
    return np.stack([chirp, np.roll(chirp, int(0.21 * SR))], 1)


def crackle(dur, seed):
    """Wood on a bonfire: pops and snaps."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = shaped(dur, 80, 900, seed, 1.5) * 0.25
    for s0 in rng.integers(0, n - 4000, int(dur * 9)):
        k = rng.standard_normal(int(rng.uniform(0.004, 0.03) * SR)) * rng.uniform(0.3, 1.0)
        k *= np.exp(-np.arange(len(k)) / len(k) * 5)
        out[s0:s0 + len(k)] += k[:, None]
    return out


def claps(dur, seed):
    """Giddha: the circle clapping on the beat, a little ragged."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    beat, t = 0.42, 0.1
    while t < dur:
        for _ in range(5):  # five pairs of hands, not quite together
            c = rng.standard_normal(int(0.035 * SR)) * np.exp(-np.arange(int(0.035 * SR)) / SR * 120)
            s0, pan = int((t + rng.normal(0, 0.012)) * SR), rng.uniform(0.2, 0.8)
            if 0 <= s0 < n - len(c):
                out[s0:s0 + len(c), 0] += c * (1 - pan)
                out[s0:s0 + len(c), 1] += c * pan
        t += beat
    return out * 0.5


def hum(dur, seed):
    t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f * t) * g for f, g in ((50, 1), (100, 0.6), (150, 0.3), (300, 0.1))) / 2
    return np.stack([x, x], 1) + shaped(dur, 40, 400, seed, 2) * 0.4


def sfx(name, gain):
    return load(os.path.join(ROOT, "public/audio/sfx", f"{name}.mp3"), gain)


GEN = {"air": lambda d, s: shaped(d, 60, 5000, s, 1.6), "birds": birds, "crowd": murmur, "crickets": crickets, "crackle": crackle, "claps": claps, "hum": hum}
# Each shot's ambience: (generator, gain) or ("sfx", sample, seconds in, gain).
AMBI = {
    "dawn": [("air", 0.05), ("birds", 0.45), ("sfx", "buffalo_moo", 2.2, 0.5)],
    "bazaar": [("air", 0.04), ("crowd", 0.1), ("birds", 0.15), ("sfx", "horn_auto_1", 0.8, 0.45), ("sfx", "horn_scooter_2", 3.1, 0.4)],
    "holi": [("air", 0.04), ("crowd", 0.06), ("birds", 0.3)],
    "ride": [("air", 0.05), ("sfx", "truck_horn", 3.6, 0.3)],
    "train": [("air", 0.05), ("birds", 0.2)],
    "naka": [("air", 0.05), ("birds", 0.15), ("sfx", "truck_horn", 9.0, 0.2)],
    "doorbell": [("air", 0.03), ("birds", 0.25), ("sfx", "pressure_cooker", 3.4, 0.3)],
    "diwali": [("air", 0.03), ("crickets", 0.02)],
    "lohri": [("air", 0.03), ("crackle", 0.22), ("crowd", 0.06)],
    "teeyan": [("air", 0.04), ("birds", 0.25), ("crowd", 0.05), ("claps", 0.35)],
    "cricket": [("air", 0.04), ("birds", 0.25), ("crowd", 0.03)],
    "factory": [("air", 0.05), ("hum", 0.06)],
}


def main():
    seg_dir = os.path.join(OUT, "segs")
    os.makedirs(seg_dir, exist_ok=True)
    segs, t, cues = [], 0.0, []
    only = sys.argv[1:]  # cut just these segments (a quick check)
    for kind, ident, span in [x for x in TIMELINE if not only or x[1] in only]:
        out = os.path.join(seg_dir, f"{len(segs):02d}-{ident}.mp4")
        if kind == "card":
            dur, fade = span, 0.5
            run("ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", os.path.join(OUT, "cards", f"{ident}.png"),
                "-vf", f"fade=in:st=0:d={fade},fade=out:st={dur - fade}:d={fade},format=yuv420p", "-c:v", "libx264", "-crf", "17", "-preset", "medium", out)
        else:
            a, b = span
            n = b - a + 1
            dur = n / FPS
            src = os.path.join(OUT, ident)
            if not os.path.exists(os.path.join(src, f"{a:04d}.jpg")):
                sys.exit(f"missing frames for {ident}")
            vf = [f"fade=in:st=0:d=0.3,fade=out:st={dur - 0.3:.3f}:d=0.3"]
            inputs = ["-framerate", str(FPS), "-start_number", str(a), "-i", os.path.join(src, "%04d.jpg")]
            fc, chain, last = None, [], "0"
            heard = os.path.join(src, "heard.json")
            events = json.load(open(heard))["heard"] if os.path.exists(heard) else []
            for shot, r0, r1, card in SUBS:
                f0, f1 = at_frame(r0, events), at_frame(r1, events)
                if shot == ident and f0 is not None and f1 is not None:
                    f1 = min(f1, b)
                    k = len(chain) + 1
                    inputs += ["-loop", "1", "-i", os.path.join(OUT, "cards", f"{card}.png")]
                    s0, s1 = (f0 - a) / FPS, (f1 - a) / FPS
                    chain.append(f"[{k}]format=rgba,fade=in:st={s0}:d=0.25:alpha=1,fade=out:st={s1 - 0.25}:d=0.25:alpha=1[s{k}];[{last}][s{k}]overlay=0:0:shortest=1[v{k}]")
                    last = f"v{k}"
            if chain:
                fc = ";".join(chain) + f";[{last}]{vf[0]},format=yuv420p"
            args = ["ffmpeg", "-y", "-v", "error", *inputs, "-frames:v", str(n)]
            if fc:
                args += ["-filter_complex", fc]
            else:
                args += ["-vf", vf[0] + ",format=yuv420p"]
            run(*args, "-c:v", "libx264", "-crf", "17", "-preset", "medium", out)
            cues += [(t + (f - a) / FPS, e, ident) for f, e in events if a <= f <= b]
            for shot, ref, e in CUES:
                f = at_frame(ref, events) if shot == ident else None
                if f is not None and a <= f <= b:
                    cues.append((t + (f - a) / FPS, e, ident))
            if ident == "train":
                cues.append((t, "train", ident))
            if ident in ("ride", "naka"):
                cues.append((t, "engine", ident))
        segs.append((out, t, dur, kind, ident))
        t += dur
    total = t
    lst = os.path.join(seg_dir, "list.txt")
    with open(lst, "w") as fh:
        fh.writelines(f"file '{p}'\n" for p, *_ in segs)
    silent = os.path.join(OUT, "trailer-video.mp4")
    run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent)

    # --- sound
    n = int(total * SR) + SR
    mix = np.zeros((n, 2), dtype=np.float64)
    # Ambience under each shot, faded in and out with the picture.
    for _, st, dur, kind, ident in segs:
        for k, layer in enumerate(AMBI.get(ident, [])):
            if layer[0] == "sfx":
                place(mix, sfx(layer[1], layer[3]), st + layer[2])
                continue
            x = GEN[layer[0]](dur, 100 + k + len(ident)) * layer[1]
            fade = np.minimum(1, np.minimum(np.arange(len(x)), len(x) - np.arange(len(x))) / (0.35 * SR))
            place(mix, x * fade[:, None], st)
    end = int(total * SR)

    ding, used = chime(), []
    for at, e, ident in cues:
        if e == "doorbell":
            place(mix, ding, at)
        elif e == "firework":
            place(mix, firework(40 + 20 * (len(used) % 4)) * 0.3, at)
        elif e.startswith("v:"):
            p = os.path.join(ROOT, "public/audio/voice", e[2:] + ".mp3")
            if not os.path.exists(p):
                p = os.path.join(ROOT, "tools/trailer/voice", e[2:] + ".mp3")
            if os.path.exists(p):
                place(mix, load(p, 1.15), at)
        elif e == "train":
            seg = next(x for x in segs if x[4] == ident)
            place(mix, train(seg[2]) * 0.7, at)
        elif e == "engine":
            seg = next(s for s in segs if s[4] == ident)
            eng = load(os.path.join(ROOT, "public/audio/sfx/eng_bullet.wav"), 0.6)
            need = int(seg[2] * SR)
            eng = np.tile(eng, (need // len(eng) + 1, 1))[:need]
            env = np.minimum(1, np.minimum(np.arange(need), need - np.arange(need)) / (0.3 * SR))
            # On the brakes at the naka: the thump drops to a tickover.
            brake = next((c[0] for c in cues if c[1] == "mark:brake" and c[2] == ident), None)
            if brake is not None:
                b = int((brake - at) * SR)
                env[b:] *= np.maximum(0.3, 1 - np.arange(need - b) / (1.2 * SR))
            place(mix, eng * env[:, None], at)
        else:
            continue
        used.append((round(at, 2), e))
    print("cues:", used)
    mix = mix[:end]
    # Soft limiter: leave the body alone, round off the peaks (rockets over the music).
    a = np.abs(mix)
    knee = 0.7
    mix = np.where(a > knee, np.sign(mix) * (knee + 0.28 * np.tanh((a - knee) / 0.28)), mix)
    peak = np.abs(mix).max()
    wav = os.path.join(OUT, "trailer-audio.f32")
    mix.astype(np.float32).tofile(wav)
    final = os.path.join(OUT, "gedi-route-trailer.mp4")
    run("ffmpeg", "-y", "-v", "error", "-i", silent, "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", wav,
        "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final)
    print(f"{final} {total:.1f}s peak {peak:.2f}")


if __name__ == "__main__":
    main()
