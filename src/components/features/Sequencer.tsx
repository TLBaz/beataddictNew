import { FlipVertical, Save, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AIWorkflow } from '../../ai/AIWorkflow';
import { formatDuration, generateDrumSamples, getSampleBufferByInstrument, isSupportedAudioFile, loadAudioFile, type DrumSample, type LoadedSample } from '../../audio/sampleManager';
import { useToast } from '../../hooks/use-toast';
import { useMixStore } from '../../stores/mixStore';
import { runSystemHealthCheck, type HealthCheckResult } from '../../system/healthCheck';
import { Button } from '../ui/button';

const INSTRUMENTS = [
  { id: 'kick', name: 'Kick', emoji: '😈', color: 'border-red-500', accentColor: 'bg-red-500' },
  { id: 'snare', name: 'Snare', emoji: '😈', color: 'border-cyan-400', accentColor: 'bg-cyan-400' },
  { id: 'hihat', name: 'Hi-Hat', emoji: '🎵', color: 'border-yellow-400', accentColor: 'bg-yellow-400' },
  { id: 'openhat', name: 'Open Hat', emoji: '🎵', color: 'border-purple-400', accentColor: 'bg-purple-400' },
  { id: 'clap', name: 'Clap', emoji: '👏', color: 'border-orange-400', accentColor: 'bg-orange-400' },
  { id: 'crash', name: 'Crash', emoji: '💥', color: 'border-red-400', accentColor: 'bg-red-400' },
  { id: 'perc1', name: 'Perc 1', emoji: '🎶', color: 'border-purple-500', accentColor: 'bg-purple-500' },
] as const;

type InstrumentId = (typeof INSTRUMENTS)[number]['id'];

type Pattern = Record<string, boolean[]>;

