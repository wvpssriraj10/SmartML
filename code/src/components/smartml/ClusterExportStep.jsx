import { Download, RotateCcw, Boxes, FileSpreadsheet, Braces, MoveLeft } from "lucide-react";

export function ClusterExportStep({ results, summary, onDownload, onNewSession, onBack }) {
  const totalRows = summary?.rows_analyzed ?? 0;
  const algos = results?.length ?? 0;
  return (
    <div className="animate-fade-in-up mx-auto max-w-3xl space-y-6">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-8 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(500px 240px at 50% 0%, oklch(0.66 0.19 275 / 0.35), transparent 60%)",
        }} />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)]">
            <Boxes className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your clusters are ready to export</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Download a ZIP containing cluster assignments for every analyzed row plus a per-cluster profile summary.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{totalRows.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rows</div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{algos}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Algorithms</div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{(results?.[0]?.n_clusters_found ?? 0)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clusters ({results?.[0]?.model})</div>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl btn-gradient px-6 py-3 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Download clusters ZIP
            </button>
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-6 py-3 text-sm font-medium hover:bg-accent">
                <MoveLeft className="h-4 w-4" />
                Back to compare
              </button>
            )}
            <button onClick={onNewSession} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-6 py-3 text-sm font-medium hover:bg-accent">
              <RotateCcw className="h-4 w-4" />
              Start new session
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="glass-panel flex items-start gap-3 rounded-2xl p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">cluster_assignments.csv</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Every row tagged with its cluster id, side by side with the original values.
            </div>
          </div>
        </div>
        <div className="glass-panel flex items-start gap-3 rounded-2xl p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
            <Braces className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">cluster_profiles.json</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Per-cluster size + typical feature values, ready for downstream tooling or documentation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}