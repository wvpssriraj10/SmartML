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

export const STEPS_FOR = {
  predict: ML_MODES.predict.steps,
  explore: ML_MODES.explore.steps,
  detect: ML_MODES.detect.steps,
};

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}