import { useEffect, useState } from "react";
import { Search, BarChart3, Sparkles, Database } from "lucide-react";

const STAGES = [
  { icon: Database, label: "Parsing schema" },
  { icon: Search, label: "Inspecting features" },
  { icon: BarChart3, label: "Calculating statistics" },
  { icon: Sparkles, label: "Preparing suggestions" },
];

export function AnalyzingStep({ onDone, fileName, ready }) {
  const [stage, setStage] = useState(0);
  const [completedCycle, setCompletedCycle] = useState(false);

  useEffect(() => {
    const total = STAGES.length;
    const step = setInterval(() => {
      setStage((s) => {
        if (s + 1 >= total) {
          clearInterval(step);
          setCompletedCycle(true);
          return total - 1;
        }
        return s + 1;
      });
    }, 650);
    return () => clearInterval(step);
  }, []);

  useEffect(() => {
    if (ready && completedCycle) {
      const doneTimer = setTimeout(onDone, 450);
      return () => clearTimeout(doneTimer);
    }
  }, [ready, completedCycle, onDone]);

  return (
    <div className="animate-fade-in-up mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center text-center">
      <div className="relative mb-10">
        {/* rotating glow rings */}
        <div className="absolute inset-0 -m-8 rounded-full border border-primary/30 animate-pulse-glow" />
        <div className="absolute inset-0 -m-16 rounded-full border border-violet/20" style={{ animation: "ring-spin 6s linear infinite" }} />
        <div className="absolute inset-0 -m-24 rounded-full border border-amber/10" style={{ animation: "ring-spin 12s linear infinite reverse" }} />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)]">
          <div className="absolute inset-2 rounded-full border-2 border-white/30 border-t-white" style={{ animation: "ring-spin 1.2s linear infinite" }} />
          <Search className="h-10 w-10 text-white" />
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
        Analyzing <span className="text-gradient">{fileName}</span>
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Our AI is fingerprinting your dataset — types, cardinality, missing values, and target candidates.
      </p>

      <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => {
          const active = i === stage;
          const done = i < stage;
          return (
            <div
              key={s.label}
              className={`glass-panel relative flex items-center gap-3 overflow-hidden rounded-xl p-3 text-left transition-all ${
                active ? "glow-border animate-shimmer" : ""
              } ${done ? "opacity-70" : ""}`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                  done ? "bg-emerald/20 text-emerald" : active ? "bg-primary/20 text-primary animate-pulse-glow" : "bg-muted text-muted-foreground"
                }`}
              >
                <s.icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-[10px] text-muted-foreground">
                  {done ? "Completed" : active ? (ready ? "Finalizing…" : "In progress…") : "Queued"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
