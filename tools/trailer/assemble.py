"""Cut the trailer: python3 tools/trailer/assemble.py → tools/out/trailer/gedi-route-trailer.mp4

Shots come from tools/out/trailer/<shot>/NNNN.jpg (tools/trailer/shot.mjs), cards from cards/<id>.png
(tools/trailer/cards.mjs). The sound is the game's own: the bhangra station off the synth radio as the bed, and
on top, at the frame the game made them, the doorbell chime, the voice clips and the fireworks (each shot's
heard.json), plus the Bullet's engine under the ride.
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tools/out/trailer")
FPS, SR = 30, 48000

# (kind, id, seconds or [first frame, last frame], extra)
TIMELINE = [
    ("card", "place", 2.6),
    ("shot", "dawn", [0, 149]),
    ("shot", "bazaar", [0, 149]),
    ("card", "gali", 2.2),
    ("shot", "holi", [0, 119]),
    ("shot", "ride", [0, 179]),
    ("shot", "train", [0, 179]),
    ("card", "bell", 2.6),
    ("shot", "doorbell", [0, 329]),
    ("card", "year", 2.2),
    ("shot", "diwali", [0, 164]),
    ("shot", "lohri", [0, 134]),
    ("shot", "teeyan", [0, 134]),
    ("shot", "cricket", [0, 149]),
    ("shot", "factory", [0, 134]),
    ("card", "logo", 5.0),
]
# Lower-third subtitles burnt over a shot: (shot, from frame, to frame, card id in cards/).
SUBS = [("doorbell", 196, 252, "sub-jaggi"), ("doorbell", 256, 329, "sub-aunty")]
# Lines laid in by hand from the game's own recordings (shot, frame, sound): the greeting at the gate.
CUES = [("doorbell", 196, "v:player_ssa_m"), ("doorbell", 256, "v:v2_gate_03")]


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
            for shot, f0, f1, card in SUBS:
                if shot == ident:
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
            heard = os.path.join(src, "heard.json")
            if os.path.exists(heard):
                for f, e in json.load(open(heard))["heard"]:
                    if a <= f <= b:
                        cues.append((t + (f - a) / FPS, e, ident))
            cues += [(t + (f - a) / FPS, e, ident) for shot, f, e in CUES if shot == ident and a <= f <= b]
            if ident == "train":
                cues.append((t, "train", ident))
            if ident == "ride":
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
    music = load(os.path.join(ROOT, "tools/out/radio-bhangra.wav"))
    bed = np.zeros_like(mix)
    bed[: min(n, len(music))] = music[:n]
    gain = np.full(n, 3.2)
    # Duck the music under the doorbell scene so the chime and the voice carry.
    for _, st, dur, kind, ident in segs:
        if ident == "doorbell":
            s, e = int(st * SR), int((st + dur) * SR)
            ramp = int(0.6 * SR)
            gain[s:e] = 1.5
            gain[s - ramp:s] = np.linspace(3.2, 1.5, ramp)
            gain[e:e + ramp] = np.linspace(1.5, 3.2, ramp)
    # Fade in, and out over the logo.
    gain[: int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))
    tail = int(3.0 * SR)
    end = int(total * SR)
    gain[end - tail:end] *= np.linspace(1, 0, tail)
    gain[end:] = 0
    mix += bed * gain[:, None]

    ding, used = chime(), []
    for at, e, ident in cues:
        if e == "doorbell":
            place(mix, ding, at)
        elif e == "firework":
            place(mix, firework(40 + 20 * (len(used) % 4)) * 0.3, at)
        elif e.startswith("v:"):
            p = os.path.join(ROOT, "public/audio/voice", e[2:] + ".mp3")
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
