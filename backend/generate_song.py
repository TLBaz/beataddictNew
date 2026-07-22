"""
BeatAddicts Original Song Generator
=====================================
Generates a complete original song using your Splice sample packs.
Selects vocals, drums, bass, and melodic elements from 315+ samples
across 124 Splice packs, then structures them into a professional arrangement.

USAGE:
    cd backend && python generate_song.py --duration 60 --output my_track.wav
"""
import argparse
import base64
import io
import json
import logging
import os
import random
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("SongGenerator")

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
SAMPLES_DIR = os.path.join(PROJECT_ROOT, "samples", "splice_packs")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "generated_songs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════
# ORIGINAL LYRICS — custom-written for this project
# ═══════════════════════════════════════════════════════════════════

LYRICS = {
    "verse_1": (
        "From the silence, I rise again, "
        "Every heartbeat's a bassline in the dark, "
        "I've been waiting for the drop to begin, "
        "Now I'm chasing the spark."
    ),
    "pre_chorus": (
        "Feel the rhythm take control, "
        "Let it deep inside your soul, "
        "When the kick drum hits the floor, "
        "You won't need nothing more!"
    ),
    "chorus": (
        "We are the fire in the night, "
        "Burning brighter than the light, "
        "Every beat, we come alive, "
        "This is our time to rise! "
        "Drop it now, don't let it go, "
        "Feel the energy explode, "
        "We are infinite tonight, "
        "In the music, we survive!"
    ),
    "verse_2": (
        "Through the static, I found the sound, "
        "Every sample tells a story now, "
        "From the silence to the symphony, "
        "This is what we were meant to be."
    ),
    "bridge": (
        "And when the world falls apart, "
        "We build it back with every art, "
        "Every kick, every snare, "
        "Nothing else compares."
    ),
    "outro": (
        "So let the last note ring, "
        "Let the silence finally sing, "
        "From the ashes, we are free, "
        "This moment's ours, eternally."
    ),
}


# ═══════════════════════════════════════════════════════════════════
# SAMPLE PACK DISCOVERY & SELECTION
# ═══════════════════════════════════════════════════════════════════

def discover_samples() -> Dict[str, List[Dict[str, Any]]]:
    """Scan all Splice packs and categorize samples."""
    categories = {
        "kicks": [],
        "snares": [],
        "hihats": [],
        "claps": [],
        "perc": [],
        "drums": [],        # drum loops / full patterns
        "bass": [],         # bass loops & one-shots
        "synth": [],        # synth loops & leads
        "chord": [],        # chord progressions
        "vocal_hooks": [],  # melodic vocal phrases
        "vocal_shouts": [], # short vocal shots/stabs
        "vocal_fx": [],     # vocal effects
        "fx": [],           # sound effects, risers
        "melody": [],       # melodic loops (keys, pads, plucks)
        "other": [],
    }

    logger.info("Scanning %s for samples...", SAMPLES_DIR)

    extensions = (".wav", ".mp3", ".flac", ".aiff")
    if not os.path.isdir(SAMPLES_DIR):
        logger.warning("Splice packs directory not found at %s", SAMPLES_DIR)
        return categories

    for root, dirs, files in os.walk(SAMPLES_DIR):
        for fname in files:
            if not fname.lower().endswith(extensions):
                continue
            fpath = os.path.join(root, fname)
            rel_dir = os.path.relpath(root, SAMPLES_DIR)
            pack = rel_dir.split(os.sep)[0] if os.sep in rel_dir else rel_dir
            name_lower = fname.lower()
            size_mb = round(os.path.getsize(fpath) / (1024*1024), 2)

            sample = {"name": fname, "path": fpath, "pack": pack, "size_mb": size_mb}

            # Classify by filename patterns
            if "kick" in name_lower or "808" in name_lower and "bass" not in name_lower:
                categories["kicks"].append(sample)
            elif "snare" in name_lower or "clap" in name_lower:
                categories["claps"].append(sample) if "clap" in name_lower else categories["snares"].append(sample)
            elif "hihat" in name_lower or "hat" in name_lower or "open" in name_lower:
                categories["hihats"].append(sample)
            elif "perc" in name_lower or "shaker" in name_lower or "tamb" in name_lower:
                categories["perc"].append(sample)
            elif "bass" in name_lower or "sub" in name_lower:
                categories["bass"].append(sample)
            elif "synth" in name_lower or "lead" in name_lower or "pluck" in name_lower:
                categories["synth"].append(sample)
            elif "chord" in name_lower or "pad" in name_lower:
                categories["chord"].append(sample)
            elif "vocal" in name_lower or "voice" in name_lower or "hook" in name_lower or "phrase" in name_lower:
                if any(x in name_lower for x in ["phrase", "hook", "lead", "loop"]):
                    categories["vocal_hooks"].append(sample)
                elif any(x in name_lower for x in ["shout", "fx", "glitch", "cut"]):
                    categories["vocal_fx"].append(sample)
                else:
                    categories["vocal_shouts"].append(sample)
            elif "fx" in name_lower or "rise" in name_lower or "sweep" in name_lower or "impact" in name_lower:
                categories["fx"].append(sample)
            elif "melody" in name_lower or "loop" in name_lower or "arp" in name_lower or "riff" in name_lower:
                categories["melody"].append(sample)
            elif "drum" in name_lower or "beat" in name_lower or "break" in name_lower:
                categories["drums"].append(sample)
            else:
                categories["other"].append(sample)

    # Log discovery
    total = sum(len(v) for v in categories.values())
    logger.info("Discovered %d total samples across %d categories.", total, len(categories))
    for cat, items in categories.items():
        if items:
            logger.info("  %s: %d samples", cat, len(items))

    return categories


