import { CheckCircle2 } from "lucide-react";
import { ML_MODES, ACCENT_STYLES } from "@/lib/ml-modes";

export function ModeSelector({ mode, onChange, disabled = false }) {
  const ordered = ["predict", "explore", "detect"];

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium shadow-[var(--glow-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
          <span className="uppercase tracking-widest text-[10px] text-foreground/80">Step 0 · Mode</span>
          <span className="text-muted-foreground">Tell me what you want to do</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          What are you trying to
          <br />
          <span className="text-gradient">figure out?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Pick a workflow. SmartML then guides you to a result — a model, a set of clusters, or a list of anomalies.
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        {ordered.map((key, i) => {
          const m = ML_MODES[key];
          const Icon = m.icon;
          const accent = ACCENT_STYLES[m.accent];
          const selected = mode === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`animate-fade-in-up stagger-${i + 1} glass-panel relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                selected
                  ? `${accent.border} ${accent.bgSoft} ${accent.glow}`
                  : "border-border/60 hover:border-primary/40 hover:bg-card/70"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer interactive-card"}`}
            >
              {selected && (
                <div className={`absolute right-3 top-3 ${accent.text}`}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent.bgSoft} ${accent.text}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div
                className={`text-[10px] font-semibold uppercase tracking-widest ${accent.text}`}
              >
                {m.tagline}
              </div>
              <div className="text-lg font-semibold">{m.label}</div>
              <div className="text-sm leading-relaxed text-muted-foreground">{m.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}