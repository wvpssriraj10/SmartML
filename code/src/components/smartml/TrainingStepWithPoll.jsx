import { useEffect, useRef, useState } from "react";
import { TrainingStep } from "@/components/smartml/TrainingStep";
import { API_BASE } from "@/api";

const FALLBACK_MODELS = [
  "Logistic Regression",
  "Decision Tree",
  "Random Forest",
  "XGBoost",
];

function parseModelName(message) {
  if (!message) return null;
  // Logs look like: "Training XGBoost…", "Random Forest completed.", "Decision Tree failed: …"
  const m = message.match(/^(?:Training |.+? training )?([\w .]+?)(\.{3}| completed\.| failed:.*|\.)?$/i);
  return m && m[1] ? m[1].trim() : null;
}

// Keep a small whitelist so we don't surface arbitrary log fragments as models.
const KNOWN = new Set([
  "Logistic Regression", "Ridge Classifier", "Decision Tree", "Random Forest",
  "Gradient Boosting", "XGBoost", "LightGBM", "SVM", "KNN", "Neural Net",
  "Naive Bayes", "Ridge Regression", "Lasso Regression",
]);

function modelKey(name) {
  return name.trim().toLowerCase();
}

export function TrainingStepWithPoll({ datasetId }) {
  const [status, setStatus] = useState("queued");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState([]);
  const [models, setModels] = useState([]);
  const [target, setTarget] = useState("");
  const [problemType, setProblemType] = useState("");
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!datasetId) return;
    doneRef.current = false;
    elapsedRef.current = 0;
    setElapsed(0);
    setStatus("queued");
    setProgress(0);
    setLogs([]);
    setModels([]);

    const elapsedTimer = window.setInterval(() => {
      if (!doneRef.current) {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }
    }, 1000);

    const statusTimer = window.setInterval(async () => {
      if (doneRef.current) return;
      try {
        const r = await fetch(`${API_BASE}/status/${datasetId}`);
        if (!r.ok) return;
        const data = await r.json();
        setStatus(data.status || "running");
        if (data.progress?.percent != null) setProgress(data.progress.percent || 0);
        if (data.logs?.length) setLogs(data.logs);
        if (data.target_column) setTarget(data.target_column);
        if (data.problem_type) setProblemType(data.problem_type);

        // Merge any newly-seen models into the roster (seeded by logs + current_model)
        setModels((prev) => {
          let next = [...prev];
          const seen = new Set(next.map((m) => modelKey(m.name)));
          const addMany = (names) => {
            for (const raw of names) {
              const name = (raw || "").trim();
              if (!name || !KNOWN.has(name)) continue;
              const key = modelKey(name);
              if (!seen.has(key)) {
                next.push({ name, status: "queued", progress: 0 });
                seen.add(key);
              }
            }
          };

          if (Array.isArray(data.logs)) {
            for (const entry of data.logs) {
              const name = parseModelName(entry?.message);
              if (name) addMany([name]);
            }
          }
          if (data.progress?.current_model) addMany([data.progress.current_model]);

          return next;
        });

        // Apply current state to each model from logs
        setModels((prev) => {
          const next = prev.map((m) => ({ ...m }));
          const idxOf = (name) => {
            const key = modelKey(name);
            return next.findIndex((m) => modelKey(m.name) === key);
          };
          const apply = (name, updater) => {
            const i = idxOf(name);
            if (i >= 0) next[i] = updater(next[i]);
          };

          (data.logs || []).forEach((entry) => {
            const raw = entry?.message || "";
            const name = parseModelName(raw);
            if (!name || !KNOWN.has(name)) return;
            if (/ completed\./.test(raw)) apply(name, (m) => ({ ...m, status: "completed", progress: 100 }));
            else if (/ failed:/.test(raw)) apply(name, (m) => ({ ...m, status: "failed", progress: 100 }));
            else if (/^Training/.test(raw)) apply(name, (m) => ({ ...m, status: "training", progress: Math.max(m.progress, 30) }));
          });

          (data.progress?.current_model && data.status === "running") &&
            apply(data.progress.current_model, (m) => (m.status === "queued" ? { ...m, status: "training", progress: 30 } : m));

          return next;
        });

        if (data.status === "completed" || data.status === "failed") {
          doneRef.current = true;
          window.clearInterval(statusTimer);
          window.clearInterval(elapsedTimer);
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 2000);

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [datasetId]);

  return (
    <TrainingStep
      target={target}
      problemType={problemType}
      status={status}
      progress={progress}
      elapsed={elapsed}
      logs={logs}
      models={models}
    />
  );
}