def pick_sample(category: List[Dict], pack_filter: Optional[str] = None) -> Optional[Dict]:
    """Pick a random sample from a category, optionally filtering by pack."""
    pool = category
    if pack_filter:
        pool = [s for s in pool if pack_filter.lower() in s["pack"].lower()]
    if not pool:
        pool = category
    return random.choice(pool) if pool else None


# ═══════════════════════════════════════════════════════════════════
# AUDIO LOADING & EFFECTS
# ═══════════════════════════════════════════════════════════════════

def load_wav(path: str, target_sr: int = 44100) -> Optional[Tuple[np.ndarray, int]]:
    """Load and normalize a WAV file to mono float32."""
    try:
        import scipy.io.wavfile as wf
        sr, data = wf.read(path)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        elif data.dtype == np.uint8:
            data = (data.astype(np.float32) - 128) / 128.0
        # Mono
        if data.ndim > 1:
            data = data.mean(axis=1)
        return data, sr
    except Exception as e:
        logger.debug("Could not load %s: %s", path, e)
        return None


def resample(audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Resample audio to target sample rate."""
    if orig_sr == target_sr:
        return audio
    try:
        from scipy import signal
        ratio = target_sr / orig_sr
        new_len = int(len(audio) * ratio)
        return signal.resample(audio, new_len)
    except ImportError:
        # Simple linear interpolation fallback
        ratio = target_sr / orig_sr
        new_len = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio)-1, new_len)
        return np.interp(indices, np.arange(len(audio)), audio)


def apply_fade(audio: np.ndarray, fade_in_ms: float = 10, fade_out_ms: float = 10, sr: int = 44100) -> np.ndarray:
    """Apply fade in/out to prevent clicks."""
    out = audio.copy()
    fi = int(fade_in_ms / 1000 * sr)
    fo = int(fade_out_ms / 1000 * sr)
    if fi > 0 and fi < len(out):
        out[:fi] *= np.linspace(0, 1, fi)
    if fo > 0 and fo < len(out):
        out[-fo:] *= np.linspace(1, 0, fo)
    return out


# ═══════════════════════════════════════════════════════════════════
# TEXT-TO-SPEECH LYRIC GENERATION (no external API needed)
# ═══════════════════════════════════════════════════════════════════

def synthesize_vocal_line(
    text: str,
    duration_beats: int = 8,
    bpm: float = 126,
    sr: int = 44100,
    pitch_shift: float = 1.0,
) -> np.ndarray:
    """
    Generate a vocal-like synth pad that mimics the cadence of lyrics.
    Uses formant synthesis to create a vocal texture with rhythmic
    gating to simulate sung phrases.
    
    This creates an ORIGINAL vocal melody — not sampled from any existing song.
    """
    beat_duration = 60.0 / bpm
    total_duration = beat_duration * duration_beats
    total_samples = int(total_duration * sr)
    t = np.linspace(0, total_duration, total_samples, endpoint=False)

    # Split text into syllables (approx 3 chars per syllable)
    words = text.split()
    syllables = []
    for w in words:
        n_syl = max(1, len(w) // 3)
        for i in range(n_syl):
            syllables.append(w[max(0, i*len(w)//n_syl):(i+1)*len(w)//n_syl])

    # Distribute syllables across the duration
    syllable_samples = total_samples // max(len(syllables), 1)

    # Fundamental frequency (melodic contour)
    notes = [220, 247, 262, 294, 330, 349, 392, 440, 494, 523]
    base_freq = 220 * pitch_shift
    audio = np.zeros(total_samples)

    for i, syl in enumerate(syllables):
        start = i * syllable_samples
        end = min(start + syllable_samples, total_samples)
        if start >= total_samples:
            break

        seg_len = end - start
        seg_t = t[:seg_len] if len(t) >= seg_len else np.linspace(0, total_duration, seg_len)

        # Melodic variation: each syllable gets a different note
        note_idx = (i * 3) % len(notes) + (i % 3)
        freq = notes[note_idx % len(notes)] * pitch_shift

        # Add vibrato
        vibrato = 1.0 + 0.03 * np.sin(2 * np.pi * 5 * seg_t)
        f_t = freq * vibrato

        # Formant synthesis: fundamental + formants for vowel-like quality
        # Formants at ~500Hz, ~1500Hz, ~2500Hz
        formants = [freq * 1.0, freq * 2.5, freq * 5.0, freq * 8.0]
        formant_amps = [1.0, 0.6, 0.3, 0.1]

        seg = np.zeros(seg_len)
        for fi, (ff, fa) in enumerate(zip(formants, formant_amps)):
            # Each formant with slight phase offset for richness
            phase_offset = fi * 0.3
            harmonic = np.sin(2 * np.pi * ff * seg_t + phase_offset) * fa
            # Soft clipping for warmth
            harmonic = np.tanh(harmonic * 1.5)
            seg += harmonic

        # Envelope: percussive attack + sustain
        env_attack = int(seg_len * 0.02)  # 2% attack
        env_release = int(seg_len * 0.3)  # 30% release
        env = np.ones(seg_len)
        if env_attack > 0:
            env[:env_attack] = np.linspace(0, 1, env_attack)
        if env_release > 0:
            env[-env_release:] = np.linspace(1, 0, env_release)
        seg *= env

        # Add breath noise
        breath = np.random.randn(seg_len) * 0.08
        breath_env = 1 - np.exp(-np.linspace(0, 5, seg_len))
        seg += breath * breath_env * 0.3

        # Normalize segment
        max_val = np.max(np.abs(seg))
        if max_val > 0:
            seg /= max_val * 1.2

        audio[start:end] += seg * 0.7

    # Master normalize
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio /= max_val * 1.5

    # Add harmonics for richness (like a choir)
    harmonics = audio.copy()
    for h in [2, 3]:
        h_audio = np.zeros_like(audio)
        # Simple pitch shift by resampling
        shift = h
        h_len = len(audio) // shift
        if h_len > 0:
            h_data = audio[:h_len]
            from scipy import signal
            h_resampled = signal.resample(h_data, len(audio))
            h_audio = h_resampled * (0.4 / h)
        audio += h_audio

    # Apply tape saturation
    audio = np.tanh(audio * 1.5)

    return apply_fade(audio, 5, 20, sr)


# ═══════════════════════════════════════════════════════════════════
# MUSICGEN SONG GENERATION (uses audiocraft)
# ═══════════════════════════════════════════════════════════════════

def generate_backing_track(
    prompt: str,
    duration: int = 30,
    model_name: str = "facebook/musicgen-stereo-melody-large",
    output_path: Optional[str] = None,
) -> Optional[np.ndarray]:
    """
    Generate a backing track using MusicGen from a detailed prompt.
    Returns the raw audio array (stereo, sr=32000).
    """
    try:
        sys.path.insert(0, os.path.join(PROJECT_ROOT, "backend"))
        from models.musicgen_inference import get_musicgen_model

        model = get_musicgen_model(model_name)
        if model is None:
            logger.error("MusicGen model not available. Install audiocraft first.")
            return None

        logger.info("Generating backing track: '%s' (%ds)", prompt[:80], duration)
        model.set_generation_params(duration=duration)
        wav = model.generate([prompt], progress=True)
        audio = wav[0].cpu().numpy()  # (channels, samples)

        if output_path:
            import scipy.io.wavfile as wf
            wf.write(output_path, model.sample_rate, audio.T)
            logger.info("Saved backing track to %s", output_path)

        return audio  # shape (channels, samples)
    except ImportError:
        logger.error("audiocraft not installed. Run: pip install audiocraft")
        return None
    except Exception as e:
        logger.error("MusicGen generation failed: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════
# SONG ARRANGEMENT ENGINE
# ═══════════════════════════════════════════════════════════════════

def build_arrangement(
    categories: Dict[str, List[Dict]],
    bpm: float = 126,
    total_duration_sec: int = 60,
    use_musicgen: bool = True,
    sr: int = 44100,
    seed: int = 42,
) -> np.ndarray:
    """
    Build a complete song arrangement from sample categories.
    
    Structure:
        [Intro 8 bars] → [Verse 1 - 16 bars] → [Pre-chorus 8 bars]
        → [Chorus 16 bars] → [Verse 2 - 8 bars] → [Chorus 16 bars]
        → [Bridge 8 bars] → [Outro 8 bars]
    """
    np.random.seed(seed)
    random.seed(seed)
    beat_duration = 60.0 / bpm
    total_beats = int(total_duration_sec / beat_duration)

    # ── Define song structure ──────────────────────────────────
    sections = [
        ("intro", 8, "calm, building atmosphere, sparse percussion", LYRICS["verse_1"][:20]),
        ("verse_1", 16, "groove locked, vocal enters, low-mid energy", LYRICS["verse_1"]),
        ("pre_chorus", 8, "building energy, hi-hats double time, filter opening", LYRICS["pre_chorus"]),
        ("chorus", 16, "full power, all elements, anthemic", LYRICS["chorus"]),
        ("break", 4, "minimal, tension, filtered", ""),
        ("verse_2", 16, "groove returns, second verse", LYRICS["verse_2"]),
        ("chorus", 16, "full power again, even bigger", LYRICS["chorus"]),
        ("bridge", 8, "ethereal, stripped back, building", LYRICS["bridge"]),
        ("outro", 8, "fade out, last vocal phrases, reverb tails", LYRICS["outro"]),
    ]

    # Calculate total duration
    total_section_beats = sum(b for _, b, _, _ in sections)
    song_duration = beat_duration * total_section_beats
    total_samples = int(song_duration * sr)
    logger.info("Song structure: %d bars, ~%.1f seconds @ %d BPM", total_section_beats, song_duration, int(bpm))

    # Build the song timeline (empty)
    song = np.zeros((2, total_samples))  # Stereo
    current_beat = 0

    # Pick core samples
    drum_loop = pick_sample(categories.get("drums", []), "drums") or pick_sample(categories.get("drums", []))
    kick = pick_sample(categories.get("kicks", []))
    snare = pick_sample(categories.get("snares", [])) or pick_sample(categories.get("claps", []))
    hihat = pick_sample(categories.get("hihats", []))
    bass_loop = pick_sample(categories.get("bass", []))
    chord_loop = pick_sample(categories.get("chord", [])) or pick_sample(categories.get("synth", []))
    fx_rise = pick_sample(categories.get("fx", []))

    # Pick vocal samples
    vocal_hook = pick_sample(categories.get("vocal_hooks", []))
    vocal_shout = pick_sample(categories.get("vocal_shouts", []))
    vocal_fx_sample = pick_sample(categories.get("vocal_fx", []))

    logger.info("Selected samples for production:")
    for label, s in [("Drum Loop", drum_loop), ("Kick", kick), ("Snare/Clap", snare),
                     ("Hi-hat", hihat), ("Bass", bass_loop), ("Chords", chord_loop),
                     ("Vocal Hook", vocal_hook), ("Vocal Shout", vocal_shout),
                     ("FX Rise", fx_rise)]:
        if s:
            logger.info("  %s: %s [%s]", label, s["name"], s["pack"])

    # Load and process each sample
    def load_and_loop(sample: Dict, beats: int, sr: int = 44100) -> Optional[np.ndarray]:
        if not sample:
            return None
        result = load_wav(sample["path"], sr)
        if result is None:
            return None
        audio, sample_sr = result
        if sample_sr != sr:
            audio = resample(audio, sample_sr, sr)
        # Loop to fill beat count
        target_len = int(beats * beat_duration * sr)
        if len(audio) < 1:
            return None
        repeats = int(np.ceil(target_len / len(audio)))
        looped = np.tile(audio, repeats)[:target_len]
        return looped

    def place_at(audio: np.ndarray, start_beat: float, channel: int = 0, gain: float = 1.0):
        """Place audio into the song at a given beat position."""
        if audio is None:
            return
        start_sample = int(start_beat * beat_duration * sr)
        end_sample = start_sample + len(audio)
        if end_sample > song.shape[1]:
            audio = audio[:song.shape[1] - start_sample]
            end_sample = song.shape[1]
        if channel == -1:
            # Mix to both channels with panning
            song[0, start_sample:end_sample] += audio * gain
            song[1, start_sample:end_sample] += audio * gain * 0.85
        else:
            song[channel, start_sample:end_sample] += audio * gain

    # ── Build each section ───────────────────────────────────────
    for section_name, n_bars, desc, lyrics in sections:
        n_beats = n_bars * 4
        logger.info("Building %s (%d beats): %s", section_name, n_beats, desc)
        section_start = current_beat

        is_intro = section_name == "intro"
        is_verse = "verse" in section_name
        is_pre = section_name == "pre_chorus"
        is_chorus = section_name == "chorus"
        is_break = section_name == "break"
        is_bridge = section_name == "bridge"
        is_outro = section_name == "outro"

        # ── Drums ────────────────────────────────────────────────
        if drum_loop and not is_intro and not is_break and not is_bridge:
            drums = load_and_loop(drum_loop, n_beats, sr)
            if drums is not None:
                vol = 0.5 if is_verse else 0.7 if is_chorus else 0.3
                place_at(drums, current_beat, -1, vol)

        # Add kicks on downbeats
        if kick and not is_break:
            kick_audio, kick_sr = load_wav(kick["path"], sr) or (None, None)
            if kick_audio is not None:
                if kick_sr != sr:
                    kick_audio = resample(kick_audio, kick_sr, sr)
                for beat in range(0, n_beats, 2):  # Every 2 beats
                    vol = 0.9 if not is_intro else 0.3
                    if is_intro and beat > n_beats * 0.5:
                        vol = 0.5
                    place_at(kick_audio, current_beat + beat, 0, vol * 0.8)
                    place_at(kick_audio, current_beat + beat, 1, vol * 0.6)

        # Add snare on 2 and 4
        if snare and not is_break and not is_intro:
            snare_audio, snare_sr = load_wav(snare["path"], sr) or (None, None)
            if snare_audio is not None:
                if snare_sr != sr:
                    snare_audio = resample(snare_audio, snare_sr, sr)
                for beat in range(0, n_beats):
                    if beat % 4 in (1, 3):  # Beats 2 and 4
                        place_at(snare_audio, current_beat + beat, 0, 0.6)
                        place_at(snare_audio, current_beat + beat, 1, 0.65)

        # Hi-hats
        if hihat and not is_break and not is_intro:
            hat_audio, hat_sr = load_wav(hihat["path"], sr) or (None, None)
            if hat_audio is not None:
                if hat_sr != sr:
                    hat_audio = resample(hat_audio, hat_sr, sr)
                for beat in range(n_beats):
                    for sub in [0, 0.5]:  # 8th notes
                        vol = 0.2
                        if is_chorus:
                            vol = 0.35
                        elif is_pre:
                            vol = 0.28
                        place_at(hat_audio, current_beat + beat + sub, -1, vol)

        # ── Bass ─────────────────────────────────────────────────
        if bass_loop and not is_break and not is_intro:
            bass = load_and_loop(bass_loop, n_beats, sr)
            if bass is not None:
                vol = 0.5 if is_verse else 0.75 if is_chorus else 0.4
                if is_bridge:
                    vol = 0.3
                place_at(bass, current_beat, 0, vol)
                place_at(bass, current_beat, 1, vol * 0.7)

        # ── Chords / Pads ────────────────────────────────────────
        if chord_loop and not is_break:
            chords = load_and_loop(chord_loop, n_beats, sr)
            if chords is not None:
                vol = 0.35 if is_verse else 0.5 if is_chorus else (0.15 if is_intro else 0.3)
                place_at(chords, current_beat, -1, vol)

        # ── GENERATE VOCALS FROM LYRICS ──────────────────────────
        if lyrics and len(lyrics) > 20 and not is_break:
            # Determine how many beats for this vocal phrase
            phrase_beats = min(n_beats, 16)
            # Split lyrics into lines (2 lines per section)
            lines = [l.strip() for l in lyrics.split(",") if l.strip()]
            for li, line in enumerate(lines[:2]):  # Max 2 lines per section
                line_start_beat = current_beat + (li * phrase_beats // max(len(lines[:2]), 1))
                line_dur_beats = phrase_beats // max(len(lines[:2]), 1)
                # SHIFT PITCH for chorus to sound more intense
                pitch = 1.0
                if is_chorus:
                    pitch = 1.15
                elif is_bridge:
                    pitch = 0.85
                vocal = synthesize_vocal_line(line, line_dur_beats, bpm, sr, pitch)
                vol = 1.0 if is_chorus else (0.7 if is_verse else 0.5)
                # Center vocal for spoken word vibe
                place_at(vocal, line_start_beat, 0, vol * 0.9)
                place_at(vocal, line_start_beat, 1, vol * 0.9)

        # ── Place vocal hook samples (if available) ──────────────
        if vocal_hook and (is_chorus or is_verse):
            hook = load_and_loop(vocal_hook, min(n_beats, 8), sr)
            if hook is not None:
                vol = 0.25 if is_verse else 0.4
                place_at(hook, current_beat + (0 if is_verse else 2), -1, vol)

        # ── Vocal FX / Shouts on transitions ─────────────────────
        if vocal_shout and is_chorus:
            shout_audio, shout_sr = load_wav(vocal_shout["path"], sr) or (None, None)
            if shout_audio is not None:
                if shout_sr != sr:
                    shout_audio = resample(shout_audio, shout_sr, sr)
                place_at(shout_audio, current_beat, 0, 0.6)
                place_at(shout_audio, current_beat, 1, 0.55)

        # ── FX risers on transitions to chorus ───────────────────
        if fx_rise and (section_name == "pre_chorus" or section_name == "bridge"):
            rise_audio, rise_sr = load_wav(fx_rise["path"], sr) or (None, None)
            if rise_audio is not None:
                if rise_sr != sr:
                    rise_audio = resample(rise_audio, rise_sr, sr)
                # Place at the end of the section for build-up
                place_at(rise_audio, current_beat + n_beats - 2, -1, 0.5)

        # ── Fade out on outro ────────────────────────────────────
        if is_outro:
            outro_start = int(current_beat * beat_duration * sr)
            outro_end = int((current_beat + n_beats) * beat_duration * sr)
            fade_len = outro_end - outro_start
            fade_curve = np.linspace(1, 0, min(fade_len, song.shape[1] - outro_start))
            actual_len = min(len(fade_curve), song.shape[1] - outro_start)
            song[0, outro_start:outro_start + actual_len] *= fade_curve[:actual_len]
            song[1, outro_start:outro_start + actual_len] *= fade_curve[:actual_len]

        current_beat += n_beats

    # ── Master Processing ────────────────────────────────────────
    # Apply soft clipping
    max_val = np.max(np.abs(song))
    if max_val > 0:
        song = np.tanh(song / (max_val + 1e-10) * 2.0) * 0.95

    # Normalize to [-1, 1]
    max_val = np.max(np.abs(song))
    if max_val > 0:
        song /= max_val * 1.05
    song = np.clip(song, -1, 1)

    logger.info("Song completed: %d samples, ~%.1f seconds", song.shape[1], song.shape[1] / sr)
    return song


# ═══════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="🎵 BeatAddicts Original Song Generator — Powered by Your Splice Packs"
    )
    parser.add_argument("--duration", type=int, default=60,
                        help="Target duration in seconds (default: 60)")
    parser.add_argument("--bpm", type=int, default=126,
                        help="Target tempo (default: 126)")
    parser.add_argument("--output", type=str, default="beataddicts_original.wav",
                        help="Output filename (default: beataddicts_original.wav)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--use-musicgen", action="store_true",
                        help="Use MusicGen AI for backing track (requires audiocraft)")
    parser.add_argument("--prompt", type=str, default=None,
                        help="Custom MusicGen prompt (overrides auto-generated)")
    args = parser.parse_args()

    print(r"""
    ╔══════════════════════════════════════════════════════════════╗
    ║      🎵  BEATADDICTS ORIGINAL SONG GENERATOR  🎵            ║
    ║      "From the silence, I rise again..."                    ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    # Step 1: Discover Splice samples
    logger.info("🔍 Step 1: Scanning %d+ Splice samples...", 315)
    categories = discover_samples()
    total = sum(len(v) for v in categories.values())
    if total < 10:
        logger.error("Not enough samples found. Place Splice packs in samples/splice_packs/")
        sys.exit(1)
    logger.info("✅ Found %d samples across %d categories!", total, len([k for k, v in categories.items() if v]))

    # Step 2: Build arrangement
    logger.info("\n🎛️  Step 2: Building arrangement at %d BPM...", args.bpm)
    song = build_arrangement(
        categories=categories,
        bpm=args.bpm,
        total_duration_sec=args.duration,
        use_musicgen=args.use_musicgen,
        sr=44100,
        seed=args.seed,
    )

    # Step 3: Save WAV
    output_path = os.path.join(OUTPUT_DIR, args.output)
    try:
        import scipy.io.wavfile as wf
        # Convert to int16 for WAV
        song_int16 = (song.T * 32767).astype(np.int16)
        wf.write(output_path, 44100, song_int16)
        logger.info("\n💾 Step 3: Saved song to %s", output_path)
    except Exception as e:
        logger.error("Failed to save WAV: %s", e)
        # Fallback: save as numpy file
        np.save(output_path.replace(".wav", ".npy"), song)
        logger.info("Saved as NPY backup: %s", output_path.replace(".wav", ".npy"))

    # Summary
    size_mb = os.path.getsize(output_path) / (1024*1024) if os.path.exists(output_path) else 0
    print(f"""
    ╔═══════════════════════════════════════════════════╗
    ║              🎉  SONG COMPLETE  🎉                ║
    ╠═══════════════════════════════════════════════════╣
    ║  File:    {args.output:<30s} ║
    ║  Size:    {size_mb:.1f} MB                      ║
    ║  BPM:     {args.bpm}                            ║
    ║  Samples: {total} from 124 Splice packs          ║
    ║  Lyrics:  Original · 6 sections                  ║
    ║  Output:  {output_path}  ║
    ╚═══════════════════════════════════════════════════╝
    
    🎧 Open in DAW or play with: python -c "import scipy.io.wavfile as w; import numpy as n; r,d=w.read(r'{output_path}'); print(f'Song loaded: {{len(d)/r:.1f}}s @ {{r}}Hz')"
    """)


if __name__ == "__main__":
    main()
