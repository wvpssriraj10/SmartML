import { useEffect, useMemo, useRef } from "react";
import { Clock, Terminal, AlertCircle, CheckCircle2, Loader2, XCircle, RotateCcw, Ban } from "lucide-react";

function statusIcon(s) {
  switch (s) {
    case "queued": return <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />;
    case "training": return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-rose" />;
    case "cancelled": return <Ban className="h-3.5 w-3.5 text-amber" />;
  }
}

function statusBadge(s) {
  const map = {
    queued: "bg-muted text-muted-foreground",
    training: "bg-primary/15 text-primary border border-primary/30",
    completed: "bg-emerald/15 text-emerald border border-emerald/30",
    failed: "bg-rose/15 text-rose border border-rose/30",
    cancelled: "bg-amber/15 text-amber border border-amber/30",
  };
  return map[s];
}

export function TrainingStep({
  target,
  problemType,
  status,
  progress,
  elapsed,
  logs,
  models,
  stalled = false,
  error = null,
  onRetry,
  onCancel,
}) {
  const logRef = useRef(null);

  const overall = useMemo(() => {
    if (typeof progress === "number") return progress;
    if (!models?.length) return 0;
    return (
      models.reduce((acc, m) => acc + (m.status === "completed" ? 100 : m.status === "failed" ? 100 : m.progress || 0), 0) /
      models.length
    );
  }, [progress, models]);

  // scroll logs
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const circumference = 2 * Math.PI * 62;
  const dash = (overall / 100) * circumference;

  const isActive = status === "running" || status === "queued";
  const isDone = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  const ringColor = isDone ? "oklch(0.72 0.19 160)" : isFailed || isCancelled ? "oklch(0.63 0.24 25)" : "oklch(0.68 0.19 275)";
  const ringGradId = isDone ? "ringGradDone" : isFailed || isCancelled ? "ringGradFail" : "ringGrad";

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Top: progress + timer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-panel glow-border relative flex items-center gap-6 rounded-2xl p-6 lg:col-span-2">
          <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 140 140">
              <defs>
                <linearGradient id={ringGradId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={ringColor} />
                  <stop offset="100%" stopColor="oklch(0.68 0.20 305)" />
                </linearGradient>
              </defs>
              <circle cx="70" cy="70" r="62" stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
              <circle
                cx="70"
                cy="70"
                r="62"
                stroke={`url(#${ringGradId})`}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - dash}
                style={{ transition: `stroke-dashoffset ${400}ms var(--ease-out-expo)` }}
              />
            </svg>
            <div className="relative text-center">
              <div className="text-3xl font-bold">{Math.round(overall)}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {isDone ? "Training complete" : isFailed ? "Training failed" : isCancelled ? "Training cancelled" : "Training in progress"}
            </div>
            <h2 className="mt-1 text-2xl font-bold">
              {models?.length
                ? `${models.length} ${models.length === 1 ? "model" : "models"} · racing to the top (free-tier limit)`
                : "Preparing the model lineup…"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{fmt(elapsed || 0)}</span>
                <span>elapsed</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
                <span>{(models || []).filter((m) => m.status === "completed").length} complete</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                <span>{(models || []).filter((m) => m.status === "training").length} running</span>
              </div>
            </div>

            {isActive && (onRetry || onCancel) && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose/40 bg-rose/10 px-3 text-xs font-semibold text-rose transition hover:bg-rose/20"
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancel training
                  </button>
                )}
              </div>
            )}

            {stalled && (
              <div className="animate-fade-in-up mt-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                <div>
                  <div className="font-semibold text-amber">Training appears stalled</div>
                  <div className="mt-0.5 text-muted-foreground">
                    No progress updates for over a minute. The worker may have hit a memory limit or hung.
                    {onRetry && <span> You can retry, or cancel to adjust your setup.</span>}
                  </div>
                  {(onRetry || onCancel) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {onRetry && (
                        <button
                          onClick={onRetry}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 text-xs font-semibold text-white transition hover:opacity-90"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retry training
                        </button>
                      )}
                      {onCancel && (
                        <button
                          onClick={onCancel}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-accent/60"
                        >
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(isFailed || isCancelled) && (
              <div className="animate-fade-in-up mt-4 flex items-start gap-2.5 rounded-xl border border-rose/30 bg-rose/10 p-3 text-xs">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
                <div>
                  <div className="font-semibold text-rose">{isCancelled ? "Training cancelled" : "Training failed"}</div>
                  <div className="mt-0.5 text-muted-foreground">{error || "The worker stopped before finishing."}</div>
                  {onRetry && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        onClick={onRetry}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry training
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terminal */}
        <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <Terminal className="h-4 w-4 text-emerald" />
            <div className="text-xs font-semibold">Live Logs</div>
            <span className="ml-auto flex gap-1">
              <span className="h-2 w-2 rounded-full bg-rose/70" />
              <span className="h-2 w-2 rounded-full bg-amber/70" />
              <span className="h-2 w-2 rounded-full bg-emerald/70" />
            </span>
          </div>
          <div ref={logRef} className="flex-1 max-h-64 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
            {(logs || []).map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground">{formatTimestamp(l.timestamp) || "--:--"}</span>
                <span className={
                  l.level === "success" ? "text-emerald" :
                  l.level === "warning" ? "text-amber" :
                  l.level === "error" ? "text-rose" :
                  "text-foreground/80"
                }>{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model grid */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Model Roster</div>
            <div className="text-xs text-muted-foreground">Live status across all algorithms</div>
          </div>
        </div>
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {(models || []).map((m, i) => (
              <ModelCard key={m.name} model={m} index={i} />
            ))}
          </div>
      </div>
    </div>
  );
}

function ModelCard({ model, index = 0 }) {
  const isTraining = model.status === "training";
  const isDone = model.status === "completed";
  const isCancelled = model.status === "cancelled";
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3.5 interactive-card animate-fade-in-up stagger-${(index % 8) + 1} ${  isTraining ? "border-primary/50 bg-primary/5 animate-shimmer" :
      isDone ? "border-emerald/30 bg-emerald/5" :
      isCancelled ? "border-amber/30 bg-amber/5" :
      "border-border/60 bg-card/50"
    }`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold leading-tight">{model.name}</div>
        {statusIcon(model.status)}
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${isDone ? "bg-emerald" : "bg-[image:var(--gradient-primary)]"}`}
          style={{ width: `${model.progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase ${statusBadge(model.status)}`}>
          {model.status}
        </span>
        {model.metric != null && (
          <span className="font-mono text-[11px] text-emerald">{model.metric.toFixed(3)}</span>
        )}
      </div>
    </div>
  );
}

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
