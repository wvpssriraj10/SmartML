import { useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Clock, Terminal, AlertCircle, CheckCircle2, Loader2, XCircle, ChevronDown, ChevronRight } from "lucide-react";

function statusIcon(s) {
  switch (s) {
    case "queued": return <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />;
    case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-rose" />;
  }
}

function statusLabel(s) {
  switch (s) {
    case "queued": return "Waiting";
    case "running": return "Working";
    case "completed": return "Done";
    case "failed": return "Failed";
    default: return s || "Waiting";
  }
}

// Plain-language description per method, shown while it runs
const ALGO_STORY = {
  "K-Means": "Measuring how close rows are and drawing boundaries around similar ones…",
  "PCA": "Compressing the data to its two most important dimensions, then grouping the points…",
  "Agglomerative": "Merging the most similar rows step by step into larger groups…",
  "Gaussian Mixture": "Assigning each row a mix of memberships across the groups…",
};

export function ClusterTrainStep({ algorithms, status, progress, elapsed, logs, modelStates }) {
  const logRef = useRef(null);
  const [showLogs, setShowLogs] = useState(false);

  const overall = useMemo(() => {
    if (typeof progress === "number") return progress;
    if (!modelStates?.length) return 0;
    return (
      modelStates.reduce((acc, m) => acc + (m.status === "completed" ? 100 : m.status === "failed" ? 100 : m.progress || 0), 0) /
      modelStates.length
    );
  }, [progress, modelStates]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const circumference = 2 * Math.PI * 62;
  const dash = (overall / 100) * circumference;
  const showWarning = elapsed > 20 && status === "running";

  const currentStory = (modelStates || []).find((m) => m.status === "running")
    || (modelStates || []).find((m) => m.status === "queued");
  const statusText = status === "completed" ? "All groups found" : (currentStory?.name ? ALGO_STORY[currentStory.name] : "Grouping your rows…");

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass-panel glow-border relative flex items-center gap-6 rounded-2xl p-6 lg:col-span-2">
          <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 140 140">
              <defs>
                <linearGradient id="ringGradViolet" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.19 275)" />
                  <stop offset="100%" stopColor="oklch(0.68 0.20 305)" />
                </linearGradient>
              </defs>
              <circle cx="70" cy="70" r="62" stroke="oklch(1 0 0 / 0.08)" strokeWidth="10" fill="none" />
              <circle
                cx="70" cy="70" r="62" stroke="url(#ringGradViolet)" strokeWidth="10" fill="none"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - dash}
                style={{ transition: `stroke-dashoffset ${400}ms var(--ease-out-expo)` }}
              />
            </svg>
            <div className="relative text-center">
              <div className="text-3xl font-bold">{Math.round(overall)}%</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wider text-violet">{status === "completed" ? "Done — here's your groups" : "Grouping your data"}</div>
            <h2 className="mt-1 text-2xl font-bold">{statusText}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{fmt(elapsed || 0)}</span>
                <span>elapsed</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
                <span>{(modelStates || []).filter((m) => m.status === "completed").length} of {algorithms?.length || 0} ways finished</span>
              </div>
            </div>
            {showWarning && status !== "completed" && (
              <div className="animate-fade-in-up mt-4 flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
                <div>
                  <div className="font-semibold text-amber">Taking a little longer</div>
                  <div className="mt-0.5 text-muted-foreground">
                    Large files get sampled to keep it fast; the strategy is still chewing through it.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terminal — hidden behind a toggle for beginners */}
        <div className="glass-panel flex flex-col overflow-hidden rounded-2xl">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-left transition hover:bg-card/40"
          >
            <Terminal className="h-4 w-4 text-violet" />
            <div>
              <div className="text-xs font-semibold">Technical logs</div>
              <div className="text-[10px] text-muted-foreground">What's happening under the hood</div>
            </div>
            <span className="ml-auto flex items-center gap-1">
              <span className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-rose/70" />
                <span className="h-2 w-2 rounded-full bg-amber/70" />
                <span className="h-2 w-2 rounded-full bg-emerald/70" />
              </span>
              {showLogs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </button>
          {showLogs && (
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
          )}
        </div>
      </div>

      {/* Roster */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">The strategies at work</div>
            <div className="text-xs text-muted-foreground">Each one is grouping the same rows its own way</div>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5 text-violet" /> {algorithms?.length || 0} ways
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(modelStates || []).map((m, i) => (
            <div key={m.name} className={`relative overflow-hidden rounded-xl border p-3.5 interactive-card animate-fade-in-up stagger-${(i % 8) + 1} ${
              m.status === "running" ? "border-violet/50 bg-violet/5 animate-shimmer" :
              m.status === "completed" ? "border-emerald/30 bg-emerald/5" :
              "border-border/60 bg-card/50"
            }`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[13px] font-semibold leading-tight">{m.name}</div>
                {statusIcon(m.status)}
              </div>
              {ALGO_STORY[m.name] && (
                <div className="mb-2 text-[10.5px] leading-relaxed text-muted-foreground">
                  {statusLabel(m.status)} — {m.status === "completed" ? "found its groups" : m.status === "failed" ? "hit a problem" : ALGO_STORY[m.name]}
                </div>
              )}
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${m.status === "completed" ? "bg-emerald" : "bg-[image:var(--gradient-primary)]"}`}
                  style={{ width: `${m.status === "completed" ? 100 : m.progress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase ${
                  m.status === "running" ? "bg-primary/15 text-primary border border-primary/30" :
                  m.status === "completed" ? "bg-emerald/15 text-emerald border border-emerald/30" :
                  m.status === "failed" ? "bg-rose/15 text-rose border border-rose/30" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {statusLabel(m.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
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