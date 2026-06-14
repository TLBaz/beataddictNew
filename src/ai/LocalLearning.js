const KEY = 'beataddicts_local_prefs';

const defaultPrefs = {
  optIn: false,
  favoriteGenres: [],
  rejectedPatterns: 0,
  acceptedPatterns: 0,
  generationCount: 0,
  generationLimit: 50
};

export const LocalLearning = {
  getPreferences() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : { ...defaultPrefs };
    } catch {
      return { ...defaultPrefs };
    }
  },
  setOptIn(value) {
    const prefs = LocalLearning.getPreferences();
    prefs.optIn = Boolean(value);
    localStorage.setItem(KEY, JSON.stringify(prefs));
  },
  recordFeedback({ accepted, genre }) {
    const prefs = LocalLearning.getPreferences();
    if (accepted) {
      prefs.acceptedPatterns += 1;
      if (genre && !prefs.favoriteGenres.includes(genre)) {
        prefs.favoriteGenres.push(genre);
      }
    } else {
      prefs.rejectedPatterns += 1;
    }
    localStorage.setItem(KEY, JSON.stringify(prefs));
  },
  canGenerate() {
    const prefs = LocalLearning.getPreferences();
    return prefs.generationCount < prefs.generationLimit;
  },
  recordGeneration() {
    const prefs = LocalLearning.getPreferences();
    prefs.generationCount += 1;
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }
};
