import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ScanSearch, Download, RotateCcw, ArrowRight, Lightbulb, TriangleAlert, UserCheck, MoveLeft } from "lucide-react";

const FLAG_COLOR = "#fb923c";   // amber/orange for unusual
const NORMAL_COLOR = "#34d399"; // emerald for typical

function buildHistogram(scores, bins = 20) {
  const counts = new Array(bins).fill(0);
  const maxV = Math.max(...scores, 0.0001);
  for (const s of scores) {
    const idx = Math.min(bins - 1, Math.floor((s / maxV) * bins));
    counts[idx] += 1;
  }
  return counts.map((count, i) => ({
    name: i === 0 ? "0" : `${((i / bins) * maxV).toFixed(1)}`,
    count,
    full: i === bins - 1,
  }));
}

export function AnomalyResultsStep({ results, summary, onNewSession, onDownload, onContinue }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = results[activeIdx] || results[0];

  useEffect(() => { setActiveIdx(0); }, [results]);

  const scores = active?.scores || [];
  const flagged = active?.flagged_rows || [];
  const total = active?.anomaly_labels?.length || 0;
  const pct = total ? ((flagged.length / total) * 100).toFixed(1) : 0;

  const histData = useMemo(() => buildHistogram(scores), [scores]);

  // Top-N most unusual rows (by score, only those already flagged)
  const topFlagged = useMemo(
    () => flagged
      .map((i) => ({ idx: i, score: scores[i] ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20),
    [flagged, scores],
  );

  const verdict = useMemo(() => {
    if (!total) return null;
    const rate = flagged.length / total;
    if (rate === 0) return {
      label: "Nothing stood out",
      color: "text-emerald", border: "border-emerald/40", bg: "bg-emerald/10",
      text: "No rows crossed the threshold. Either your data is very uniform, or the sensitivity is too low — try raising it.",
    };
    if (rate > 0.25) return {
      label: "Flagged a lot",
      color: "text-amber", border: "border-amber/40", bg: "bg-amber/10",
      text: `${pct}% of rows were flagged — that's a lot. Consider lowering the sensitivity so only the truly unusual rows stand out.`,
    };
    return {
      label: "Found a handful",
      color: "text-emerald", border: "border-emerald/40", bg: "bg-emerald/10",
      text: `${flagged.length.toLocaleString()} of ${total.toLocaleString()} rows (${pct}%) look unusual — a reasonable amount to review by hand.`,
    };
  }, [flagged, total, pct]);

  const profiles = active?.profiles || {};
  const normalProf = profiles.normal;
  const flaggedProf = profiles.flagged;

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Hero */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(600px 300px at 20% 0%, oklch(0.76 0.19 75 / 0.35), transparent 60%)",
        }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[image:var(--gradient-gold)] shadow-[var(--glow-amber)]">
            <TriangleAlert className="h-10 w-10 text-white" />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-amber">
              <ScanSearch className="h-3.5 w-3.5" /> Your data, screened
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {flagged.length.toLocaleString()} unusual rows
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              out of {total.toLocaleString()} scanned · {results.length} strategy
              {results.length === 1 ? "" : "ies"} compared
              {summary?.subsample_note ? ` · ${summary.subsample_note}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {results.map((r, i) => (
                <button
                  key={r.detector}
                  onClick={() => setActiveIdx(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    i === activeIdx
                      ? "border-amber/60 bg-amber/15 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {r.detector}
                  <span className="ml-1.5 font-mono text-[10px]">
                    {r.n_flagged} flagged
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold">
              <Download className="h-4 w-4" /> Download
            </button>
            {onContinue && (
              <button onClick={onContinue} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald/15 border border-emerald/40 text-emerald px-5 py-2.5 text-sm font-medium hover:bg-emerald/25">
                <ArrowRight className="h-4 w-4" /> Continue
              </button>
            )}
            <button onClick={onNewSession} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 px-5 py-2.5 text-sm font-medium hover:bg-accent">
              <RotateCcw className="h-4 w-4" /> New Session
            </button>
          </div>
        </div>
      </div>

      {/* Verdict */}
      {verdict && (
        <div className={`glass-panel flex items-start gap-3 rounded-2xl border p-4 ${verdict.border} ${verdict.bg}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card/60">
            <Lightbulb className={`h-4 w-4 ${verdict.color}`} />
          </div>
          <div className="text-xs leading-relaxed text-foreground/90">
            <span className="font-semibold">In plain English: </span>
            {verdict.text}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Score distribution */}
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3">
            <div className="text-sm font-semibold">How unusual is each row?</div>
            <div className="text-xs text-muted-foreground">
              The taller a bar, the more rows have that "oddness" score. Bars on the right are the most
              unusual rows — they're the ones flagged.
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                  formatter={(value, name) => [value, "rows"]}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {histData.map((b, i) => (
                    <Cell key={i} fill={b.full ? FLAG_COLOR : NORMAL_COLOR} fillOpacity={b.full ? 0.95 : 0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: NORMAL_COLOR }} /> Typical rows</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: FLAG_COLOR }} /> Unusual (flagged)</span>
          </div>
        </div>

        {/* Typical vs unusual */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-3">
            <div className="text-sm font-semibold">Typical vs unusual</div>
            <div className="text-xs text-muted-foreground">How flagged rows differ from the norm</div>
          </div>
          <div className="space-y-3">
            {normalProf && (
              <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald">
                  <UserCheck className="h-3.5 w-3.5" /> Typical ({normalProf.size.toLocaleString()} rows)
                </div>
                <div className="space-y-1">
                  {Object.entries(normalProf.features || {}).slice(0, 4).map(([col, val]) => (
                    <div key={col} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground">{col}</span>
                      <span className="font-mono text-foreground">{typeof val === "number" ? val.toFixed(2) : val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {flaggedProf && flaggedProf.size > 0 && (
              <div className="rounded-xl border border-amber/40 bg-amber/5 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
                  <TriangleAlert className="h-3.5 w-3.5" /> Unusual ({flaggedProf.size.toLocaleString()} rows)
                </div>
                <div className="space-y-1">
                  {Object.entries(flaggedProf.features || {}).slice(0, 4).map(([col, val]) => (
                    <div key={col} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground">{col}</span>
                      <span className="font-mono text-foreground">{typeof val === "number" ? val.toFixed(2) : val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Flagged rows table */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">The most unusual rows</div>
            <div className="text-xs text-muted-foreground">
              Top 20 flagged rows, ranked by oddness score (1 = most unusual)
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MoveLeft className="h-3.5 w-3.5 text-amber" /> {active.detector}
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-xl border border-border/50">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/60">
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">#</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Row</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Oddness</th>
                <th className="px-4 py-2.5 font-semibold text-muted-foreground">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {topFlagged.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No rows were flagged by this detector.</td></tr>
              )}
              {topFlagged.map((r, i) => (
                <tr key={r.idx} className="border-b border-border/40 last:border-0 hover:bg-card/40">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono">{r.idx}</td>
                  <td className="px-4 py-2.5 font-mono">{r.score.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                      <TriangleAlert className="h-3 w-3" /> Unusual
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
