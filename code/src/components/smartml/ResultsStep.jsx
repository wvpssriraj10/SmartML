import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Trophy, Download, RotateCcw, Medal, Sparkles, Lightbulb, Info } from "lucide-react";
import { generateDistribution, championInsight } from "@/lib/smartml-mock";

export function ResultsStep({ results, problemType, columns, target, onNewSession, onDownload }) {
  const champion = results[0];
  const metricKeys = Object.keys(champion.metrics);
  const [activeMetric, setActiveMetric] = useState(metricKeys[0]);
  const [kpiCol, setKpiCol] = useState(columns[1].name);

  const insight = useMemo(
    () => championInsight(results, problemType, target ?? "your target"),
    [results, problemType, target],
  );

  const compareData = useMemo(
    () => results.map((r) => ({ name: r.name, value: r.metrics[activeMetric] ?? 0 })),
    [results, activeMetric],
  );
  const distribution = useMemo(() => generateDistribution(kpiCol), [kpiCol]);
  const bestValue = Math.max(...results.map((r) => r.metrics[metricKeys[0]] ?? 0));

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Champion hero */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(600px 300px at 20% 0%, oklch(0.80 0.16 80 / 0.35), transparent 60%)",
        }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{
          background: "radial-gradient(500px 300px at 80% 100%, oklch(0.68 0.20 305 / 0.4), transparent 60%)",
        }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-[image:var(--gradient-gold)] shadow-[var(--glow-amber)]">
            <Trophy className="h-12 w-12 text-white drop-shadow" />
            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-bold text-amber">1</span>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-amber">
              <Sparkles className="h-3.5 w-3.5" />
              Champion Model
            </div>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              <span className="text-gold">{champion.name}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Winner across {results.length} candidates · {problemType} · trained on your dataset
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(champion.metrics).map(([k, v]) => (
                <div key={k} className="glass-panel rounded-xl px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace("_", " ")}</div>
                  <div className="font-mono text-sm font-semibold">{typeof v === "number" ? v.toFixed(4) : v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold">
              <Download className="h-4 w-4" />
              Download Deployable Code
            </button>
            <button onClick={onNewSession} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 px-5 py-2.5 text-sm font-medium hover:bg-accent">
              <RotateCcw className="h-4 w-4" />
              Start New Session
            </button>
          </div>
        </div>
      </div>

      {/* Why this model won */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/15 text-amber">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Why {champion.name} won</div>
              <div className="text-xs text-muted-foreground">The reasoning behind the champion pick — not just a score</div>
            </div>
          </div>
          <ul className="space-y-2.5">
            {insight.winReasons.map((r, i) => (
              <li key={i} className={`flex gap-2.5 rounded-xl border border-border/50 bg-card/40 p-3 text-xs leading-relaxed text-muted-foreground interactive-card animate-fade-in-up stagger-${(i % 8) + 1}`}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 text-[10px] font-bold text-amber">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Why these metrics?</div>
              <div className="text-xs text-muted-foreground capitalize">{problemType} problem</div>
            </div>
          </div>
          <p className="mb-3 rounded-lg border border-border/50 bg-card/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {insight.problemRationale}
          </p>
          <ul className="space-y-2">
            {insight.metricExplainer.map((m, i) => (
              <li key={m.key} className={`text-[11px] leading-relaxed interactive-card animate-fade-in-up stagger-${(i % 8) + 1}`}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{m.label}</span>
<span className="font-mono text-[10px] text-cyan">
                      {champion.metrics[m.key] != null ? champion.metrics[m.key].toFixed(4) : "—"}
                    </span>
                </div>
                <div className="text-muted-foreground">{m.why}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Leaderboard */}
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Leaderboard</div>
              <div className="text-xs text-muted-foreground">Ranked by {metricKeys[0]}</div>
            </div>
            <span className="rounded-full border border-border/60 bg-card/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {results.length} models
            </span>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => {
              const v = r.metrics[metricKeys[0]] ?? 0;
              const pct = (v / bestValue) * 100;
              return (
                <div key={r.name} className={`group relative overflow-hidden rounded-xl border p-3 interactive-card animate-fade-in-up stagger-${(i % 8) + 1} transition ${
                  r.isChampion ? "border-amber/50 bg-amber/5" : "border-border/60 bg-card/40 hover:bg-accent/40"
                }`}>
                  <div className="relative flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      r.rank === 1 ? "bg-[image:var(--gradient-gold)] text-white" :
                      r.rank === 2 ? "bg-muted text-foreground" :
                      r.rank === 3 ? "bg-amber/20 text-amber" :
                      "bg-secondary text-muted-foreground"
                    }`}>
                      {r.rank <= 3 ? <Medal className="h-4 w-4" /> : r.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{r.name}</span>
                        <span className="font-mono text-xs">{v.toFixed(4)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${r.isChampion ? "bg-[image:var(--gradient-gold)]" : "bg-[image:var(--gradient-primary)]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison chart */}
        <div className="glass-panel flex flex-col rounded-2xl p-5 lg:sticky lg:top-24 max-h-[500px]">

          <div className="mb-3">
            <div className="text-sm font-semibold">Performance Comparison</div>
            <div className="text-xs text-muted-foreground">Switch metric to compare</div>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {metricKeys.map((k) => (
              <button
                key={k}
                onClick={() => setActiveMetric(k)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  activeMetric === k
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {k.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="min-h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="cmpFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.66 0.19 275)" />
                    <stop offset="100%" stopColor="oklch(0.80 0.16 80)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "oklch(0.85 0.02 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                  formatter={(v) => v.toFixed(4)}
                />
                <Bar dataKey="value" fill="url(#cmpFill)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* KPI distribution */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Feature Distribution</div>
            <div className="text-xs text-muted-foreground">Inspect KPI shape across your data</div>
          </div>
          <select
            value={kpiCol}
            onChange={(e) => setKpiCol(e.target.value)}
            className="rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-primary/60"
          >
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <defs>
                <linearGradient id="kpiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.74 0.13 210)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="oklch(0.55 0.15 260)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
              />
              <Bar dataKey="count" fill="url(#kpiFill)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