export const Sequencer = () => {
  const { toast } = useToast();
  const [currentPattern, setCurrentPattern] = useState(1);
  const [patterns] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [selectedGenre, setSelectedGenre] = useState('Tech House');
  const [selectedMood, setSelectedMood] = useState('Energetic');
  const [selectedStyle, setSelectedStyle] = useState('Topline Tech House');
  const [complexity, setComplexity] = useState(60);
  const [density, setDensity] = useState(70);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [bpm, setBpm] = useState(124);
  const [currentStep, setCurrentStep] = useState(0);
  const [savedPatterns, setSavedPatterns] = useState<Array<{ id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern }>>([]);
  const [selectedSavedPatternId, setSelectedSavedPatternId] = useState('');
  const [loadedSamples, setLoadedSamples] = useState<LoadedSample[]>([]);
  const [lastGenerationSummary, setLastGenerationSummary] = useState('');
  const [drumSamples, setDrumSamples] = useState<DrumSample[]>([]);
  const [sampleLoadError, setSampleLoadError] = useState('');
  const [healthResults, setHealthResults] = useState<HealthCheckResult[] | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);

  // ── Groove state ──────────────────────────────────────────────
  const [swing, setSwing] = useState(55);
  const [shuffle, setShuffle] = useState(25);
  const [humanize, setHumanize] = useState(18);
  const [velocityDynamics, setVelocityDynamics] = useState(70);
  const [grooveVelocities, setGrooveVelocities] = useState<Record<string, number[]> | null>(null);
  const [grooveTiming, setGrooveTiming] = useState<Record<string, number[]> | null>(null);
  const [showGroovePanel, setShowGroovePanel] = useState(false);

  const PATTERN_LIBRARY_KEY = 'beataddicts_saved_patterns';
  const genreOptions = ['Tech House', 'Deep House', 'Techno', 'Minimal', 'Progressive', 'Acid', 'Electro', 'House', 'Bass House / Hybrid Trap', 'Trap', 'Lo-Fi', 'Ambient'];
  const moodOptions = ['Energetic', 'Chill', 'Dark', 'Uplifting', 'Minimal', 'Epic'];
  const styleOptions = ['Topline Tech House', 'Progressive House', 'Melodic Electro', 'Bass House Groove', 'Trap Punch', 'Lo-Fi Pocket', 'Ambient Pulse'];
  const generatorPresets = [
    { id: 'pulse-drive', label: 'Pulse Drive', blurb: 'Punchy groove with bright hats', genre: 'Tech House', mood: 'Energetic', style: 'Topline Tech House', complexity: 72, density: 68 },
    { id: 'midnight-glow', label: 'Midnight Glow', blurb: 'Deep texture and hypnotic swing', genre: 'Deep House', mood: 'Chill', style: 'Progressive House', complexity: 58, density: 54 },
    { id: 'neon-rhythm', label: 'Neon Rhythm', blurb: 'Sharp drums and late-night energy', genre: 'Techno', mood: 'Dark', style: 'Melodic Electro', complexity: 80, density: 74 },
  ] as const;

  const tracks = useMixStore(state => state.tracks);
  const updateTrack = useMixStore(state => state.updateTrack);

  // Initialize pattern with 16 steps for each instrument
  const [pattern, setPattern] = useState<Pattern>(() => {
    const initialPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      initialPattern[inst.id] = Array(16).fill(false);
    });
    return initialPattern;
  });

  const toggleStep = (instrumentId: InstrumentId, stepIndex: number) => {
    setPattern((prev) => ({
      ...prev,
      [instrumentId]: prev[instrumentId].map((val, idx) =>
        idx === stepIndex ? !val : val
      )
    }));
  };

  const getActiveNotes = () => {
    let count = 0;
    Object.values(pattern).forEach(steps => {
      count += steps.filter(Boolean).length;
    });
    return count;
  };

  const randomizePattern = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = Array(16).fill(false).map(() => Math.random() > 0.7);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Randomized',
      description: 'New random beat pattern generated'
    });
  };

  const persistSavedPatterns = (nextPatterns: Array<{ id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern }>) => {
    setSavedPatterns(nextPatterns);
    localStorage.setItem(PATTERN_LIBRARY_KEY, JSON.stringify(nextPatterns));
  };

  const loadSavedPatterns = () => {
    try {
      const raw = localStorage.getItem(PATTERN_LIBRARY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{ id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern }>;
        setSavedPatterns(parsed);
      }
    } catch {
      setSavedPatterns([]);
    }
  };

  const toggleTrackMute = (instrumentId: InstrumentId) => {
    const track = tracks[instrumentId as keyof typeof tracks];
    if (!track) return;
    updateTrack(instrumentId as unknown as keyof typeof tracks, { mute: !track.mute });
    toast({
      title: track.mute ? 'Track Unmuted' : 'Track Muted',
      description: `${instrumentId} is now ${track.mute ? 'active' : 'muted'}`
    });
  };

  const ensureAudioContext = async (): Promise<AudioContext | null> => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
        const samples = await generateDrumSamples(audioCtxRef.current);
        setDrumSamples(samples);
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Audio Context Error',
        description: message || 'Unable to initialize audio playback.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const handleSampleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const ctx = await ensureAudioContext();
    if (!ctx) return;

    const nextSamples: LoadedSample[] = [];
    let errorMessage = '';

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!isSupportedAudioFile(file)) {
        errorMessage = `${file.name} is not a supported audio file.`;
        continue;
      }

      try {
        const loaded = await loadAudioFile(ctx, file);
        nextSamples.push(loaded);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        errorMessage = `${file.name} could not be decoded: ${message || 'invalid audio file'}`;
      }
    }

    if (nextSamples.length > 0) {
      setLoadedSamples((existing) => [...existing, ...nextSamples]);
      toast({
        title: 'Sample Loaded',
        description: `${nextSamples.length} audio sample${nextSamples.length > 1 ? 's' : ''} added to the library.`
      });
    }

    if (errorMessage) {
      setSampleLoadError(errorMessage);
      toast({
        title: 'Sample Load Warning',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const playSample = (sampleId: string) => {
    const sample = loadedSamples.find((item) => item.id === sampleId);
    if (!sample || !audioCtxRef.current) {
      toast({
        title: 'Playback Error',
        description: 'Sample is not available or audio context is not ready.',
        variant: 'destructive'
      });
      return;
    }

    const source = audioCtxRef.current.createBufferSource();
    const gain = audioCtxRef.current.createGain();
    const panner = audioCtxRef.current.createStereoPanner();

    source.buffer = sample.buffer;
    gain.gain.setValueAtTime(0.9, audioCtxRef.current.currentTime);
    panner.pan.value = 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(audioCtxRef.current.destination);
    source.start();
  };

  const removeSample = (sampleId: string) => {
    setLoadedSamples((existing) => existing.filter((item) => item.id !== sampleId));
  };

  const runHealthCheckAction = async () => {
    setIsHealthChecking(true);
    setHealthResults(null);
    try {
      const results = await runSystemHealthCheck(audioCtxRef.current);
      setHealthResults(results);
      const errors = results.filter((result) => result.status !== 'ok');
      toast({
        title: errors.length ? 'System health issues detected' : 'System health is good',
        description: errors.length
          ? errors.map((result) => `${result.name}: ${result.details}`).join(' | ')
          : 'All core systems are ready for playback and local AI generation.',
        variant: errors.length ? 'destructive' : 'default'
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const savePattern = () => {
    const id = `${selectedGenre}-${selectedMood}-${Date.now()}`;
    const entry = {
      id,
      name: `${selectedStyle} (${selectedGenre} / ${selectedMood})`,
      genre: selectedGenre,
      mood: selectedMood,
      style: selectedStyle,
      pattern
    };
    const next = [entry, ...savedPatterns].slice(0, 12);
    persistSavedPatterns(next);
    setSelectedSavedPatternId(id);
    toast({
      title: 'Pattern Saved',
      description: `Saved ${entry.name} to your library.`
    });
  };

  const saveToLibrary = () => {
    savePattern();
  };

  const loadSavedPattern = (patternId: string) => {
    const entry = savedPatterns.find(item => item.id === patternId);
    if (!entry) return;
    setPattern(entry.pattern);
    setSelectedGenre(entry.genre);
    setSelectedMood(entry.mood);
    setSelectedStyle(entry.style);
    setSelectedSavedPatternId(entry.id);
    toast({
      title: 'Pattern Loaded',
      description: `Loaded ${entry.name}.`
    });
  };

  const clearAll = () => {
    clearPattern();
    setSelectedGenre('Tech House');
    setSelectedMood('Energetic');
    setSelectedStyle('Topline Tech House');
  };

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(0);
  };

  // ── playHit: called each step for a triggered instrument ──────
  const playHit = (instrumentId: InstrumentId) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const mixState = useMixStore.getState();
    const track = mixState.tracks[instrumentId as keyof typeof mixState.tracks];
    if (!track) return;

    // Mute / Solo check
    const soloActive = Object.values(mixState.tracks).some(t => t.solo);
    if (track.mute || (soloActive && !track.solo)) return;

    const masterGain = (mixState.masterVolume ?? 100) / 100;
    const trackGain = (track.volume ?? 100) / 100;
    const volume = masterGain * trackGain;

    const widthFactor = mixState.stereoWidth / 100;
    const pan = (track.pan / 50) * widthFactor;

    const now = ctx.currentTime;

    // Prefer user-loaded sample, then built-in sample buffer, then synthesis
    const assignedSample = loadedSamples.find((sample) => sample.id === track.sampleId);
    if (assignedSample?.buffer) {
      playBufferedDrum(ctx, now, assignedSample.buffer, volume, pan, instrumentId);
      return;
    }

    const defaultBuffer = getSampleBufferByInstrument(drumSamples, instrumentId);
    if (defaultBuffer) {
      playBufferedDrum(ctx, now, defaultBuffer, volume, pan, instrumentId);
      return;
    }

    // Fallback to synthesis
    switch (instrumentId) {
      case 'kick':
        playKickDrum(ctx, now, volume, pan);
        break;
      case 'snare':
        playSnareDrum(ctx, now, volume, pan);
        break;
      case 'hihat':
        playHiHat(ctx, now, volume * 0.6, pan);
        break;
      case 'openhat':
        playOpenHat(ctx, now, volume * 0.8, pan);
        break;
      case 'clap':
        playClap(ctx, now, volume, pan);
        break;
      case 'crash':
        playCrash(ctx, now, volume * 0.7, pan);
        break;
      default:
        playPercussion(ctx, now, volume, pan);
        break;
    }
  };

  const playBufferedDrum = (ctx: AudioContext, time: number, buffer: AudioBuffer, volume: number, pan: number, instrumentId: InstrumentId) => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(1, time);

    const duration = Math.min(buffer.duration, instrumentId === 'kick' ? 0.45 : instrumentId === 'hihat' || instrumentId === 'openhat' ? 0.16 : 0.28);

    filter.type = instrumentId === 'kick' ? 'lowpass' : instrumentId === 'hihat' || instrumentId === 'openhat' ? 'highpass' : 'bandpass';
    filter.frequency.value = instrumentId === 'kick' ? 1200 : instrumentId === 'hihat' || instrumentId === 'openhat' ? 8000 : 2200;
    filter.Q.value = instrumentId === 'kick' ? 0.6 : instrumentId === 'snare' ? 0.9 : 1.1;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.08, volume * 0.95), time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    source.start(time);
    source.stop(time + duration + 0.06);
  };

  // Professional kick drum synthesis with punch and sub
  const playKickDrum = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.8;

    // Bus with compression for glue
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    bus.connect(comp);
    comp.connect(ctx.destination);

    // Punch body (80Hz -> 40Hz)
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, time);
    osc1.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    g1.gain.setValueAtTime(v * 0.9, time);
    g1.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc1.connect(g1);
    g1.connect(bus);
    osc1.start(time);
    osc1.stop(time + 0.35);

    // Sub (55Hz -> 30Hz)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(55, time);
    osc2.frequency.exponentialRampToValueAtTime(30, time + 0.25);
    g2.gain.setValueAtTime(v * 0.85, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    osc2.connect(g2);
    g2.connect(bus);
    osc2.start(time);
    osc2.stop(time + 0.5);

    // Click transient (200Hz -> 80Hz)
    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(200, time);
    osc3.frequency.exponentialRampToValueAtTime(80, time + 0.02);
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    g3.gain.setValueAtTime(v * 0.5, time);
    g3.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc3.connect(filter);
    filter.connect(g3);
    g3.connect(bus);
    osc3.start(time);
    osc3.stop(time + 0.08);

    // Stereo widener
    const osc4 = ctx.createOscillator();
    const g4 = ctx.createGain();
    osc4.type = 'sine';
    osc4.frequency.setValueAtTime(52, time);
    g4.gain.setValueAtTime(v * 0.35, time);
    g4.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    const panNode = ctx.createStereoPanner();
    panNode.pan.value = pan;
    osc4.connect(g4);
    g4.connect(panNode);
    panNode.connect(bus);
    osc4.start(time);
    osc4.stop(time + 0.4);
  };

  // Professional snare drum synthesis with body and crack
  const playSnareDrum = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.6;

    // Bus with compression
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.attack.value = 0.001;
    comp.release.value = 0.12;
    bus.connect(comp);
    comp.connect(ctx.destination);

    // Tone body (180Hz -> 100Hz)
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(180, time);
    osc1.frequency.exponentialRampToValueAtTime(100, time + 0.12);
    g1.gain.setValueAtTime(v * 0.5, time);
    g1.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc1.connect(g1);
    g1.connect(bus);
    osc1.start(time);
    osc1.stop(time + 0.25);

    // Overtone (320Hz -> 180Hz)
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, time);
    osc2.frequency.exponentialRampToValueAtTime(180, time + 0.06);
    g2.gain.setValueAtTime(v * 0.3, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc2.connect(g2);
    g2.connect(bus);
    osc2.start(time);
    osc2.stop(time + 0.12);

    // Noise for snap (brushed)
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2500;
    noiseGain.gain.setValueAtTime(v * 0.7, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(bus);
    noiseSource.start(time);
    noiseSource.stop(time + 0.15);

    // Crack (sharp attack)
    const crackBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
    }
    const crackSource = ctx.createBufferSource();
    const crackGain = ctx.createGain();
    const crackFilter = ctx.createBiquadFilter();
    crackSource.buffer = crackBuffer;
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 4500;
    crackFilter.Q.value = 2;
    crackGain.gain.setValueAtTime(v * 0.8, time);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(bus);
    crackSource.start(time);
    crackSource.stop(time + 0.05);

    // Tail/ring
    const tailBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
    const tailData = tailBuffer.getChannelData(0);
    for (let i = 0; i < tailData.length; i++) {
      tailData[i] = (Math.random() * 2 - 1) * (1 - i / tailData.length);
    }
    const tailSource = ctx.createBufferSource();
    const tailGain = ctx.createGain();
    const tailFilter = ctx.createBiquadFilter();
    tailSource.buffer = tailBuffer;
    tailFilter.type = 'bandpass';
    tailFilter.frequency.value = 3800;
    tailFilter.Q.value = 0.8;
    tailGain.gain.setValueAtTime(v * 0.3, time + 0.005);
    tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    tailSource.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(bus);
    tailSource.start(time);
    tailSource.stop(time + 0.2);

    // Stereo panning
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.disconnect();
    bus.connect(panner);
    panner.connect(comp);
  };

  // Hi-hat synthesis
  // Professional closed hi-hat with crisp attack
  const playHiHat = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.7;

    // Bright top (air)
    const buf1 = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const dat1 = buf1.getChannelData(0);
    for (let i = 0; i < dat1.length; i++) {
      dat1[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const src1 = ctx.createBufferSource();
    const gn1 = ctx.createGain();
    const fil1 = ctx.createBiquadFilter();
    src1.buffer = buf1;
    fil1.type = 'highpass';
    fil1.frequency.value = 8500;
    gn1.gain.setValueAtTime(v * 0.9, time);
    gn1.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    src1.connect(fil1);
    fil1.connect(gn1);
    src1.start(time);
    src1.stop(time + 0.07);

    // Mid presence
    const buf2 = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const dat2 = buf2.getChannelData(0);
    for (let i = 0; i < dat2.length; i++) {
      dat2[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
    }
    const src2 = ctx.createBufferSource();
    const gn2 = ctx.createGain();
    const fil2 = ctx.createBiquadFilter();
    src2.buffer = buf2;
    fil2.type = 'bandpass';
    fil2.frequency.value = 7000;
    fil2.Q.value = 1.2;
    gn2.gain.setValueAtTime(v * 0.6, time);
    gn2.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    src2.connect(fil2);
    fil2.connect(gn2);
    src2.start(time);
    src2.stop(time + 0.055);

    // Attack click
    const buf3 = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const dat3 = buf3.getChannelData(0);
    for (let i = 0; i < dat3.length; i++) {
      dat3[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const src3 = ctx.createBufferSource();
    const gn3 = ctx.createGain();
    const fil3 = ctx.createBiquadFilter();
    src3.buffer = buf3;
    fil3.type = 'highpass';
    fil3.frequency.value = 4000;
    gn3.gain.setValueAtTime(v * 0.75, time);
    gn3.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    src3.connect(fil3);
    fil3.connect(gn3);
    src3.start(time);
    src3.stop(time + 0.03);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    gn1.connect(panner);
    gn2.connect(panner);
    gn3.connect(panner);
    panner.connect(ctx.destination);
  };

  // Open hi-hat synthesis
  // Professional open hi-hat with shimmer and decay
  const playOpenHat = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.2;
    const duration = 0.5;

    // Bus with glue compression
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.001;
    comp.release.value = 0.15;
    bus.connect(comp);
    comp.connect(ctx.destination);

    // Layer 1: Bright top sizzle (very high)
    const noiseBuffer1 = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData1 = noiseBuffer1.getChannelData(0);
    for (let i = 0; i < noiseData1.length; i++) {
      const env = Math.exp(-i / (noiseData1.length * 0.12));
      noiseData1[i] = (Math.random() * 2 - 1) * env;
    }
    const source1 = ctx.createBufferSource();
    const filter1 = ctx.createBiquadFilter();
    const gain1 = ctx.createGain();
    source1.buffer = noiseBuffer1;
    filter1.type = 'highpass';
    filter1.frequency.value = 8500;
    gain1.gain.setValueAtTime(v * 0.6, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(bus);
    source1.start(time);
    source1.stop(time + duration);

    // Layer 2: Mid presence (metallic)
    const noiseBuffer2 = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData2 = noiseBuffer2.getChannelData(0);
    for (let i = 0; i < noiseData2.length; i++) {
      noiseData2[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData2.length * 0.15));
    }
    const source2 = ctx.createBufferSource();
    const filter2 = ctx.createBiquadFilter();
    const gain2 = ctx.createGain();
    source2.buffer = noiseBuffer2;
    filter2.type = 'bandpass';
    filter2.frequency.value = 4500;
    filter2.Q.value = 1.5;
    gain2.gain.setValueAtTime(v * 0.5, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(bus);
    source2.start(time);
    source2.stop(time + duration);

    // Layer 3: Sub rumble tail
    const osc = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(90, time + duration * 0.5);
    gain3.gain.setValueAtTime(v * 0.15, time);
    gain3.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.4);
    osc.connect(gain3);
    gain3.connect(bus);
    osc.start(time);
    osc.stop(time + duration);

    // Stereo panner
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.disconnect();
    bus.connect(panner);
    panner.connect(ctx.destination);
  };

  // Professional clap synthesis with multiple attack transients
  const playClap = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.4;
    const duration = 0.25;

    // Bus with glue compression
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    bus.connect(comp);
    comp.connect(ctx.destination);

    // Layer 1: Pre-pop body
    const noiseBuffer1 = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const noiseData1 = noiseBuffer1.getChannelData(0);
    for (let i = 0; i < noiseData1.length; i++) {
      const env = Math.exp(-i / (noiseData1.length * 0.3));
      noiseData1[i] = (Math.random() * 2 - 1) * env;
    }
    const source1 = ctx.createBufferSource();
    const filter1 = ctx.createBiquadFilter();
    const gain1 = ctx.createGain();
    source1.buffer = noiseBuffer1;
    filter1.type = 'bandpass';
    filter1.frequency.value = 1200;
    filter1.Q.value = 1;
    gain1.gain.setValueAtTime(v * 0.5, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    source1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(bus);
    source1.start(time);
    source1.stop(time + 0.08);

    // Layer 2: Attack transient burst
    const noiseBuffer2 = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const noiseData2 = noiseBuffer2.getChannelData(0);
    for (let i = 0; i < noiseData2.length; i++) {
      const env = Math.exp(-i / (noiseData2.length * 0.1));
      noiseData2[i] = (Math.random() * 2 - 1) * env;
    }
    const source2 = ctx.createBufferSource();
    const filter2 = ctx.createBiquadFilter();
    const gain2 = ctx.createGain();
    source2.buffer = noiseBuffer2;
    filter2.type = 'highpass';
    filter2.frequency.value = 2000;
    gain2.gain.setValueAtTime(v * 0.9, time + 0.008);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    source2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(bus);
    source2.start(time + 0.008);
    source2.stop(time + 0.05);

    // Layer 3: Main body with tail
    const noiseBuffer3 = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData3 = noiseBuffer3.getChannelData(0);
    for (let i = 0; i < noiseData3.length; i++) {
      const env = Math.exp(-i / (noiseData3.length * 0.25));
      noiseData3[i] = (Math.random() * 2 - 1) * env;
    }
    const source3 = ctx.createBufferSource();
    const filter3 = ctx.createBiquadFilter();
    const gain3 = ctx.createGain();
    source3.buffer = noiseBuffer3;
    filter3.type = 'bandpass';
    filter3.frequency.value = 2500;
    filter3.Q.value = 0.7;
    gain3.gain.setValueAtTime(v * 0.7, time + 0.01);
    gain3.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source3.connect(filter3);
    filter3.connect(gain3);
    gain3.connect(bus);
    source3.start(time + 0.01);
    source3.stop(time + duration);

    // Stereo panner
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.disconnect();
    bus.connect(panner);
    panner.connect(ctx.destination);
  };

  // Professional crash cymbal with shimmer and long decay
  const playCrash = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const v = volume * 1.3;
    const duration = 2.5;

    // Bus with glue compression
    const bus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.001;
    comp.release.value = 0.25;
    bus.connect(comp);
    comp.connect(ctx.destination);

    // Layer 1: High shimmer (bell-like)
    const noiseBuffer1 = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData1 = noiseBuffer1.getChannelData(0);
    for (let i = 0; i < noiseData1.length; i++) {
      const env = Math.exp(-i / (noiseData1.length * 0.4));
      // Add some tonal component
      const tone = Math.sin(i * 0.05) * 0.3;
      noiseData1[i] = ((Math.random() * 2 - 1) + tone) * env;
    }
    const source1 = ctx.createBufferSource();
    const filter1 = ctx.createBiquadFilter();
    const gain1 = ctx.createGain();
    source1.buffer = noiseBuffer1;
    filter1.type = 'highpass';
    filter1.frequency.value = 6000;
    filter1.Q.value = 0.5;
    gain1.gain.setValueAtTime(v * 0.55, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9);
    source1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(bus);
    source1.start(time);
    source1.stop(time + duration);

    // Layer 2: Mid wash (main body)
    const noiseBuffer2 = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData2 = noiseBuffer2.getChannelData(0);
    for (let i = 0; i < noiseData2.length; i++) {
      const env = Math.exp(-i / (noiseData2.length * 0.35));
      noiseData2[i] = (Math.random() * 2 - 1) * env;
    }
    const source2 = ctx.createBufferSource();
    const filter2 = ctx.createBiquadFilter();
    const gain2 = ctx.createGain();
    source2.buffer = noiseBuffer2;
    filter2.type = 'highpass';
    filter2.frequency.value = 3500;
    filter2.Q.value = 0.3;
    gain2.gain.setValueAtTime(v * 0.6, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.85);
    source2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(bus);
    source2.start(time);
    source2.stop(time + duration);

    // Layer 3: Low shoulder (weight)
    const noiseBuffer3 = ctx.createBuffer(1, ctx.sampleRate * duration * 0.6, ctx.sampleRate);
    const noiseData3 = noiseBuffer3.getChannelData(0);
    for (let i = 0; i < noiseData3.length; i++) {
      const env = Math.exp(-i / (noiseData3.length * 0.2));
      noiseData3[i] = (Math.random() * 2 - 1) * env;
    }
    const source3 = ctx.createBufferSource();
    const filter3 = ctx.createBiquadFilter();
    const gain3 = ctx.createGain();
    source3.buffer = noiseBuffer3;
    filter3.type = 'bandpass';
    filter3.frequency.value = 1200;
    filter3.Q.value = 0.5;
    gain3.gain.setValueAtTime(v * 0.35, time);
    gain3.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.5);
    source3.connect(filter3);
    filter3.connect(gain3);
    gain3.connect(bus);
    source3.start(time);
    source3.stop(time + duration * 0.6);

    // Layer 4: Sub harmonic
    const osc = ctx.createOscillator();
    const gain4 = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + duration * 0.3);
    gain4.gain.setValueAtTime(v * 0.2, time);
    gain4.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.35);
    osc.connect(gain4);
    gain4.connect(bus);
    osc.start(time);
    osc.stop(time + duration * 0.4);

    // Stereo panner
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bus.disconnect();
    bus.connect(panner);
    panner.connect(ctx.destination);
  };

  // Percussion synthesis
  const playPercussion = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, time);
    osc.frequency.exponentialRampToValueAtTime(160, time + 0.1);

    gain.gain.setValueAtTime(volume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  };

  const startPlayback = async () => {
    if (isPlaying) return;

    const hasNotes = Object.values(pattern).some((row) => row.some(Boolean));
    if (!hasNotes) {
      toast({
        title: 'No notes to play',
        description: 'Add at least one step before starting playback.',
        variant: 'destructive'
      });
      return;
    }

    const ctx = await ensureAudioContext();
    if (!ctx) return;

    setIsPlaying(true);

    const stepMs = (60_000 / bpm) / 4;
    intervalRef.current = window.setInterval(() => {
      setCurrentStep((prev) => {
        const next = (prev + 1) % 16;
        INSTRUMENTS.forEach((inst) => {
          if (pattern[inst.id][next]) {
            playHit(inst.id);
          }
        });
        return next;
      });
    }, stepMs);
  };

  useEffect(() => {
    return () => {
      stopPlayback();
      audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    loadSavedPatterns();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.pattern) {
        setPattern(detail.pattern);
      }
      if (detail?.bpm) {
        setBpm(Number(detail.bpm));
      }
    };

    window.addEventListener('ai:pattern', handler);
    return () => window.removeEventListener('ai:pattern', handler);
  }, []);

  const clearPattern = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = Array(16).fill(false);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Cleared',
      description: 'All steps have been cleared'
    });
  };

  const invertAll = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = pattern[inst.id].map(val => !val);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Inverted',
      description: 'All steps have been toggled'
    });
  };


  const applyGeneratorPreset = (preset: (typeof generatorPresets)[number]) => {
    setSelectedGenre(preset.genre);
    setSelectedMood(preset.mood);
    setSelectedStyle(preset.style);
    setComplexity(preset.complexity);
    setDensity(preset.density);
    setLastGenerationSummary(`${preset.label}: ${preset.blurb}`);

    toast({
      title: 'Preset Applied',
      description: `${preset.label} is ready to generate.`
    });
  };

  const randomizePreset = () => {
    const randomGenre = genreOptions[Math.floor(Math.random() * genreOptions.length)];
    const randomComplexity = Math.floor(Math.random() * 100);
    const randomDensity = Math.floor(Math.random() * 100);

    setSelectedGenre(randomGenre);
    setComplexity(randomComplexity);
    setDensity(randomDensity);
    setLastGenerationSummary(`${randomGenre} • ${selectedMood} • ${selectedStyle}`);

    toast({
      title: 'Preset Randomized',
      description: `${randomGenre} - Complexity: ${randomComplexity}% - Density: ${randomDensity}%`
    });
  };

  const generateAIBeat = async () => {
    setIsGenerating(true);

    // Build sampleConfig from loadedSamples (best-effort matching by instrument name)
    const sampleConfig: Record<string, string> = {};
    const fallbackIds = loadedSamples.map((s) => s.id);
    const hasFallback = fallbackIds.length > 0;

    INSTRUMENTS.forEach((inst, idx) => {
      const match = loadedSamples.find((s) => s.name.toLowerCase().includes(inst.id));
      sampleConfig[inst.id] = match ? match.id : (hasFallback ? fallbackIds[idx % fallbackIds.length] : '');
    });

    // unique seed per request to force variability
    const seed = `req-${Date.now()}-${Math.round(Math.random() * 10000)}`;

    try {
      const result = await AIWorkflow.generateDrums({
        genre: selectedGenre,
        mood: selectedMood,
        style: selectedStyle,
        complexity,
        density,
        sampleConfig,
        seed
      });

      const promptSummary = `${selectedGenre} • ${selectedMood} • ${selectedStyle} • complexity ${complexity}% • density ${density}%`;
      setLastGenerationSummary(promptSummary);

      // Map pattern into UI state
      setPattern(result.pattern);
      if (result.bpm) {
        setBpm(result.bpm);
      }

      // Persist the sample mapping to use during playback (store in tracks)
      if (result.sampleMapping) {
        Object.entries(result.sampleMapping).forEach(([inst, sampleId]) => {
          const trackKey = inst as keyof typeof tracks;
          if (trackKey in tracks) {
            updateTrack(trackKey, { sampleId: String(sampleId) });
          }
        });
      }

      toast({
        title: 'AI Beat Generated!',
        description: `${selectedGenre} pattern created with ${complexity}% complexity`
      });
    } catch (error: unknown) {
      console.error('AI beat generation error:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: 'Generation Failed',
        description: message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#0f0f1e]">
      <div className="max-w-[1600px] mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            {/* Pattern Selector */}
            <div className="flex items-center gap-4">
              <div className="bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 min-w-[260px]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-cyan-400 rounded"></div>
                  <div>
                    <div className="font-semibold text-white">Pattern {currentPattern}</div>
                    <div className="text-xs text-gray-400">{getActiveNotes()} notes - 8 tracks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transport */}
            <div className="flex items-center gap-3 bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 flex-1 min-w-[320px]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">BPM</span>
                <input
                  type="range"
                  min="90"
                  max="140"
                  value={bpm}
                  aria-label="BPM"
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-36 h-2 bg-[#16162a] rounded-lg appearance-none cursor-pointer slider-purple"
                />
                <span className="w-12 text-right text-sm font-semibold text-purple-400">{bpm}</span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <Button
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-neon-purple/40 min-w-[96px]"
                >
                  {isPlaying ? 'Stop' : 'Play'}
                </Button>
                <div className="text-xs text-gray-400">
                  Step <span className="font-semibold text-white">{currentStep + 1}</span> / 16
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={randomizePattern}
                variant="outline"
                className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Random
              </Button>
              <Button
                onClick={clearPattern}
                variant="outline"
                className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={savePattern}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Sample Loader and System Health */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="glass-panel rounded-lg p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">Sample Library</div>
                <div className="text-xs text-muted-foreground">Load audio samples locally for playback and testing.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="sample-upload"
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleSampleFiles}
                  className="hidden"
                />
                <label htmlFor="sample-upload" className="inline-flex items-center justify-center rounded-lg border border-studio-border bg-[#1a1a2e] px-4 py-3 text-sm text-white hover:bg-studio-surface cursor-pointer">
                  Load Samples
                </label>
                <Button onClick={runHealthCheckAction} variant="outline" className="h-12 px-4">
                  {isHealthChecking ? 'Checking...' : 'Run System Health'}
                </Button>
              </div>
            </div>

            {loadedSamples.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {loadedSamples.map((sample) => (
                  <div key={sample.id} className="rounded-lg border border-[#22263b] bg-[#0f111f] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-white">{sample.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDuration(sample.duration)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => playSample(sample.id)} variant="outline" size="sm">
                          Play
                        </Button>
                        <Button onClick={() => removeSample(sample.id)} variant="ghost" size="sm">
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {healthResults?.length ? (
              <div className="rounded-lg border border-studio-border bg-[#11141f] p-4">
                <div className="text-sm font-semibold text-white mb-3">Health Check Results</div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {healthResults.map((result) => (
                    <div key={result.name} className={`rounded-md p-3 ${result.status === 'ok' ? 'bg-emerald-950/40' : result.status === 'warn' ? 'bg-yellow-950/40' : 'bg-rose-950/40'}`}>
                      <div className="font-medium text-white">{result.name}</div>
                      <div>{result.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : sampleLoadError ? (
              <div className="rounded-lg border border-rose-500 bg-rose-950/10 p-4 text-sm text-rose-200">
                {sampleLoadError}
              </div>
            ) : null}
          </div>
        </div>

        {/* Pattern Tabs */}
        <div className="flex gap-2 mb-6">
          {patterns.map(num => (
            <button
              key={num}
              onClick={() => setCurrentPattern(num)}
              className={`
                w-12 h-12 rounded-lg border font-semibold transition-all
                ${currentPattern === num
                  ? 'bg-cyan-400 border-cyan-400 text-black'
                  : 'bg-[#1a1a2e] border-studio-border text-white hover:border-cyan-400/50'
                }
              `}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Step Sequencer Grid */}
        <div className="glass-panel rounded-lg p-6 mb-6">
          {/* Header */}
          <div className="grid grid-cols-[180px_repeat(16,1fr)] gap-2 mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Track</div>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="text-center text-xs font-semibold text-gray-400">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Instrument Rows */}
          <div className="space-y-3">
            {INSTRUMENTS.map(instrument => (
              <div key={instrument.id} className="flex items-center gap-2">
                {/* Accent Bar */}
                <div className={`w-1 h-12 rounded-full ${instrument.accentColor}`} />

                {/* Instrument Label */}
                <div className="grid grid-cols-[180px_repeat(16,1fr)] gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTrackMute(instrument.id)}
                      aria-label={tracks[instrument.id]?.mute ? 'Unmute track' : 'Mute track'}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${tracks[instrument.id]?.mute ? 'bg-red-500 border-red-400 text-black' : 'bg-[#1a1a2e] border border-studio-border hover:bg-studio-surface text-white'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{instrument.emoji}</span>
                      <span className="font-semibold text-white">{instrument.name}</span>
                    </div>
                  </div>

                  {/* Step Buttons */}
                  {pattern[instrument.id].map((active, stepIndex) => (
                    <button
                      key={stepIndex}
                      onClick={() => toggleStep(instrument.id, stepIndex)}
                      aria-label={`${instrument.name} step ${stepIndex + 1} ${active ? '(on)' : '(off)'}`}
                      className={`
                        h-12 rounded-lg border-2 transition-all
                        ${active
                          ? `${instrument.color} bg-opacity-20`
                          : 'border-[#1a1a2e] bg-[#16162a] hover:border-studio-border'
                        }
                        ${stepIndex % 4 === 0 ? 'border-l-4' : ''}
                        ${isPlaying && currentStep === stepIndex ? 'ring-2 ring-neon-cyan ring-offset-1 ring-offset-[#0f0f1e]' : ''}
                      `}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Beat Generator Section */}
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-purple-500/20 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🤖</span>
                  <h3 className="text-lg font-bold text-purple-400 uppercase tracking-wider">AI Beat Generator</h3>
                </div>
                <p className="text-sm text-gray-400">Create polished beat ideas with a guided flow that feels closer to a modern AI music studio.</p>
              </div>
              <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                {lastGenerationSummary ? 'Last prompt ready' : 'Ready to generate'}
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-studio-border bg-[#14172b] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Creative direction</div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-2 text-sm text-gray-300">
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-gray-500">Genre</span>
                      <select
                        aria-label="Select genre"
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                      >
                        {genreOptions.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-300">
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-gray-500">Mood</span>
                      <select
                        aria-label="Select mood"
                        value={selectedMood}
                        onChange={(e) => setSelectedMood(e.target.value)}
                        className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                      >
                        {moodOptions.map(mood => (
                          <option key={mood} value={mood}>{mood}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-300">
                      <span className="block text-[11px] uppercase tracking-[0.2em] text-gray-500">Style</span>
                      <select
                        aria-label="Select style"
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value)}
                        className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-cyan"
                      >
                        {styleOptions.map(style => (
                          <option key={style} value={style}>{style}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {generatorPresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyGeneratorPreset(preset)}
                        className="rounded-full border border-studio-border bg-[#1a1a2e] px-3 py-2 text-left text-sm text-gray-200 transition hover:border-purple-400/50 hover:text-white"
                      >
                        <div className="font-semibold">{preset.label}</div>
                        <div className="text-[11px] text-gray-500">{preset.blurb}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-studio-border bg-[#14172b] p-4">
                  <div className="text-sm font-semibold text-white mb-3">Energy controls</div>
                  <div className="space-y-4">
                    <label className="block text-sm text-gray-300">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Complexity</span>
                        <span className="text-cyan-300">{complexity}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={complexity}
                        onChange={(e) => setComplexity(Number(e.target.value))}
                        className="w-full h-2 bg-[#16162a] rounded-lg appearance-none cursor-pointer slider-cyan"
                      />
                    </label>
                    <label className="block text-sm text-gray-300">
                      <div className="mb-2 flex items-center justify-between">
                        <span>Density</span>
                        <span className="text-purple-300">{density}%</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={density}
                        onChange={(e) => setDensity(Number(e.target.value))}
                        className="w-full h-2 bg-[#16162a] rounded-lg appearance-none cursor-pointer slider-purple"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
                  <div className="text-sm font-semibold text-white mb-2">Generation flow</div>
                  <div className="rounded-lg border border-purple-500/20 bg-[#11141f] p-3 text-sm text-purple-100">
                    {lastGenerationSummary || `${selectedGenre} • ${selectedMood} • ${selectedStyle}`}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={generateAIBeat}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                    >
                      {isGenerating ? (
                        <>
                          <div className="flex gap-1 mr-2">
                            {[...Array(3)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 h-4 bg-white rounded-full animate-waveform"
                              />
                            ))}
                          </div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate AI Beat
                        </>
                      )}
                    </Button>
                    <Button onClick={saveToLibrary} variant="outline" className="border-studio-border bg-[#1a1a2e] hover:bg-studio-surface">
                      <Save className="w-4 h-4 mr-2" />
                      Save Variation
                    </Button>
                    <Button onClick={randomizePreset} variant="outline" className="border-studio-border bg-[#1a1a2e] hover:bg-studio-surface">
                      <Shuffle className="w-4 h-4 mr-2" />
                      Shuffle Vibe
                    </Button>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-4">
                  <div className="text-sm text-gray-400 mb-2">Saved Patterns</div>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Select saved pattern"
                      value={selectedSavedPatternId}
                      onChange={(e) => loadSavedPattern(e.target.value)}
                      className="flex-1 bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Choose saved pattern</option>
                      {savedPatterns.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    <Button
                      onClick={() => {
                        if (selectedSavedPatternId) loadSavedPattern(selectedSavedPatternId);
                      }}
                      variant="outline"
                      className="h-12 px-4"
                    >
                      Load
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={clearAll}
                    variant="outline"
                    className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface h-[calc(50%-6px)]"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                  <Button
                    onClick={invertAll}
                    variant="outline"
                    className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface h-[calc(50%-6px)]"
                  >
                    <FlipVertical className="w-4 h-4 mr-2" />
                    Invert All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"].slider-purple::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #9333ea;
          cursor: pointer;
        }

        input[type="range"].slider-cyan::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #9333ea;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};
