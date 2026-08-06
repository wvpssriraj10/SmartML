import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatFab } from "@/components/smartml/ChatFab";
import { UploadStep } from "@/components/smartml/UploadStep";
import { AnalyzingStep } from "@/components/smartml/AnalyzingStep";
import { InspectionStep } from "@/components/smartml/InspectionStep";
import { TrainingStep } from "@/components/smartml/TrainingStep";
import { ResultsStep } from "@/components/smartml/ResultsStep";
import { Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: SmartMLApp,
});

import { API_BASE } from "@/api";
const MODEL_NAMES = [
  "Logistic Regression",
  "Decision Tree",
  "Random Forest",
  "XGBoost",
];

const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "analyzing", label: "Analyze" },
  { key: "inspection", label: "Configure" },
  { key: "training", label: "Train" },
  { key: "results", label: "Results" },
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function SmartMLApp() {
  const [step, setStep] = useState("upload");
  const [connected, setConnected] = useState(false);
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [trainCfg, setTrainCfg] = useState(null);
  const [results, setResults] = useState(null);
  const [backendResults, setBackendResults] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState("queued");
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [modelStates, setModelStates] = useState([]);
  const [trainingElapsed, setTrainingElapsed] = useState(0);
  const [recentJobs, setRecentJobs] = useState([]);

  const [chat, setChat] = useState([
    {
      id: makeId(),
      role: "assistant",
      content: "Welcome to SmartML. Drop a dataset on the left and I'll guide you through inspection, training, and deployment — right here in this chat.",
    },
  ]);

  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const stallWarnedRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE}/health`);
        setConnected(r.ok);
        if (r.ok) {
          const jobsResponse = await fetch(`${API_BASE}/jobs?limit=8`);
          if (jobsResponse.ok) {
            const jobsData = await jobsResponse.json();
            setRecentJobs(jobsData.jobs || []);
          }
        }
      } catch {
        setConnected(false);
      }
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, []);

  const pushUser = (content) =>
    setChat((c) => [...c, { id: makeId(), role: "user", content }]);
  const pushAssistant = (content) =>
    setChat((c) => [...c, { id: makeId(), role: "assistant", content }]);

  const resolvedProblem =
    trainCfg?.problemType === "regression" ? "regression" :
    trainCfg?.problemType === "classification" ? "classification" :
    inspection?.suggestedProblem ?? "classification";

  const mapInspection = (apiInspection, fileName) => {
    const rows = apiInspection.rows ?? 0;
    const columns = apiInspection.column_names || [];
    const dtypes = apiInspection.dtypes || {};
    const missing = apiInspection.missing_values || {};
    const colStats = apiInspection.column_stats || {};
    const numeric = new Set(apiInspection.numeric_columns || []);
    const datetime = new Set(apiInspection.datetime_columns || []);
    const previewHeaders = apiInspection.preview_headers || [];
    const previewRows = apiInspection.preview_rows || [];

    return {
      filename: fileName,
      qualityScore: apiInspection.kpis?.data_quality_score ?? 100,
      rows,
      cols: apiInspection.columns ?? columns.length,
      totalCells: rows * (apiInspection.columns ?? columns.length),
      missingCells: Object.values(missing).reduce((sum, value) => sum + (value || 0), 0),
      duplicates: apiInspection.duplicate_rows ?? 0,
      columns: columns.map((name) => ({
        name,
        type: numeric.has(name) ? "numeric" : datetime.has(name) ? "datetime" : "categorical",
        missingPct: rows > 0 ? ((missing[name] || 0) / rows) * 100 : 0,
        unique: colStats[name]?.unique_count ?? 0,
        dtype: dtypes[name] || "unknown",
      })),
      preview: previewRows.map((values) => {
        const row = {};
        previewHeaders.forEach((header, idx) => {
          row[header] = values[idx];
        });
        return row;
      }),
      suggestedTarget: apiInspection.suggested_target || columns[columns.length - 1] || "",
      suggestedProblem: apiInspection.suggested_problem_type || "classification",
      targetReason: [
        `Based on column profiling, "${apiInspection.suggested_target || columns[columns.length - 1] || "target"}" is likely a strong prediction target.`,
        `Detected ${apiInspection.numeric_columns?.length || 0} numeric and ${apiInspection.categorical_columns?.length || 0} categorical columns for feature learning.`,
        `Missing values are automatically handled in preprocessing before training.`,
      ],
    };
  };

  const mapResults = (apiResults) => {
    const problemType = apiResults.problem_type || "classification";
    const sortKey = problemType === "classification" ? "f1_score" : "r2_score";
    const ranked = [...(apiResults.results || [])]
      .sort((a, b) => (b.metrics?.[sortKey] ?? 0) - (a.metrics?.[sortKey] ?? 0))
      .map((item, idx) => {
        const metrics = { ...(item.metrics || {}) };
        if (metrics.f1_score != null && metrics.f1 == null) metrics.f1 = metrics.f1_score;
        if (metrics.r2_score != null && metrics.r2 == null) metrics.r2 = metrics.r2_score;
        return ({
        name: item.model_name,
        rank: idx + 1,
        isChampion: idx === 0,
        metrics,
        trainTimeSec: item.training_time || 0,
        status: item.status || "completed",
      });
      });
    return { problemType, ranked };
  };

  const handleUploaded = async (f) => {
    setFile(f);
    setStep("analyzing");
    setAnalysisReady(false);
    pushAssistant(`Received "${f.name}". Kicking off inspection — I'll surface schema, missing rates, and a target suggestion in a moment.`);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Upload failed");
      const mapped = mapInspection(data.inspection, f.name);
      setJobId(data.job_id);
      setInspection(mapped);
      setAnalysisReady(true);
      pushAssistant(
        `Inspection complete — ${mapped.rows.toLocaleString()} rows × ${mapped.cols} columns, quality ${mapped.qualityScore}/100. I'd recommend "${mapped.suggestedTarget}" target for a ${mapped.suggestedProblem} problem.`,
      );
    } catch (err) {
      pushAssistant(`Upload failed: ${err.message}. Please retry with a valid CSV/Excel/JSON file.`);
      setStep("upload");
    }
  };

  const handleAnalyzed = () => setStep("inspection");

  const handleStartTraining = async (cfg) => {
    if (!jobId) return;
    setTrainCfg(cfg);
    setStep("training");
    setTrainingElapsed(0);
    setTrainingStatus("queued");
    setTrainingProgress(0);
    setTrainingLogs([]);
    setModelStates(MODEL_NAMES.map((name) => ({ name, status: "queued", progress: 0 })));
    pushAssistant(`Training ${MODEL_NAMES.length} models to predict "${cfg.target}" (free-tier limit) — I'll narrate progress and highlight the champion when it emerges.`);

    try {
      const r = await fetch(`${API_BASE}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          target_column: cfg.target,
          problem_type: cfg.problemType === "auto" ? null : cfg.problemType,
          model_selection: cfg.strategy?.toLowerCase().includes("all") ? "all" : "smart",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Failed to start training");
      startPollingTraining(data.job_id);
    } catch (err) {
      pushAssistant(`Could not start training: ${err.message}`);
      setStep("inspection");
    }
  };

  const handleNewSession = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    setStep("upload");
    setConnected(connected);
    setFile(null);
    setJobId(null);
    setAnalysisReady(false);
    setInspection(null);
    setTrainCfg(null);
    setResults(null);
    setBackendResults(null);
    setTrainingStatus("queued");
    setTrainingProgress(0);
    setTrainingLogs([]);
    setModelStates([]);
    setTrainingElapsed(0);
    setChat([{
      id: makeId(),
      role: "assistant",
      content: "Fresh session ready. Drop another dataset whenever you like.",
    }]);
  };

  const startPollingTraining = (activeJobId) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    stallWarnedRef.current = false;

    timerRef.current = window.setInterval(() => {
      setTrainingElapsed((v) => v + 1);
    }, 1000);

    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/status/${activeJobId}`);
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`Status check failed (${r.status}): ${text.slice(0, 200)}`);
        }
        let data;
        try {
          data = await r.json();
        } catch {
          throw new Error("Backend returned invalid JSON (may be restarting)");
        }
        if (!data) throw new Error("Backend returned empty response");
        setTrainingStatus(data.status || "running");
        setTrainingProgress(data.progress?.percent ?? 0);
        setTrainingLogs(data.logs || []);

        const nextStates = MODEL_NAMES.map((name) => ({ name, status: "queued", progress: 0 }));
        (data.logs || []).forEach((entry) => {
          const model = MODEL_NAMES.find((n) => entry.message?.startsWith(n));
          if (!model) return;
          const idx = nextStates.findIndex((m) => m.name === model);
          if (idx === -1) return;
          if (/completed\./i.test(entry.message)) {
            nextStates[idx] = { ...nextStates[idx], status: "completed", progress: 100 };
          } else if (/failed:/i.test(entry.message)) {
            nextStates[idx] = { ...nextStates[idx], status: "failed", progress: 100 };
          } else if (/Training/i.test(entry.message)) {
            nextStates[idx] = { ...nextStates[idx], status: "training", progress: Math.max(nextStates[idx].progress, 30) };
          }
        });
        if (data.progress?.current_model) {
          const idx = nextStates.findIndex((m) => m.name === data.progress.current_model);
          if (idx >= 0 && nextStates[idx].status === "queued") {
            nextStates[idx] = { ...nextStates[idx], status: "training", progress: 30 };
          }
        }
        const completedCount = nextStates.filter((m) => m.status === "completed" || m.status === "failed").length;
        const evenlyDistributedProgress = completedCount > 0 ? Math.round((completedCount / MODEL_NAMES.length) * 100) : trainingProgress;
        setModelStates(nextStates.map((m) => {
          if (m.status === "completed" || m.status === "failed") return m;
          if (m.status === "training") return { ...m, progress: Math.max(m.progress, evenlyDistributedProgress) };
          return m;
        }));

        if (data.status === "completed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          await loadResults(activeJobId);
        }
        if (data.status === "failed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          pushAssistant(`Training failed: ${data.message || "Unknown error"}`);
        }

        if ((data.status === "running" || data.status === "queued") && completedCount === 0) {
          const noLogs = !data.logs || data.logs.length === 0;
          if (trainingElapsed > 90 && !stallWarnedRef.current && (noLogs || data.progress?.percent === 0)) {
            stallWarnedRef.current = true;
            pushAssistant("Still waiting for the first model to report back — on the free tier the backend may be spinning up or the worker may have hit a memory limit. If this persists past a few minutes, restart training.");
          }
        }
      } catch (err) {
        pushAssistant(`Status check error: ${err.message}`);
      }
    };

    poll();
    pollRef.current = window.setInterval(poll, 2000);
  };

  const loadResults = async (activeJobId) => {
    try {
      const r = await fetch(`${API_BASE}/results/${activeJobId}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Results fetch failed (${r.status})`);
      }
      const data = await r.json();
      const mapped = mapResults(data);
      setBackendResults(data);
      setResults(mapped.ranked);
      setStep("results");
      pushAssistant(`Done! "${mapped.ranked[0]?.name || "Best model"}" took the crown. Open the leaderboard for the full ranking, or download the deployable bundle when you're ready.`);
    } catch (err) {
      pushAssistant(`Could not fetch results: ${err.message}`);
    }
  };

  const handleResumeJob = async (savedJob) => {
    try {
      const r = await fetch(`${API_BASE}/jobs/${savedJob.id}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Load job failed (${r.status})`);
      }
      const data = await r.json();
      setFile({ name: data.filename });
      const mappedInspection = mapInspection(data.inspection, data.filename);
      setInspection(mappedInspection);
      setTrainCfg(data.target_column ? {
        target: data.target_column,
        problemType: data.problem_type || mappedInspection.suggestedProblem,
        strategy: "Smart selection",
      } : null);

      if (data.status === "completed") {
        await loadResults(data.job_id);
      } else {
        setAnalysisReady(true);
        setStep("inspection");
        pushAssistant(`Reopened "${data.filename}". Your inspection is ready; review the target and continue training.`);
      }
    } catch (err) {
      pushAssistant(`Could not reopen dataset: ${err.message}`);
    }
  };

  const handleDownload = async () => {
    if (!jobId) return;
    pushAssistant("Packaging model + FastAPI wrapper + requirements.txt into a ZIP…");
    try {
      const r = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, model_name: results?.[0]?.name || null }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Export failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartml_export_${results?.[0]?.name?.replace(/\s+/g, "_").toLowerCase() || "best"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushAssistant(`Export failed: ${err.message}`);
    }
  };

  const sendChatMessage = async (text) => {
    if (!jobId) {
      return "Upload a dataset first so I can answer with your dataset context.";
    }
    const history = chat.map((m) => ({ role: m.role, content: m.content }));
    try {
      const r = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, message: text, history }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Chat failed");
      if (data.suggested_target) {
        setInspection((prev) => prev ? {
          ...prev,
          suggestedTarget: data.suggested_target,
          suggestedProblem: data.suggested_problem_type || prev.suggestedProblem,
        } : prev);

        if (step === "inspection") {
          setTrainCfg((prev) => ({
            target: data.suggested_target,
            problemType: data.suggested_problem_type || prev?.problemType || inspection?.suggestedProblem || "auto",
            strategy: prev?.strategy || "Balanced (recommended)",
          }));
        }
      }
      return data.reply || "I could not generate a response.";
    } catch {
      return "Chat service is unavailable right now. You can still continue training and review results.";
    }
  };

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <>
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-12">
        <main className="min-w-0 lg:col-span-12">
          {/* Stepper */}
          <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    active ? "border-primary/60 bg-primary/15 text-foreground" :
                    done ? "border-emerald/40 bg-emerald/10 text-emerald" :
                    "border-border/60 text-muted-foreground"
                  }`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? "bg-[image:var(--gradient-primary)] text-white" :
                      done ? "bg-emerald text-background" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className={`h-px w-6 ${i < currentIdx ? "bg-emerald/50" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>

          {step === "upload" && <UploadStep onUploaded={handleUploaded} onResumeJob={handleResumeJob} recentJobs={recentJobs} />}
          {step === "analyzing" && <AnalyzingStep fileName={file?.name ?? "dataset"} ready={analysisReady} onDone={handleAnalyzed} />}
          {step === "inspection" && inspection && (
            <InspectionStep inspection={inspection} onStartTraining={handleStartTraining} />
          )}
          {step === "training" && (
            <TrainingStep
              target={trainCfg?.target}
              problemType={trainCfg?.problemType}
              status={trainingStatus}
              progress={trainingProgress}
              elapsed={trainingElapsed}
              logs={trainingLogs}
              models={modelStates}
            />
          )}
          {step === "results" && results && inspection && backendResults && (
            <ResultsStep
              results={results}
              problemType={backendResults.problem_type || resolvedProblem}
              columns={inspection.columns}
              target={trainCfg?.target}
              onNewSession={handleNewSession}
              onDownload={handleDownload}
            />
          )}

        </main>
      </div>
      <ChatFab messages={chat} onSend={pushUser} onAssistantReply={pushAssistant} onAsk={sendChatMessage} />
    </>
  );
}
