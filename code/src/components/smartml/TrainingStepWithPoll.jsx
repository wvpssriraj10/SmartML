import { useEffect, useRef, useState } from "react";
import { TrainingStep } from "@/components/smartml/TrainingStep";
import { API_BASE } from "@/api";

// Must match MODEL_NAMES in index.jsx (free-tier cap: 4 models)
const MODEL_LIST = [
  "Logistic Regression",
  "Decision Tree",
  "Random Forest",
  "Naive Bayes",
];

function parseModelName(message) {
  if (!message) return null;
  // Logs look like: "Training XGBoost…", "Random Forest completed.", "Decision Tree failed: …"
  const m = message.match(/^(?:Training |.+? training )?([\w .]+?)(\.{3}| completed\.| failed:.*|\.)?$/i);
  return m && m[1] ? m[1].trim() : null;
}

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
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState(null);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const statusTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const lastActivityRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastLogCountRef = useRef(0);

  useEffect(() => {
    if (!datasetId) return;
    doneRef.current = false;
    elapsedRef.current = 0;
    setElapsed(0);
    setStatus("queued");
    setProgress(0);
    setLogs([]);
    setStalled(false);
    setError(null);
    lastActivityRef.current = Date.now();
    lastProgressRef.current = 0;
    lastLogCountRef.current = 0;
    // Initialize with fixed 4-model roster
    setModels(MODEL_LIST.map((name) => ({ name, status: "queued", progress: 0 })));

    const elapsedTimer = window.setInterval(() => {
      if (!doneRef.current) {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }
    }, 1000);
    elapsedTimerRef.current = elapsedTimer;

    const statusTimer = window.setInterval(async () => {
      if (doneRef.current) return;
      try {
        const r = await fetch(`${API_BASE}/status/${datasetId}`);
        if (!r.ok) return;
        const data = await r.json();
        setStatus(data.status || "running");
        const percent = data.progress?.percent ?? 0;
        const logCount = data.logs?.length ?? 0;
        if (percent !== lastProgressRef.current || logCount !== lastLogCountRef.current) {
          lastActivityRef.current = Date.now();
          lastProgressRef.current = percent;
          lastLogCountRef.current = logCount;
        } else if (Date.now() - lastActivityRef.current > 90000 && !doneRef.current) {
          setStalled(true);
        }
        if (data.progress?.percent != null) setProgress(percent);
        if (data.logs?.length) setLogs(data.logs);
        if (data.target_column) setTarget(data.target_column);
        if (data.problem_type) setProblemType(data.problem_type);

        // Update status for models in our fixed roster only
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
            if (!name) return;
            // Only update if model is in our roster
            const idx = idxOf(name);
            if (idx === -1) return;
            if (/ completed\./.test(raw)) apply(name, (m) => ({ ...m, status: "completed", progress: 100 }));
            else if (/ failed:/.test(raw)) apply(name, (m) => ({ ...m, status: "failed", progress: 100 }));
            else if (/^Training/.test(raw)) apply(name, (m) => ({ ...m, status: "training", progress: Math.max(m.progress, 30) }));
          });

          (data.progress?.current_model && data.status === "running") &&
            apply(data.progress.current_model, (m) => (m.status === "queued" ? { ...m, status: "training", progress: 30 } : m));

          return next;
        });

        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          doneRef.current = true;
          if (data.status === "failed") setError(data.message || "Training failed.");
          if (data.status === "cancelled") setError(data.message || "Training cancelled.");
          window.clearInterval(statusTimer);
          window.clearInterval(elapsedTimer);
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 2000);
    statusTimerRef.current = statusTimer;

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [datasetId]);

  const handleCancel = async () => {
    if (doneRef.current) return;
    try {
      await fetch(`${API_BASE}/jobs/${datasetId}/cancel`, { method: "POST" });
      setStatus("cancelled");
      setError("Training cancelled.");
      doneRef.current = true;
      if (statusTimerRef.current) window.clearInterval(statusTimerRef.current);
      if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    } catch {
      /* ignore */
    }
  };

  return (
    <TrainingStep
      target={target}
      problemType={problemType}
      status={status}
      progress={progress}
      elapsed={elapsed}
      logs={logs}
      models={models}
      stalled={stalled}
      error={error}
      onCancel={handleCancel}
    />
  );
}