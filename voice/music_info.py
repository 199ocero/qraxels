"""Find a music track's tempo, first downbeat and drop, so the motivation style can land the drop on the turn.

usage: uv run --project voice python voice/music_info.py <track> [<track> ...]   -> JSON list on stdout
       uv run --project voice python voice/music_info.py --selftest <track> <bpm> <downbeat> <drop>
"""

import json
import sys

import numpy as np
import soundfile as sf


def analyze(path):
    audio, sr = sf.read(path, always_2d=True, dtype="float32")
    x = audio.mean(axis=1)
    if sr > 30000:  # onsets don't need the top octave; halves the work
        x, sr = x[::2], sr // 2
    duration = len(x) / sr

    # Onset strength: positive spectral flux of the log spectrum.
    hop, win = 512, 2048
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win).astype(np.float32)
    mag = np.log1p(np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.concatenate([[0.0], np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)])
    fps = sr / hop

    # Tempo: autocorrelation peak in 70-180 BPM, leaning toward ~120 to avoid half/double picks.
    o = flux - flux.mean()
    ac = np.correlate(o, o, "full")[len(o) - 1 :]
    lags = np.arange(len(ac))
    bpm_of = 60 * fps / np.maximum(lags, 1)
    score = np.where((bpm_of >= 70) & (bpm_of <= 180), ac * np.exp(-0.5 * (np.log2(bpm_of / 120) / 0.9) ** 2), -np.inf)
    lag = int(np.argmax(score))
    if 1 <= lag < len(ac) - 1:  # parabolic refinement
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        lag = lag + 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else lag
    # Refine: a 0.2% tempo error drifts a downbeat by a beat over 100 s, so fit period and phase to the onsets directly.
    def comb(phase, step):
        idx = np.round(np.arange(phase, len(flux), step)).astype(int)
        return flux[idx[idx < len(flux)]].sum()

    beat, phase = max(((p, ph) for p in np.linspace(lag * 0.985, lag * 1.015, 61) for ph in np.arange(0, p, 0.5)), key=lambda c: comb(c[1], c[0]))
    bpm = 60 * fps / beat
    bar_start = max(range(4), key=lambda k: comb(phase + k * beat, 4 * beat))
    latency = win / 2 / hop  # a frame's flux belongs to the middle of its window
    downbeat = (phase + bar_start * beat + latency) / fps

    # Drop: the biggest loudness jump (next 6 s vs previous 6 s) between 12 s and 75% of the track, on a bar line.
    step = sr // 10
    rms = np.sqrt(np.convolve(x**2, np.ones(step) / step, "same")[::step])
    db = 20 * np.log10(rms + 1e-9)
    # A drop goes INTO the loud part: a jump that lands in a section quieter than the track's median scores lower.
    best_t, rise, best = None, 0.0, -np.inf
    median = np.median(db)
    for i in range(120, int(len(db) * 0.75)):
        after = db[i : i + 60].mean()
        r = after - db[max(0, i - 60) : i].mean()
        if r + 0.5 * (after - median) > best:
            best_t, rise, best = i / 10, r, r + 0.5 * (after - median)
    bar = 4 * beat / fps
    drop = None
    if best_t is not None and rise >= 3:  # under 3 dB there's no real drop (a steady piano piece, a loop)
        drop = downbeat + round((best_t - downbeat) / bar) * bar
    # Where the full beat runs: the bar line starting the loudest 8 s, so a video can play at full energy from frame 0.
    full = max(range(0, max(1, int(len(db) * 0.75) - 80)), key=lambda i: db[i : i + 80].mean()) / 10
    start = max(0.0, downbeat + round((full - downbeat) / bar) * bar)
    # Loudness of the loud part (frames within 15 dB of the 95th percentile) and the share of energy in 1-4 kHz.
    loud = db[db > np.percentile(db, 95) - 15]
    level = 10 * np.log10(np.mean(10 ** (loud / 10)))
    freqs = np.fft.rfftfreq(win, 1 / sr)
    power = np.exp(mag) - 1
    mid = 10 * np.log10(power[:, (freqs >= 1000) & (freqs < 4000)].sum() ** 2 / (power.sum() ** 2) + 1e-12) / 2
    f = lambda v, n: None if v is None else round(float(v), n)
    return {"bpm": f(bpm, 2), "downbeat": f(downbeat, 3), "drop": f(drop, 2), "rise_db": f(rise, 1), "duration": f(duration, 1), "level": f(level, 1), "mid": f(mid, 1), "start": f(start, 2)}


def main():
    if sys.argv[1:2] == ["--selftest"]:
        path, bpm, downbeat, drop = sys.argv[2], *map(float, sys.argv[3:6])
        r = analyze(path)
        beat = 60 / bpm
        assert abs(r["bpm"] - bpm) < 1.5, r
        # downbeat may land on any bar line of the true grid
        assert min(abs(((r["downbeat"] - downbeat) / beat) % 4), 4 - abs(((r["downbeat"] - downbeat) / beat) % 4)) < 0.25, r
        # within two bars: tracks often have neighbouring drop candidates (arrange.py lists both on the test tracks)
        assert r["drop"] is not None and abs(r["drop"] - drop) < 8 * beat + 0.1, r
        print("ok", r)
        return
    print(json.dumps([{"file": p, **analyze(p)} for p in sys.argv[1:]]))


if __name__ == "__main__":
    main()
