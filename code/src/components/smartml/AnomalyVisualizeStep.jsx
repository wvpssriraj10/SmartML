import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { MoveLeft, ArrowRight, Boxes, ScanSearch, ChevronLeft, TriangleAlert } from "lucide-react";

const FLAG_COLOR = "#fb923c";
const NORMAL_COLOR = "#22d3ee";
const SCORE_COLOR = "#a78bfa";

export function AnomalyVisualizeStep({ results, onDone, onBack }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = results[activeIdx] || results[0];
  const [view, setView] = useState("flag"); // 'flag' | 'score'

  useEffect(() => { setActiveIdx(0); }, [results]);

  const points = active?.points || [];
  const flagged = active?.flagged_rows || [];

  const flagData = useMemo(
    () => points.map((p) => ({ x: p.x, y: p.y, kind: p.anomaly ? "anomaly" : "normal" })),
    [points],
  );
  const scoreData = useMemo(
    () => points.map((p) => ({ x: p.x, y: p.y, score: p.score })),
    [points],
  );

  const normals = flagData.filter((p) => p.kind === "normal");
  const anomalys = flagData.filter((p) => p.kind === "anomaly");

  const hasPoints = points.length > 0;

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(600px 300px at 80% 0%, oklch(0.76 0.19 75 / 0.35), transparent 60%)",
        }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[image:var(--gradient-gold)] shadow-[var(--glow-amber)]">
            <Boxes className="h-10 w-10 text-white" />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-amber">
              <ScanSearch className="h-3.5 w-3.5" /> Where the unusual rows sit
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">A map of your rows</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rows close together are similar. The flagged ones tend to sit apart from the crowd.
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
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {onBack && (
              <button onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 px-5 py-2.5 text-sm font-medium hover:bg-accent">
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {onDone && (
              <button onClick={onDone} className="inline-flex items-center justify-center gap-2 rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold">
                <ArrowRight className="h-4 w-4" /> Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("flag")}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
            view === "flag" ? "border-amber/60 bg-amber/15 text-foreground" : "border-border/60 text-muted-foreground hover:border-primary/40"
          }`}
        >
          Flagged vs normal
        </button>
        <button
          onClick={() => setView("score")}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
            view === "score" ? "border-violet/60 bg-violet/15 text-foreground" : "border-border/60 text-muted-foreground hover:border-primary/40"
          }`}
        >
          Oddness heat (score)
        </button>
      </div>

      {/* Scatter */}
      <div className="glass-panel rounded-2xl p-5">
        {!hasPoints ? (
          <div className="rounded-xl border border-border/50 bg-card/40 p-10 text-center text-xs text-muted-foreground">
            No points to plot for this detector.
          </div>
        ) : (
          <>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 10 }}>
                  <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                  <XAxis
                    dataKey="x" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} type="number"
                    tickFormatter={() => ""} label={{ value: "similarity axis", position: "insideBottom", offset: -5, fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                  />
                  <YAxis
                    dataKey="y" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} type="number"
                    tickFormatter={() => ""} label={{ value: "similarity axis", angle: -90, position: "insideLeft", offset: 10, fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                  />
                  <ZAxis range={[30, 38]} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                    cursor={{ strokeDasharray: "3 3", fill: "oklch(1 0 0 / 0.03)" }}
                    formatter={(value, name, entry) => {
                      if (view === "score") return [Number(value).toFixed(2), "Oddness"];
                      return [value, entry?.payload?.kind === "anomaly" ? "Unusual" : "Typical"];
                    }}
                  />
                  {view === "flag" ? (
                    <>
                      <Scatter data={normals} name="Typical" fill={NORMAL_COLOR} fillOpacity={0.5} isAnimationActive={false} />
                      <Scatter data={anomalys} name="Unusual" fill={FLAG_COLOR} fillOpacity={0.95} isAnimationActive={false} />
                    </>
                  ) : (
                    <Scatter data={scoreData} name="Score" fill={SCORE_COLOR} fillOpacity={0.7} isAnimationActive={false} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {view === "flag" ? (
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: NORMAL_COLOR }} /> Typical ({normals.length.toLocaleString()})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: FLAG_COLOR }} /> Unusual ({anomalys.length.toLocaleString()})
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SCORE_COLOR }} />
                Brighter/larger dots are more unusual
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-6 py-3 text-sm font-medium hover:bg-accent">
          <MoveLeft className="h-4 w-4" /> Back to results
        </button>
        <button onClick={onDone} className="inline-flex items-center gap-2 rounded-xl btn-gradient px-6 py-3 text-sm font-semibold">
          Continue to export <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
