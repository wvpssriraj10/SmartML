import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE } from "@/api";
import { clearActiveDataset, setActiveDataset } from "@/lib/active-dataset";
import { ML_MODES } from "@/lib/ml-modes";
import {
  KNOWN_MODEL,
  STEPS_FOR,
  discoverModelNames,
  makeId,
} from "@/lib/smartml-constants";
import { mapInspection, mapResults } from "@/lib/smartml-mappers";

const STALL_AFTER_MS = 90 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function buildModelStates(logs, progressData) {
  const modelNames = discoverModelNames(logs, progressData?.current_model);
  const nextStates = modelNames.map((name) => ({ name, status: "queued", progress: 0 }));

  (logs || []).forEach((entry) => {
    const raw = entry?.message || "";
    const m = raw.match(/^(?:Training |.+? training )?([\w .]+?)(?:…|\.{3}| completed\.| failed:.*|\.)?$/i);
    const model = m && m[1] && KNOWN_MODEL.has(m[1].trim()) ? m[1].trim() : null;
    if (!model) return;
    const idx = nextStates.findIndex((s) => s.name.toLowerCase() === model.toLowerCase());
    if (idx === -1) return;
    if (/completed\./i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: "completed", progress: 100 };
    } else if (/failed:/i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: "failed", progress: 100 };
    } else if (/Training/i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: "training", progress: Math.max(nextStates[idx].progress, 30) };
    }
  });

  if (progressData?.current_model) {
    const idx = nextStates.findIndex((m) => m.name.toLowerCase() === progressData.current_model.toLowerCase());
    if (idx >= 0 && nextStates[idx].status === "queued") {
      nextStates[idx] = { ...nextStates[idx], status: "training", progress: 30 };
    }
  }

  return nextStates;
}

function buildAlgoStates(algoNames, logs, progressData, phase = "running") {
  const nextStates = algoNames.map((name) => ({ name, status: "queued", progress: 0 }));
  (logs || []).forEach((entry) => {
    const raw = entry?.message || "";
    const m = raw.match(/^([\w .-]+?)(: fitting on.*)?(\.{3}| complete\.| completed\.| failed:.*|\.)?$/i);
    const matchedName = algoNames.find((a) => a.toLowerCase() === (m?.[1] || "").trim().toLowerCase());
    if (!matchedName) return;
    const idx = nextStates.findIndex((s) => s.name === matchedName);
    if (idx === -1) return;
    if (/complete|completed/i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: "completed", progress: 100 };
    } else if (/failed:/i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: "failed", progress: 100 };
    } else if (/fitting/i.test(raw)) {
      nextStates[idx] = { ...nextStates[idx], status: phase, progress: 30 };
    }
  });
  if (progressData?.current_model) {
    const idx = algoNames.findIndex((a) => a.toLowerCase() === progressData.current_model.toLowerCase());
    if (idx >= 0 && nextStates[idx]?.status === "queued") {
      nextStates[idx] = { ...nextStates[idx], status: phase, progress: 40 };
    }
  }
  return nextStates;
}

