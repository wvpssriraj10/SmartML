// Auto-generates a human-readable name for each cluster based on how its
// typical values differ from the dataset-wide baseline.

function isNumeric(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

function fmtNum(v) {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return String(Number(v.toFixed(2)));
}

// For a numeric feature: direction label relative to the overall mean.
function numericDirection(val, overall) {
  if (overall == null || !isNumeric(overall)) return null;
  const diff = val - overall;
  const scale = Math.max(1, Math.abs(overall));
  const rel = diff / scale;
  if (rel > 0.15) return { word: "High", diff: rel };
  if (rel < -0.15) return { word: "Low", diff: -rel };
  return null;
}

// For a categorical feature: does this cluster overwhelmingly share a value
// that isn't the dataset's most common one?
function categoricalSignal(val, overallMode) {
  if (val == null || overallMode == null || val === overallMode) return null;
  return { word: "mostly " + String(val), diff: 0.3 };
}

// Returns { [clusterKey]: { name, reason, highlight } }
// `featureLabel` maps raw column names -> friendlier display names (optional).
export function generateClusterNames(profiles, featureLabel = {}) {
  const entries = Object.values(profiles || {});
  if (!entries.length) return {};

  const total = entries.reduce((acc, e) => acc + (e.size || 0), 0) || 1;

  // Dataset-wide baseline per feature (numeric = weighted mean, cat = mode).
  const baseline = {};
  const numFeatures = new Set();
  for (const e of entries) {
    for (const [col, val] of Object.entries(e.features || {})) {
      if (isNumeric(val)) {
        numFeatures.add(col);
        baseline[col] = (baseline[col] || 0) + (val * (e.size || 0)) / total;
      }
    }
  }
  for (const col of numFeatures) baseline[col] = Number(baseline[col].toFixed(4));

  const catCounts = {};
  for (const e of entries) {
    for (const [col, val] of Object.entries(e.features || {})) {
      if (isNumeric(val) || val == null) continue;
      catCounts[col] = catCounts[col] || {};
      catCounts[col][String(val)] = (catCounts[col][String(val)] || 0) + (e.size || 0);
    }
  }
  const catMode = {};
  for (const [col, counts] of Object.entries(catCounts)) {
    catMode[col] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  const label = (col) => featureLabel[col] || col;

  const result = {};
  for (const e of entries) {
    const key = String(e.cluster);
    const signals = [];
    for (const [col, val] of Object.entries(e.features || {})) {
      if (isNumeric(val)) {
        const s = numericDirection(val, baseline[col]);
        if (s) signals.push({ col, dir: s.word, diff: s.diff, numeric: true, val });
      } else {
        const s = categoricalSignal(val, catMode[col]);
        if (s) signals.push({ col, dir: s.word, diff: s.diff, numeric: false, val });
      }
    }
    // Keep the most distinctive 1-2 signals.
    signals.sort((a, b) => b.diff - a.diff);
    const top = signals.slice(0, 2);

    let name;
    let reason;
    if (!top.length) {
      name = `Group ${e.cluster} — the "average" profile`;
      reason = "This group looks close to the dataset average on every column we compared.";
    } else {
      const parts = top.map((s) => (s.numeric ? `${s.dir} ${label(s.col)}` : label(s.col)));
      name = `${parts.join(" · ")} (Group ${e.cluster})`;
      reason = top.map((s) =>
        s.numeric
          ? `${label(s.col)} is ${s.dir.toLowerCase()} (${fmtNum(s.val)} vs baseline ${fmtNum(baseline[s.col])})`
          : `every member is ${s.dir}`
      ).join(" · ") + ".";
    }

    result[key] = { name, reason, signals: top };
  }
  return result;
}
