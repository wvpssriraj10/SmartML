import { useEffect, useState } from "react";
import { TrainingStep } from "@/components/smartml/TrainingStep";
import { API_BASE } from "@/api";

export function TrainingStepWithPoll({ datasetId }) {
  const [status, setStatus] = useState("queued");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState([]);
  const [models, setModels] = useState([]);
  const [target, setTarget] = useState("");
  const [problemType, setProblemType] = useState("");

  useEffect(() => {
    if (!datasetId) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/status/${datasetId}`);
        if (!r.ok) return;
        const data = await r.json();
        setStatus(data.status || "running");
        setProgress(data.progress?.percent || 0);
        setLogs(data.logs || []);
        if (data.progress?.current_model) {
          setModels((prev) => {
            const idx = prev.findIndex((m) => m.name === data.progress.current_model);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], status: "training", progress: Math.max(next[idx].progress, 30) };
              return next;
            }
            return prev;
          });
        }
        if (data.results) {
          setModels((prev) => prev.map((m) => {
            const res = data.results.find((r) => r.model_name === m.name);
            if (res) return { ...m, status: "completed", progress: 100, metric: res.metrics?.f1_score || res.metrics?.r2_score };
            return m;
          }));
        }
        if (data.target_column) setTarget(data.target_column);
        if (data.problem_type) setProblemType(data.problem_type);
        if (data.status === "completed") clearInterval(timer);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(timer);
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