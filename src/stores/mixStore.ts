import { create } from 'zustand';

type TrackId =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'openhat'
  | 'clap'
  | 'crash'
  | 'perc1'
  | 'bass'
  | 'lead';

export type MixStrip = {
  volume: number; // 0-100
  pan: number; // -50..50
  mute: boolean;
  solo: boolean;
  reverb: number; // 0-100
  delay: number; // 0-100
  highpass: number; // 0-100
  lowpass: number; // 0-100
};

interface MixStore {
  masterVolume: number; // 0-100
  stereoWidth: number; // 0-150
  limiter: boolean;
  headphones: boolean;
  tracks: Record<TrackId, MixStrip>;
  anySolo: () => boolean;
  updateTrack: (id: TrackId, data: Partial<MixStrip>) => void;
  setMasterVolume: (v: number) => void;
  setStereoWidth: (v: number) => void;
  setLimiter: (v: boolean) => void;
  setHeadphones: (v: boolean) => void;
  reset: () => void;
  randomize: () => void;
}

const defaultStrip = (): MixStrip => ({
  volume: 75,
  pan: 0,
  mute: false,
  solo: false,
  reverb: 18,
  delay: 12,
  highpass: 0,
  lowpass: 100
});

const defaultTracks = (): Record<TrackId, MixStrip> => ({
  kick: defaultStrip(),
  snare: defaultStrip(),
  hihat: defaultStrip(),
  openhat: defaultStrip(),
  clap: defaultStrip(),
  crash: defaultStrip(),
  perc1: defaultStrip(),
  bass: defaultStrip(),
  lead: defaultStrip()
});

export const useMixStore = create<MixStore>((set, get) => ({
  masterVolume: 78,
  stereoWidth: 90,
  limiter: true,
  headphones: false,
  tracks: defaultTracks(),
  anySolo: () => Object.values(get().tracks).some((t) => t.solo),
  updateTrack: (id, data) =>
    set((state) => ({
      tracks: {
        ...state.tracks,
        [id]: { ...state.tracks[id], ...data }
      }
    })),
  setMasterVolume: (v) => set({ masterVolume: v }),
  setStereoWidth: (v) => set({ stereoWidth: v }),
  setLimiter: (v) => set({ limiter: v }),
  setHeadphones: (v) => set({ headphones: v }),
  reset: () =>
    set({
      masterVolume: 78,
      stereoWidth: 90,
      limiter: true,
      headphones: false,
      tracks: defaultTracks()
    }),
  randomize: () =>
    set((state) => {
      const next = { ...state.tracks };
      (Object.keys(next) as TrackId[]).forEach((id) => {
        next[id] = {
          ...next[id],
          volume: Math.round(55 + Math.random() * 35),
          pan: Math.round(-35 + Math.random() * 70),
          reverb: Math.round(Math.random() * 35),
          delay: Math.round(Math.random() * 30),
          highpass: Math.round(Math.random() * 30),
          lowpass: Math.round(70 + Math.random() * 30)
        };
      });
      return { tracks: next };
    })
}));
