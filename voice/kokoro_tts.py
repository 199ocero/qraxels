"""Narrate scenes.json with Kokoro and write voice.wav + words.json + timings.json.

usage: uv run --project voice python voice/kokoro_tts.py <scenes.json> <out_dir> [voice] [punch]
       uv run --project voice python voice/kokoro_tts.py --warmup
"""

import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402

RATE = 24000
WORDY = re.compile(r"[A-Za-z0-9]")


def pipeline():
    from kokoro import KPipeline

    return KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")


def narrate(scenes, voice, pipe):
    chunks, words, timings = [], [], []
    t = 0.0  # running time in seconds
    for i, scene in enumerate(scenes):
        start = t
        for result in pipe(scene["narration"], voice=voice, speed=float(scene.get("speed", 1.0))):
            audio = result.audio.numpy() if hasattr(result.audio, "numpy") else np.asarray(result.audio)
            for tok in result.tokens or []:
                text = tok.text.strip()
                if not text:
                    continue
                if not WORDY.search(text):
                    # Punctuation sticks to the previous word for captions.
                    if words and words[-1]["scene"] == i:
                        words[-1]["word"] += text
                    continue
                if tok.start_ts is None or tok.end_ts is None:
                    continue
                words.append({"word": text, "start": round(t + tok.start_ts, 3), "end": round(t + tok.end_ts, 3), "scene": i})
            chunks.append(audio)
            t += len(audio) / RATE
        pause = float(scene.get("pause_after", 0.3))
        chunks.append(np.zeros(int(pause * RATE), dtype=np.float32))
        t += pause
        timings.append({"start": round(start, 3), "end": round(t, 3)})
    return np.concatenate(chunks), words, timings


def check(audio, words, timings):
    total = len(audio) / RATE
    for a, b in zip(words, words[1:]):
        assert b["start"] >= a["start"], f"timestamps go backwards at {b}"
    assert not words or words[-1]["end"] <= total + 0.05, "last word ends after the audio"
    assert all(t["end"] > t["start"] for t in timings), "empty scene"


SPEECH_DBFS = -20.0  # remotion/mono.ts VOICE_LEVEL: the music is mixed relative to this


def level(audio):
    """Speech at SPEECH_DBFS (RMS of the active 50 ms frames), so music can be mixed relative to it; the rare peaks this
    pushes past -4 dBFS are rounded off smoothly below -1 dBFS instead of clipping."""
    n = int(RATE * 0.05)
    frames = audio[: len(audio) // n * n].reshape(-1, n)
    db = 10 * np.log10((frames**2).mean(axis=1) + 1e-12)
    active = db[db > db.max() - 30]
    gain = 10 ** ((SPEECH_DBFS - 10 * np.log10(np.mean(10 ** (active / 10)))) / 20)
    y = audio * gain
    knee, ceil = 0.63, 0.89
    over = np.abs(y) > knee
    y[over] = np.sign(y[over]) * (knee + (ceil - knee) * np.tanh((np.abs(y[over]) - knee) / (ceil - knee)))
    assert np.abs(y).max() <= ceil + 1e-6, "voice peaks past the ceiling"
    return y.astype(np.float32)


def punch(audio):
    """A forward, dense voiceover: 3:1 compression above -24 dBFS on a 10 ms envelope (fast attack, ~80 ms release) and a
    +3 dB presence lift around 3.2 kHz. Used for the motivation style; call level() before and after."""
    n = int(RATE * 0.01)
    frames = audio[: len(audio) // n * n].reshape(-1, n)
    reduce = -np.maximum(0, 10 * np.log10((frames**2).mean(axis=1) + 1e-12) + 24) * (1 - 1 / 3)
    smooth, g = np.empty_like(reduce), 0.0
    for i, r in enumerate(reduce):
        g = r if r < g else g + (r - g) * 0.12
        smooth[i] = g
    centers = (np.arange(len(smooth)) + 0.5) * n
    y = audio * 10 ** (np.interp(np.arange(len(audio)), centers, smooth) / 20)
    spec = np.fft.rfft(y)
    f = np.maximum(np.fft.rfftfreq(len(y), 1 / RATE), 1)
    spec *= 10 ** (3 * np.exp(-0.5 * (np.log2(f / 3200) / 0.6) ** 2) / 20)
    y = np.fft.irfft(spec, len(y)).astype(np.float32)
    assert y.shape == audio.shape and np.isfinite(y).all(), "punch broke the audio"
    return y


def studio(y):
    """Voiceover EQ (dB): rumble cut under 70 Hz, +2 chest warmth at 150 Hz, -3 box at 400 Hz, +3 presence at 3.5 kHz,
    +4 air shelf from 8 kHz. Replaces the old chest cut + 2.6 kHz honk + tanh grit, which read as thin and phone-like."""
    bell = lambda f, hz, db, w: db * np.exp(-0.5 * (np.log2(f / hz) / w) ** 2)  # noqa: E731
    f = np.maximum(np.fft.rfftfreq(len(y), 1 / RATE), 1)
    shape = 10 * np.log10(1 / (1 + (70 / f) ** 4)) + bell(f, 150, 2, 0.8) + bell(f, 400, -3, 0.7) + bell(f, 3500, 3, 0.8) + 4 / (1 + (8000 / f) ** 4)
    return np.fft.irfft(np.fft.rfft(y) * 10 ** (shape / 20), len(y)).astype(np.float32)


def rage(audio, words, timings, faster=1.06):
    """A fast, forward shout that still sounds like a studio read: 6% faster (~1 semitone higher), studio() EQ, then
    punch() compression. Word and scene times are rescaled."""
    y = np.interp(np.arange(0, len(audio) - 1, faster), np.arange(len(audio)), audio).astype(np.float32)
    y = level(punch(level(studio(y))))
    s = lambda t: round(t / faster, 3)  # noqa: E731
    words = [{**w, "start": s(w["start"]), "end": s(w["end"])} for w in words]
    timings = [{"start": s(t["start"]), "end": s(t["end"])} for t in timings]
    check(y, words, timings)
    return level(y), words, timings


def main():
    if sys.argv[1:] == ["--warmup"]:
        pipe = pipeline()
        audio, words, timings = narrate([{"narration": "Hello from the office."}], "af_heart", pipe)
        check(audio, words, timings)
        print(f"kokoro ready ({len(words)} words, {len(audio) / RATE:.1f}s)")
        return
    scenes_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
    forward = sys.argv[4:5] == ["punch"]
    scenes = json.loads(scenes_path.read_text())["scenes"]
    audio, words, timings = narrate(scenes, voice, pipeline())
    check(audio, words, timings)
    out_dir.mkdir(parents=True, exist_ok=True)
    if sys.argv[4:5] == ["rage"]:
        audio, words, timings = rage(audio, words, timings)
    else:
        audio = level(punch(level(audio))) if forward else level(audio)
    sf.write(out_dir / "voice.wav", audio, RATE)
    (out_dir / "words.json").write_text(json.dumps(words))
    (out_dir / "timings.json").write_text(json.dumps(timings))
    print(json.dumps({"seconds": round(len(audio) / RATE, 2), "words": len(words)}))


if __name__ == "__main__":
    main()
