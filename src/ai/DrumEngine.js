const STEP_COUNT = 16;

// Utility
const rand = (min, max) => Math.random() * (max - min) + min;
const chance = (p) => Math.random() < p;

// ----------------------
// GROOVE ENGINE
// ----------------------
function applyGroove(pattern, swing = 0.58) {
  return pattern.map((step, i) => {
    if (!step.hit) return step;

    let offset = step.offset || 0;

    // Apply swing to off-beats
    if (i % 2 === 1) {
      offset += (swing - 0.5) * 0.04; // subtle timing shift
    }

    return {
      ...step,
      offset
    };
  });
}

// ----------------------
// VELOCITY HUMANIZER
// ----------------------
function humanizeVelocity(pattern, variation = 0.2) {
  return pattern.map(step => {
    if (!step.hit) return step;

    let v = step.velocity || 0.8;
    v += rand(-variation, variation);

    return {
      ...step,
      velocity: Math.max(0.3, Math.min(1.0, v))
    };
  });
}

// ----------------------
// MUTATION ENGINE
// ----------------------
function mutatePattern(pattern, intensity = 0.2) {
  return pattern.map((step, i) => {
    let newStep = { ...step };

    // Randomly add/remove hits
    if (chance(intensity * 0.3)) {
      newStep.hit = !step.hit;
    }

    // Add ghost notes
    if (!step.hit && chance(intensity * 0.2)) {
      newStep.hit = true;
      newStep.velocity = rand(0.3, 0.6);
      newStep.offset = rand(-0.02, 0.02);
    }

    return newStep;
  });
}

// ----------------------
// DRUM ROLE LOGIC
// ----------------------
function enforceDrumRules(track, type) {
  return track.map((step, i) => {
    let newStep = { ...step };

    if (type === "snare") {
      // Force backbeat (2 & 4)
      if (i === 4 || i === 12) {
        newStep.hit = true;
        newStep.velocity = 1.0;
      }
    }

    if (type === "kick") {
      // Avoid over-density
      if (i > 0 && track[i - 1].hit && chance(0.5)) {
        newStep.hit = false;
      }
    }

    return newStep;
  });
}

// ----------------------
// MAIN GENERATOR
// ----------------------
function generateDrumPattern(basePattern, options = {}) {
  const {
    swing = 0.58,
    variation = 0.25,
    humanize = 0.15
  } = options;

  let result = {};

  for (let part in basePattern) {
    if (part === "meta") continue;

    let track = basePattern[part];

    track = mutatePattern(track, variation);
    track = humanizeVelocity(track, humanize);
    track = applyGroove(track, swing);
    track = enforceDrumRules(track, part);

    result[part] = track;
  }

  return result;
}

// ----------------------
// SECTION VARIATION
// ----------------------
function generateSection(basePattern, sectionType) {
  let config = {
    intro: { variation: 0.1, swing: 0.55 },
    buildup: { variation: 0.3, swing: 0.58 },
    drop: { variation: 0.4, swing: 0.6 },
    fill: { variation: 0.6, swing: 0.62 }
  };

  return generateDrumPattern(basePattern, config[sectionType]);
}

// Example usage:
// const newPattern = generateSection(datasetPattern, "drop");
// console.log(newPattern);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateDrumPattern,
    generateSection,
    applyGroove,
    humanizeVelocity,
    mutatePattern,
    enforceDrumRules
  };
}
