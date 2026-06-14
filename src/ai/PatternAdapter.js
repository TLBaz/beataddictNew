const DEFAULT_TRACKS = ['kick', 'snare', 'hihat', 'openhat', 'clap', 'crash', 'perc1'];

const normalizeSteps = (steps, length = 16) => {
  if (!Array.isArray(steps)) {
    return Array(length).fill(false);
  }
  return Array.from({ length }, (_, i) => Boolean(steps[i]));
};

export const PatternAdapter = {
  toSequencerPattern: (payload) => {
    const source = payload?.pattern?.tracks || payload?.tracks || payload?.pattern || {};
    const length = payload?.pattern?.length || payload?.length || 16;
    const mapped = {};

    DEFAULT_TRACKS.forEach((track) => {
      mapped[track] = normalizeSteps(source[track], length);
    });

    return {
      pattern: mapped,
      bpm: payload?.bpm || payload?.pattern?.bpm || 124
    };
  }
};
