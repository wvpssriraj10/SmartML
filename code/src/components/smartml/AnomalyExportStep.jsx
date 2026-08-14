import { Download, RotateCcw, TriangleAlert, FileSpreadsheet, Braces, MoveLeft, ScanSearch } from "lucide-react";

export function AnomalyExportStep({ results, summary, onDownload, onNewSession, onBack }) {
  const totalRows = summary?.rows_analyzed ?? 0;
  const flagged = summary?.flagged_count ?? results?.[0]?.n_flagged ?? 0;
  const algos = results?.length ?? 0;
  return (
    <div className="animate-fade-in-up mx-auto max-w-3xl space-y-6">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-8 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(500px 240px at 50% 0%, oklch(0.76 0.19 75 / 0.35), transparent 60%)",
        }} />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[image:var(--gradient-gold)] shadow-[var(--glow-amber)]">
            <TriangleAlert className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your unusual rows are ready to export</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Download a ZIP with an anomaly score for every analyzed row plus the typical-vs-unusual profile summary.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{totalRows.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rows scanned</div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{flagged.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Flagged</div>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2.5">
              <div className="text-lg font-bold">{algos}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Detectors</div>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl btn-gradient px-6 py-3 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Download anomaly ZIP
            </button>
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-6 py-3 text-sm font-medium hover:bg-accent">
                <MoveLeft className="h-4 w-4" />
                Back to map
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">anomaly_scores.csv</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Every row with its anomaly score and a 1/0 flag, ready to filter in a spreadsheet.
            </div>
          </div>
        </div>
        <div className="glass-panel flex items-start gap-3 rounded-2xl p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet">
            <Braces className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">anomaly_profiles.json</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Typical vs unusual profiles per detector, handy for explaining the flag to stakeholders.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
