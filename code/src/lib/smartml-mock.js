export const MODEL_NAMES = [
  "Logistic Regression",
  "Ridge Regression",
  "Decision Tree",
  "Random Forest",
  "Gradient Boosting",
  "XGBoost",
  "LightGBM",
  "SVM",
  "KNN",
  "Neural Net",
];

let mockCounter = 0;
export function resetMockCounter() { mockCounter = 0; }
export function nextMockCounter() { return ++mockCounter; }

const COLUMN_POOL = [
  { name: "customer_id", type: "categorical", missingPct: 0, unique: 1000, sample: ["C001", "C002", "C003"] },
  { name: "age", type: "numeric", missingPct: 1.2, unique: 62, sample: [34, 28, 51] },
  { name: "income", type: "numeric", missingPct: 3.5, unique: 942, sample: [52000, 71000, 43000] },
  { name: "region", type: "categorical", missingPct: 0.4, unique: 5, sample: ["North", "South", "East"] },
  { name: "signup_date", type: "datetime", missingPct: 0, unique: 730, sample: ["2023-01-04", "2023-06-19", "2024-02-11"] },
  { name: "tenure_months", type: "numeric", missingPct: 0, unique: 48, sample: [12, 24, 6] },
  { name: "purchases", type: "numeric", missingPct: 2.1, unique: 145, sample: [4, 12, 1] },
  { name: "avg_order_value", type: "numeric", missingPct: 4.8, unique: 780, sample: [85.4, 120.9, 42.5] },
  { name: "support_tickets", type: "numeric", missingPct: 0, unique: 18, sample: [0, 2, 1] },
  { name: "plan_tier", type: "categorical", missingPct: 0, unique: 3, sample: ["Basic", "Pro", "Enterprise"] },
  { name: "churned", type: "categorical", missingPct: 0, unique: 2, sample: ["No", "Yes", "No"] },
  { name: "session_count", type: "numeric", missingPct: 0.8, unique: 220, sample: [14, 3, 42] },
  { name: "device", type: "categorical", missingPct: 0.2, unique: 4, sample: ["iOS", "Android", "Web"] },
  { name: "country", type: "categorical", missingPct: 0.6, unique: 27, sample: ["US", "UK", "DE"] },
  { name: "referral_source", type: "categorical", missingPct: 2.4, unique: 8, sample: ["Ads", "Organic", "Referral"] },
  { name: "last_login_days", type: "numeric", missingPct: 5.1, unique: 90, sample: [1, 14, 33] },
  { name: "email_opens", type: "numeric", missingPct: 1.7, unique: 60, sample: [7, 22, 0] },
  { name: "discount_used", type: "categorical", missingPct: 0, unique: 2, sample: ["Yes", "No", "No"] },
  { name: "lifetime_value", type: "numeric", missingPct: 3.2, unique: 890, sample: [420.5, 1290.0, 88.2] },
  { name: "satisfaction", type: "numeric", missingPct: 4.0, unique: 10, sample: [8, 6, 9] },
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function mockInspect(fileName, nonce) {
  const seed = hashStr(fileName || "dataset") + (nonce ?? 0) * 7919;
  const shuffled = [...COLUMN_POOL]
    .map((c, i) => ({ c, k: ((seed >> (i % 16)) ^ (i * 2654435761)) >>> 0 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  const colCount = 8 + (seed % 6);
  const columns = shuffled.slice(0, colCount).map((c) => ({
    ...c,
    missingPct: +((c.missingPct + (seed % 30) / 20) % 8).toFixed(1),
  }));

  const rows = 500 + (seed % 9500);
  const cols = columns.length;
  const totalCells = rows * cols;
  const missingCells = Math.round(
    columns.reduce((acc, c) => acc + (c.missingPct / 100) * rows, 0),
  );

  const preview = Array.from({ length: 10 }, (_, i) => {
    const row = {};
    columns.forEach((c) => {
      row[c.name] = c.sample[i % c.sample.length];
    });
    return row;
  });

  const targetCandidates = ["churned", "discount_used", "plan_tier", "lifetime_value", "satisfaction"];
  const target =
    columns.find((c) => targetCandidates.includes(c.name))?.name ?? columns[columns.length - 1].name;
  const targetCol = columns.find((c) => c.name === target);
  const suggestedProblem =
    targetCol && targetCol.type === "numeric" && targetCol.unique > 10 ? "regression" : "classification";

  const targetReason = [];
  if (suggestedProblem === "classification") {
    targetReason.push(
      `"${target}" has only ${targetCol.unique} unique values — a small, well-defined set of outcomes, which is exactly what classification models predict.`,
    );
  } else {
    targetReason.push(
      `"${target}" is a continuous numeric column with ${targetCol.unique} distinct values — models can learn to predict a real number rather than a category.`,
    );
  }
  targetReason.push(
    targetCol.missingPct < 2
      ? `It's ${targetCol.missingPct.toFixed(1)}% missing, so the model has almost every row available for learning — clean labels lead to trustworthy predictions.`
      : `It has ${targetCol.missingPct.toFixed(1)}% missing values — low enough that we can safely drop or impute those rows without hurting training.`,
  );
  targetReason.push(
    `Other columns like ${columns.filter((c) => c.name !== target).slice(0, 3).map((c) => `"${c.name}"`).join(", ")} look like natural predictors (mixed numeric + categorical signals) that plausibly influence "${target}".`,
  );

  return {
    qualityScore: 78 + (seed % 20),
    rows,
    cols,
    totalCells,
    missingCells,
    duplicates: seed % 25,
    columns,
    preview,
    suggestedTarget: target,
    suggestedProblem,
    targetReason,
  };
}

export function generateDistribution(columnName) {
  const seed = columnName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 10 }, (_, i) => ({
    bucket: `${i * 10}-${i * 10 + 10}`,
    count: Math.round(30 + Math.abs(Math.sin(seed + i)) * 120 + Math.random() * 20),
  }));
}

export function mockResults(problem) {
  const isClass = problem === "classification";
  const base = MODEL_NAMES.map((name, i) => {
    const noise = (Math.sin(i * 7.3) + 1) / 2;
    const trainTimeSec = +(1.2 + noise * 8 + Math.random() * 2).toFixed(1);
    const acc = 0.72 + noise * 0.22;
    const r2 = 0.55 + noise * 0.35;
    const metrics = {
      accuracy: +acc.toFixed(4),
      precision: +((acc - 0.02 + Math.random() * 0.03)).toFixed(4),
      recall: +((acc - 0.03 + Math.random() * 0.03)).toFixed(4),
      f1: +(acc - 0.015 + Math.random() * 0.02).toFixed(4),
      roc_auc: +(acc + 0.03 + Math.random() * 0.02).toFixed(4),
      r2: +r2.toFixed(4),
      rmse: +((1 - r2 + Math.random() * 0.05)).toFixed(4),
      mae: +((1 - r2) * 0.7 + Math.random() * 0.05).toFixed(4),
    };
    return { name, rank: 0, metrics, trainTimeSec };
  });

  const sortKey = isClass ? "f1" : "r2";
  base.sort((a, b) => (b.metrics[sortKey] ?? 0) - (a.metrics[sortKey] ?? 0));
  base.forEach((m, i) => {
    m.rank = i + 1;
    if (i === 0) m.isChampion = true;
  });
  return base;
}

export function championInsight(results, problem, target) {
  const champ = results[0];
  const runnerUp = results[1];
  const isClass = problem === "classification";
  const primary = isClass ? "f1" : "r2";
  const margin = ((champ.metrics[primary] - runnerUp.metrics[primary]) * 100).toFixed(2);

  const winReasons = [
    `${champ.name} got the highest ${isClass ? "F1 score" : "R² score"} (${champ.metrics[primary].toFixed(4)}) on the test data we held back. It beat the next best model ("${runnerUp.name}") by ${margin} points — this gap is big enough to trust, not just luck.`,
    isClass
      ? `It balances precision (${champ.metrics.precision.toFixed(3)}) and recall (${champ.metrics.recall.toFixed(3)}) well. This means: when it predicts something, it's usually right (few false alarms), AND it catches most of the actual positives (few misses). Many models do one or the other well — ${champ.name} does both.`
      : `Its predictions are close to the actual values: RMSE is ${champ.metrics.rmse.toFixed(3)} and MAE is ${champ.metrics.mae.toFixed(3)}. Lower is better here — most predictions are off by less than ${champ.metrics.mae.toFixed(3)} units on average.`,
    `Training only took ${champ.trainTimeSec} seconds. The model was validated properly (not just memorizing the training data), so the score you see is what you can expect on new, unseen data.`,
    `${champ.name} works well with the mix of numbers (like age, income) and categories (like region, plan_tier) in your dataset. It also handles the small amount of missing data without breaking.`,
  ];

  const metricExplainer = [
    { key: "accuracy", label: "Accuracy", why: `Out of every 100 rows, how many did the model predict correctly? Simple to understand. Best use: balanced classification problems. For imbalanced data, pair with F1 or ROC-AUC.` },
    { key: "precision", label: "Precision", why: `Of all the rows where the model predicted "Yes" for "${target}", how many were actually "Yes"? High precision = fewer false alarms. Critical when a wrong "Yes" is costly (e.g., falsely flagging a transaction).` },
    { key: "recall", label: "Recall", why: `Of all the rows that truly are "${target}", how many did the model catch? High recall = fewer misses. Critical when missing a "Yes" is costly (e.g., not catching a disease).` },
    { key: "f1", label: "F1 Score", why: `A balanced score combining precision and recall. We rank models by this because it stays honest even when classes are imbalanced. Best for classification problems.` },
    { key: "roc_auc", label: "ROC-AUC", why: "How well the model separates the two classes across every possible threshold. 0.5 = random, 1.0 = perfect. Above 0.9 is excellent. Best for classification problems." },
    { key: "r2", label: "R² Score", why: `How much of the variation in "${target}" the model explains. 1.0 = perfect, 0 = no better than guessing the average. Best for regression problems.` },
    { key: "rmse", label: "RMSE", why: "Root Mean Squared Error — the typical prediction error, but punishes big mistakes more. In the same units target. Best for regression problems." },
    { key: "mae", label: "MAE", why: "Mean Absolute Error — the average prediction miss. Easier to understand than RMSE. Best for regression problems." },
  ];

  const problemRationale = isClass
    ? `Your target "${target}" has a small, fixed set of outcomes (categories like Yes/No). So this is a classification problem. Focus on Accuracy, Precision, Recall, F1, and ROC-AUC — they measure how well the model puts rows into the right category. R², RMSE, and MAE are also shown but are less meaningful here because there's no numeric distance between categories.`
    : `Your target "${target}" is a continuous number (like price or score). So this is a regression problem. Focus on R², RMSE, and MAE — they measure how close predictions are to actual values. Accuracy, Precision, Recall, F1, and ROC-AUC are also shown but are less meaningful here because there are no fixed categories to be "right" or "wrong" about.`;

  return { winReasons, metricExplainer, problemRationale };
}

export function mockAssistantReply(userMsg, ctx) {
  const m = userMsg.toLowerCase();
  if (!ctx.hasDataset) {
    return "Upload a dataset (CSV, Excel, or JSON) to get started. Once loaded, I'll suggest a target column and problem based on your data.";
  }
  if (m.includes("target") || m.includes("column")) {
    return `Based on the columns and cardinality, "${ctx.target ?? "churned"}" looks like a strong target — binary, no missing values, well-distributed. I'd frame this classification problem.`;
  }
  if (m.includes("model") || m.includes("best")) {
    return "For tabular data of this size, gradient boosting (XGBoost / LightGBM) and Random Forest usually dominate. Neural nets need more rows to shine here.";
  }
  if (m.includes("metric")) {
    return "For imbalanced classification I'd lean on F1 and ROC-AUC over raw accuracy. For regression, watch R² alongside RMSE.";
  }
  if (m.includes("deploy") || m.includes("export")) {
    return "After training, click 'Download Deployable Code' — you'll get a ZIP with the trained model, a FastAPI wrapper, and a requirements.txt.";
  }
  return "Got it. Once training finishes, I can walk you through feature importance, calibration, or how to interpret each metric — just ask.";
}