export function useSmartML() {
  // Sanitize a possibly-stale mode value (from an older bundle) back to predict.
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem("smartml_mode");
    return saved && saved in ML_MODES ? saved : "predict";
  });
  const [step, setStep] = useState("mode");
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
  const [trainingStalled, setTrainingStalled] = useState(false);
  const [trainingError, setTrainingError] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);

  const [clusterCfg, setClusterCfg] = useState(null);
  const [clusterResults, setClusterResults] = useState(null);
  const [clusterLogs, setClusterLogs] = useState([]);
  const [clusterAlgoStates, setClusterAlgoStates] = useState([]);
  const [clusterStatus, setClusterStatus] = useState("queued");
  const [clusterProgress, setClusterProgress] = useState(0);
  const [clusterElapsed, setClusterElapsed] = useState(0);

  const [anomalyCfg, setAnomalyCfg] = useState(null);
  const [anomalyResults, setAnomalyResults] = useState(null);
  const [anomalyLogs, setAnomalyLogs] = useState([]);
  const [anomalyAlgoStates, setAnomalyAlgoStates] = useState([]);
  const [anomalyStatus, setAnomalyStatus] = useState("queued");
  const [anomalyProgress, setAnomalyProgress] = useState(0);
  const [anomalyElapsed, setAnomalyElapsed] = useState(0);

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
  const lastActivityRef = useRef(Date.now());
  const lastProgressRef = useRef(0);
  const lastLogCountRef = useRef(0);

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

  const pushUser = useCallback(
    (content) => setChat((c) => [...c, { id: makeId(), role: "user", content }]),
    [],
  );
  const pushAssistant = useCallback(
    (content) => setChat((c) => [...c, { id: makeId(), role: "assistant", content }]),
    [],
  );

  const handleNewSession = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    clearActiveDataset();
    setStep("mode");
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
    setTrainingStalled(false);
    setTrainingError(null);
    setClusterCfg(null);
    setClusterResults(null);
    setClusterLogs([]);
    setClusterAlgoStates([]);
    setClusterStatus("queued");
    setClusterProgress(0);
    setClusterElapsed(0);
    setAnomalyCfg(null);
    setAnomalyResults(null);
    setAnomalyLogs([]);
    setAnomalyAlgoStates([]);
    setAnomalyStatus("queued");
    setAnomalyProgress(0);
    setAnomalyElapsed(0);
    setChat([{
      id: makeId(),
      role: "assistant",
      content: "Fresh session ready. Drop another dataset whenever you like.",
    }]);
  }, []);

  useEffect(() => {
    const onNewSession = () => handleNewSession();
    window.addEventListener("smartml:new-session", onNewSession);
    return () => window.removeEventListener("smartml:new-session", onNewSession);
  }, [handleNewSession]);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    localStorage.setItem("smartml_mode", newMode);
    pushUser(`I want to: ${ML_MODES[newMode].label}`);
    setStep("upload");
    if (newMode === "predict") {
      pushAssistant("Predict mode selected — upload a dataset and I'll inspect it, suggest a target, and train the best model.");
    } else if (newMode === "explore") {
      pushAssistant("Explore mode selected — upload a dataset and I'll group it into clusters, no target needed.");
    } else {
      pushAssistant("Detect mode selected — upload a dataset and I'll flag the unusual rows that stand out from the rest.");
    }
  }, [pushAssistant, pushUser]);

  const resolvedProblem =
    trainCfg?.problemType === "regression" ? "regression" :
    trainCfg?.problemType === "classification" ? "classification" :
    inspection?.suggestedProblem ?? "classification";

  const handleUploaded = useCallback(async (f) => {
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
      setActiveDataset(data.job_id);
      setInspection(mapped);
      setAnalysisReady(true);
      pushAssistant(
        `Inspection complete — ${mapped.rows.toLocaleString()} rows × ${mapped.cols} columns, quality ${mapped.qualityScore}/100. I'd recommend "${mapped.suggestedTarget}" target for a ${mapped.suggestedProblem} problem.`,
      );
    } catch (err) {
      pushAssistant(`Upload failed: ${err.message}. Please retry with a valid CSV/Excel/JSON file.`);
      setStep("upload");
    }
  }, [pushAssistant]);

  const handleAnalyzed = useCallback(() => setStep("cleaning"), []);

  const handleCleaningDone = useCallback(() => {
    setStep((currentStep) => {
      if (mode === "explore") return "cluster-config";
      if (mode === "detect") return "anomaly-config";
      return "inspection";
    });
  }, [mode]);

  const loadResults = useCallback(async (activeJobId) => {
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
      pushAssistant(`Done! "${mapped.ranked[0]?.name || "Best model"}" took the crown. Open the leaderboard for the full ranking, or continue to visualizations.`);
    } catch (err) {
      pushAssistant(`Could not fetch results: ${err.message}`);
    }
  }, [pushAssistant]);

  const startPollingTraining = useCallback((activeJobId) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);
    stallWarnedRef.current = false;
    lastActivityRef.current = Date.now();
    lastProgressRef.current = 0;
    lastLogCountRef.current = 0;
    setTrainingStalled(false);
    setTrainingError(null);

    timerRef.current = window.setInterval(() => {
      setTrainingElapsed((v) => v + 1);
    }, 1000);

    const poll = async () => {
      try {
        const r = await fetchWithTimeout(`${API_BASE}/status/${activeJobId}`);
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

        // Progress-backed stall detection: if percent or logs haven't changed
        // in STALL_AFTER_MS while a job is still queued/running, flag it.
        const percent = data.progress?.percent ?? 0;
        const logCount = (data.logs || []).length;
        if (percent !== lastProgressRef.current || logCount !== lastLogCountRef.current) {
          lastActivityRef.current = Date.now();
          lastProgressRef.current = percent;
          lastLogCountRef.current = logCount;
        } else if (Date.now() - lastActivityRef.current > STALL_AFTER_MS && !stallWarnedRef.current) {
          stallWarnedRef.current = true;
          setTrainingStalled(true);
          pushAssistant("Training progress has stalled — no new updates for over a minute. The worker may have hit a memory limit or hung. You can cancel and retry.");
        }

        setTrainingStatus(data.status || "running");
        setTrainingProgress(percent);
        setTrainingLogs(data.logs || []);

        const nextStates = buildModelStates(data.logs, data.progress);
        const completedCount = nextStates.filter((m) => m.status === "completed" || m.status === "failed").length;
        const evenlyDistributedProgress = completedCount > 0 ? Math.round((completedCount / nextStates.length) * 100) : trainingProgress;
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
        if (data.status === "cancelled") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          setTrainingStatus("cancelled");
          setTrainingError(data.message || "Training cancelled.");
          pushAssistant(data.message || "Training was cancelled.");
        }
        if (data.status === "failed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          setTrainingStatus("failed");
          setTrainingError(data.message || "Training failed — unknown error.");
          pushAssistant(`Training failed: ${data.message || "Unknown error"}. You can retry from the training screen.`);
        }
      } catch (err) {
        if (Date.now() - lastActivityRef.current > STALL_AFTER_MS) {
          if (!stallWarnedRef.current) {
            stallWarnedRef.current = true;
            setTrainingStalled(true);
            pushAssistant("Training progress has stalled — the worker is not responding to status checks. You can cancel and retry.");
          }
        } else {
          pushAssistant(`Status check error: ${err.message}`);
        }
      }
    };

    poll();
    pollRef.current = window.setInterval(poll, 2000);
  }, [pushAssistant, trainingProgress]);

  const handleStartTraining = useCallback(async (cfg) => {
    if (!jobId) return;
    setTrainCfg(cfg);
    setStep("training");
    setTrainingElapsed(0);
    setTrainingStatus("queued");
    setTrainingProgress(0);
    setTrainingLogs([]);
    setTrainingStalled(false);
    setTrainingError(null);
    setModelStates([]);
    pushAssistant(`Training the model lineup to predict "${cfg.target}" (free-tier limit) — I'll narrate progress and highlight the champion when it emerges.`);

    try {
      const r = await fetchWithTimeout(`${API_BASE}/train`, {
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
  }, [jobId, pushAssistant, startPollingTraining]);

  const handleRetryTraining = useCallback(async () => {
    if (!trainCfg) return;
    pushAssistant("Retrying training with the same configuration…");
    await handleStartTraining(trainCfg);
  }, [handleStartTraining, pushAssistant, trainCfg]);

  const handleCancelTraining = useCallback(async () => {
    if (!jobId) return;
    setTrainingStalled(false);
    pushAssistant("Cancelling training — the worker will stop after the current step.");
    try {
      const r = await fetchWithTimeout(`${API_BASE}/jobs/${jobId}/cancel`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Cancel failed");
      setTrainingStatus("cancelled");
      setTrainingError(data.message || "Training cancelled.");
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (pollRef.current) window.clearInterval(pollRef.current);
    } catch (err) {
      pushAssistant(`Could not cancel training: ${err.message}`);
    }
  }, [jobId, pushAssistant]);

  const handleResultsDone = useCallback(() => setStep("visualization"), []);

  const handleVisualizationDone = useCallback(() => setStep("export"), []);

  const handleResumeJob = useCallback(async (savedJob) => {
    try {
      const r = await fetch(`${API_BASE}/jobs/${savedJob.id}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Load job failed (${r.status})`);
      }
      const data = await r.json();
      setMode("predict");
      localStorage.setItem("smartml_mode", "predict");
      setFile({ name: data.filename });
      setActiveDataset(data.job_id);
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
  }, [loadResults, pushAssistant]);

  const handleDownload = useCallback(async () => {
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
  }, [jobId, pushAssistant, results]);

  const loadClusterResults = useCallback(async (activeJobId) => {
    try {
      const r = await fetch(`${API_BASE}/cluster/results/${activeJobId}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Cluster results fetch failed (${r.status})`);
      }
      const data = await r.json();
      setClusterResults(data.results || []);
      setClusterStatus("completed");
      setStep("cluster-results");
      const summary = data.summary || {};
      pushAssistant(
        `Clusters ready! ${summary.algorithms_run || data.results?.length} algorithm${data.results?.length === 1 ? "" : "s"} analyzed ${(summary.rows_analyzed ?? 0).toLocaleString()} rows. Explore the map and cluster cards.`,
      );
    } catch (err) {
      pushAssistant(`Could not fetch cluster results: ${err.message}`);
    }
  }, [pushAssistant]);

  const startPollingCluster = useCallback((activeJobId, algos) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);

    timerRef.current = window.setInterval(() => {
      setClusterElapsed((v) => v + 1);
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
        setClusterStatus(data.status || "running");
        setClusterProgress(data.progress?.percent ?? 0);
        setClusterLogs(data.logs || []);

        setClusterAlgoStates(buildAlgoStates(algos, data.logs, data.progress));

        if (data.status === "completed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          await loadClusterResults(activeJobId);
        }
        if (data.status === "failed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          setClusterStatus("failed");
          pushAssistant(`Clustering failed: ${data.message || "Unknown error"} — going back to cluster settings so you can adjust and retry.`);
          setStep("cluster-config");
        }
      } catch (err) {
        pushAssistant(`Status check error: ${err.message}`);
      }
    };

    poll();
    pollRef.current = window.setInterval(poll, 2000);
  }, [loadClusterResults, pushAssistant]);

  const handleStartClustering = useCallback(async (cfg) => {
    if (!jobId) return;
    setClusterCfg(cfg);
    setStep("cluster-train");
    setClusterElapsed(0);
    setClusterStatus("queued");
    setClusterProgress(0);
    setClusterLogs([]);
    setClusterAlgoStates((cfg.algorithms || []).map((name) => ({ name, status: "queued", progress: 0 })));
    pushAssistant(`Starting clustering with ${(cfg.algorithms || []).length} algorithm${(cfg.algorithms || []).length === 1 ? "" : "s"} — I'll narrate as each one finishes.`);

    try {
      const r = await fetch(`${API_BASE}/cluster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          algorithms: cfg.algorithms,
          n_clusters: cfg.n_clusters,
          columns: cfg.columns?.length ? cfg.columns : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Failed to start clustering");
      startPollingCluster(jobId, cfg.algorithms || []);
    } catch (err) {
      pushAssistant(`Could not start clustering: ${err.message}`);
      setStep("cluster-config");
    }
  }, [jobId, pushAssistant, startPollingCluster]);

  const handleDownloadClusters = useCallback(async () => {
    if (!jobId || !clusterResults?.[0]) return;
    pushAssistant("Packaging cluster assignments + profiles into a ZIP…");
    try {
      const r = await fetch(`${API_BASE}/cluster/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, model_name: clusterResults[0].model }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Cluster export failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartml_clusters_${clusterResults[0].model.replace(/\s+/g, "_").toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushAssistant(`Cluster export failed: ${err.message}`);
    }
  }, [clusterResults, jobId, pushAssistant]);

  const loadAnomalyResults = useCallback(async (activeJobId) => {
    try {
      const r = await fetch(`${API_BASE}/anomaly/results/${activeJobId}`);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Anomaly results fetch failed (${r.status})`);
      }
      const data = await r.json();
      setAnomalyResults(data);
      setAnomalyStatus("completed");
      setStep("anomaly-results");
      const summary = data.summary || {};
      pushAssistant(
        `Scan complete! ${summary.detectors_run || data.results?.length} detector${data.results?.length === 1 ? "" : "s"} flagged ${(summary.flagged_count ?? 0).toLocaleString()} unusual rows across ${(summary.rows_analyzed ?? 0).toLocaleString()} analyzed. Review the flagged rows and export when ready.`,
      );
    } catch (err) {
      pushAssistant(`Could not fetch anomaly results: ${err.message}`);
    }
  }, [pushAssistant]);

  const startPollingAnomaly = useCallback((activeJobId, detectors) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (pollRef.current) window.clearInterval(pollRef.current);

    timerRef.current = window.setInterval(() => {
      setAnomalyElapsed((v) => v + 1);
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
        setAnomalyStatus(data.status || "running");
        setAnomalyProgress(data.progress?.percent ?? 0);
        setAnomalyLogs(data.logs || []);

        setAnomalyAlgoStates(buildAlgoStates(detectors, data.logs, data.progress));

        if (data.status === "completed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          await loadAnomalyResults(activeJobId);
        }
        if (data.status === "failed") {
          window.clearInterval(pollRef.current);
          window.clearInterval(timerRef.current);
          setAnomalyStatus("failed");
          pushAssistant(`Anomaly scan failed: ${data.message || "Unknown error"} — going back to detector settings so you can adjust and retry.`);
          setStep("anomaly-config");
        }
      } catch (err) {
        pushAssistant(`Status check error: ${err.message}`);
      }
    };

    poll();
    pollRef.current = window.setInterval(poll, 2000);
  }, [loadAnomalyResults, pushAssistant]);

  const handleStartAnomaly = useCallback(async (cfg) => {
    if (!jobId) return;
    setAnomalyCfg(cfg);
    setStep("anomaly-train");
    setAnomalyElapsed(0);
    setAnomalyStatus("queued");
    setAnomalyProgress(0);
    setAnomalyLogs([]);
    setAnomalyAlgoStates((cfg.detectors || []).map((name) => ({ name, status: "queued", progress: 0 })));
    pushAssistant(`Scanning your data with ${(cfg.detectors || []).length} detector${(cfg.detectors || []).length === 1 ? "" : "s"} — I'll narrate as each one finishes.`);

    try {
      const r = await fetch(`${API_BASE}/anomaly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          detectors: cfg.detectors,
          contamination: cfg.contamination,
          columns: cfg.columns?.length ? cfg.columns : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Failed to start anomaly scan");
      startPollingAnomaly(jobId, cfg.detectors || []);
    } catch (err) {
      pushAssistant(`Could not start anomaly scan: ${err.message}`);
      setStep("anomaly-config");
    }
  }, [jobId, pushAssistant, startPollingAnomaly]);

  const handleDownloadAnomaly = useCallback(async () => {
    if (!jobId || !anomalyResults?.results?.[0]) return;
    pushAssistant("Packaging anomaly scores + profiles into a ZIP…");
    try {
      const r = await fetch(`${API_BASE}/anomaly/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, model_name: anomalyResults.results[0].detector }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Anomaly export failed");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartml_anomalies_${anomalyResults.results[0].detector.replace(/\s+/g, "_").toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushAssistant(`Anomaly export failed: ${err.message}`);
    }
  }, [anomalyResults, jobId, pushAssistant]);

  const sendChatMessage = useCallback(async (text) => {
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
  }, [chat, inspection, jobId, step]);

  return {
    mode,
    step,
    setStep,
    connected,
    file,
    jobId,
    analysisReady,
    inspection,
    trainCfg,
    results,
    backendResults,
    trainingStatus,
    trainingProgress,
    trainingLogs,
    modelStates,
    trainingElapsed,
    trainingStalled,
    trainingError,
    recentJobs,
    clusterCfg,
    clusterResults,
    clusterLogs,
    clusterAlgoStates,
    clusterStatus,
    clusterProgress,
    clusterElapsed,
    anomalyCfg,
    anomalyResults,
    anomalyLogs,
    anomalyAlgoStates,
    anomalyStatus,
    anomalyProgress,
    anomalyElapsed,
    chat,
    resolvedProblem,
    onModeChange: handleModeChange,
    onUploaded: handleUploaded,
    onAnalyzed: handleAnalyzed,
    onCleaningDone: handleCleaningDone,
    onStartTraining: handleStartTraining,
    onRetryTraining: handleRetryTraining,
    onCancelTraining: handleCancelTraining,
    onResultsDone: handleResultsDone,
    onVisualizationDone: handleVisualizationDone,
    onNewSession: handleNewSession,
    onResumeJob: handleResumeJob,
    onDownload: handleDownload,
    onStartClustering: handleStartClustering,
    onDownloadClusters: handleDownloadClusters,
    onStartAnomaly: handleStartAnomaly,
    onDownloadAnomaly: handleDownloadAnomaly,
    pushUser,
    pushAssistant,
    sendChatMessage,
  };
}