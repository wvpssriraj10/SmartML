import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ShieldCheck, Rows, Columns3, Grid3x3, CircleAlert, CopyMinus, Sparkles, ChevronRight, Target,
} from "lucide-react";
import { generateDistribution } from "@/lib/smartml-mock";

const TYPE_STYLES = {
  numeric: "bg-cyan/15 text-cyan border-cyan/30",
  categorical: "bg-violet/15 text-violet border-violet/30",
  datetime: "bg-amber/15 text-amber border-amber/30",
  text: "bg-rose/15 text-rose border-rose/30",
};

export function InspectionStep({ inspection, onStartTraining }) {
  const defaultColumn = inspection.columns?.[0]?.name ?? "";
  const [selectedCol, setSelectedCol] = useState(defaultColumn);
  const [target, setTarget] = useState(inspection.suggestedTarget ?? defaultColumn);
  const [problemType, setProblemType] = useState(inspection.suggestedProblem ?? "auto");
  const [strategy, setStrategy] = useState("Balanced (recommended)");

  useEffect(() => {
    setTarget(inspection.suggestedTarget ?? defaultColumn);
  }, [inspection.suggestedTarget, defaultColumn]);

  useEffect(() => {
    setProblemType(inspection.suggestedProblem ?? "auto");
  }, [inspection.suggestedProblem]);

  const distribution = useMemo(
    () => (selectedCol ? generateDistribution(selectedCol) : []),
    [selectedCol]
  );

  const stats = [
    { icon: ShieldCheck, label: "Quality Score", value: `${inspection.qualityScore}`, suffix: "/100", tone: "emerald" },
    { icon: Rows, label: "Rows", value: inspection.rows.toLocaleString(), tone: "indigo" },
    { icon: Columns3, label: "Columns", value: inspection.cols.toString(), tone: "violet" },
    { icon: Grid3x3, label: "Total Cells", value: inspection.totalCells.toLocaleString(), tone: "cyan" },
    { icon: CircleAlert, label: "Missing Cells", value: inspection.missingCells.toLocaleString(), tone: "amber" },
    { icon: CopyMinus, label: "Duplicate Rows", value: inspection.duplicates.toString(), tone: "rose" },
  ];

  const previewCols = inspection.columns.slice(0, 6).map((c) => c.name);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s, i) => (
          <div key={s.label} className={`glass-panel glow-border relative overflow-hidden rounded-2xl p-4 interactive-card animate-fade-in-up stagger-${i + 1}`}>
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-${s.tone}/15 text-${s.tone}`}>
              <s.icon className="h-4.5 w-4.5" />
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {s.value}
              {"suffix" in s && s.suffix && <span className="text-sm text-muted-foreground">{s.suffix}</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: columns + preview + viz */}
        <div className="space-y-6 lg:col-span-2">
          {/* Columns table */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div>
                <div className="text-sm font-semibold">Columns</div>
                <div className="text-xs text-muted-foreground">Types, missing rates, and cardinality</div>
              </div>
              <span className="rounded-full border border-border/60 bg-card/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                {inspection.columns.length} features
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/80 backdrop-blur text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Column</th>
                    <th className="px-2 py-2.5 text-left font-medium">Type</th>
                    <th className="px-2 py-2.5 text-right font-medium">Missing</th>
                    <th className="px-5 py-2.5 text-right font-medium">Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {inspection.columns.map((c, i) => (
                    <tr key={c.name} className="border-t border-border/40 interactive-card hover:bg-accent/40 transition-all duration-200 ease-expo" style={{ animationDelay: `${(i % 8) * 20}ms` }}>
                      <td className="px-5 py-2.5 font-mono text-xs">{c.name}</td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLES[c.type]}`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs">
                        <span className={c.missingPct > 3 ? "text-amber" : "text-muted-foreground"}>
                          {c.missingPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs">{c.unique.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div>
                <div className="text-sm font-semibold">Dataset Preview</div>
                <div className="text-xs text-muted-foreground">First 10 rows</div>
              </div>
            </div>
            <div className="overflow-x-auto overflow-y-hidden">
              <table className="w-full text-xs">
                <thead className="bg-card/60 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    {previewCols.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {inspection.preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-border/40 interactive-card hover:bg-accent/30 transition-all duration-200 ease-expo" style={{ animationDelay: `${i * 30}ms` }}>
                      {previewCols.map((c) => (
                        <td key={c} className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                          {String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visualization explorer */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Visualization Explorer</div>
                <div className="text-xs text-muted-foreground">Explore feature distributions</div>
              </div>
              <select
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
              >
                {inspection.columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <defs>
                    <linearGradient id="barfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.68 0.20 305)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="oklch(0.55 0.18 275)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                    cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                  />
                  <Bar dataKey="count" fill="url(#barfill)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT: config panel */}
        <div className="lg:col-span-1">
          <div className="glass-panel glow-border rounded-2xl p-5 lg:sticky lg:top-24">

            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Training Configuration</div>
                <div className="text-[11px] text-muted-foreground">Fine-tune before launch</div>
              </div>
            </div>

            {/* Suggestion banner */}
            <div className="mb-4 rounded-xl border border-violet/30 bg-violet/10 p-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                <div className="flex-1 text-xs">
                  <div className="font-medium text-violet">AI Suggestion</div>
                  <div className="mt-0.5 text-muted-foreground">
                    Target <span className="font-mono text-foreground">"{inspection.suggestedTarget}"</span> — {inspection.suggestedProblem} problem.
                  </div>
                  <button
                    onClick={() => { setTarget(inspection.suggestedTarget); setProblemType(inspection.suggestedProblem); }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet hover:underline"
                  >
                    Apply <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="mt-3 border-t border-violet/20 pt-2.5">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet/80">Why this column?</div>
                <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {inspection.targetReason.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet/60" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Target column</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
                >
                  {inspection.columns.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Problem type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["auto", "classification", "regression"]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProblemType(p)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition ${
                        problemType === p
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Model strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary/60"
                >
                  <option>Balanced (recommended)</option>
                  <option>Fast (5 models)</option>
                  <option>Exhaustive (all 10)</option>
                  <option>Interpretable only</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => onStartTraining({ target, problemType, strategy })}
              className="mt-6 w-full rounded-xl btn-gradient px-4 py-3 text-sm font-semibold"
            >
              Start Training →
            </button>

            <div className="mt-3 text-center text-[10.5px] text-muted-foreground">
              Estimated time · ~30–90 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
