import { ML_MODES } from "@/lib/ml-modes";

// Only 4 models (free tier cap) — XGBoost removed from display
export const MODEL_NAMES = [
  "Logistic Regression",
  "Decision Tree",
  "Random Forest",
  "Naive Bayes",
];

export const KNOWN_MODEL = new Set([
  "Logistic Regression", "Ridge Classifier", "Decision Tree", "Random Forest",
  "Gradient Boosting", "XGBoost", "LightGBM", "SVM", "KNN", "Neural Net",
  "Naive Bayes", "Ridge Regression", "Lasso Regression",
]);

const MODEL_LOG_RE = /^(?:Training |.+? training )?([\w .]+?)(?:…|\.{3}| completed\.| failed:.*|\.)?$/i;

// Returns the actual models being trained, in first-seen order, by scanning
// the worker's live logs + the current progress model. Mirrors the backend's
// smart-selection roster instead of a hardcoded one, so what the UI lists is
// exactly what gets trained.
export function discoverModelNames(logs, currentModel) {
  const names = [];
  const seen = new Set();
  const add = (name) => {
    if (!name || !KNOWN_MODEL.has(name.trim())) return;
    const key = name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name.trim());
    }
  };
  (logs || []).forEach((entry) => {
    const m = (entry?.message || "").match(MODEL_LOG_RE);
    add(m && m[1]);
  });
  add(currentModel);
  return names;
}

export const STEPS_FOR = {
  predict: ML_MODES.predict.steps,
  explore: ML_MODES.explore.steps,
  detect: ML_MODES.detect.steps,
};

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}