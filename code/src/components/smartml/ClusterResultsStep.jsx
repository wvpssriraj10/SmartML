import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { GitBranch, Download, RotateCcw, ArrowRight, Boxes, MoveLeft, CircleDot, Lightbulb } from "lucide-react";

const PALETTE = [
  "#a78bfa", "#f97316", "#34d399", "#22d3ee", "#facc15",
  "#fb7185", "#818cf8", "#4ade80", "#f472b6", "#2dd4bf",
  "#c084fc", "#fbbf24", "#60a5fa",
];

function scoreColor(v) {
  if (v == null) return "text-muted-foreground";
  if (v >= 0.6) return "text-emerald";
  if (v >= 0.3) return "text-amber";
  return "text-rose";
}

// Plain-English read of the silhouette score for non-experts
function separationVerdict(sil) {
  if (sil == null) return null;
  if (sil >= 0.6) return {
    label: "Strong",
    color: "text-emerald",
    border: "border-emerald/40",
    bg: "bg-emerald/10",
    dot: "bg-emerald",
    text: `The groups are clearly distinct — rows inside each group look alike, and the groups don't blur into each other. This is a clean result.`,
  };
  if (sil >= 0.3) return {
    label: "Decent",
    color: "text-amber",
    border: "border-amber/40",
    bg: "bg-amber/10",
    dot: "bg-amber",
    text: `The groups are reasonably separated, but there's some overlap. Try a different number of groups or fewer columns if you want sharper boundaries.`,
  };
  return {
    label: "Weak",
    color: "text-rose",
    border: "border-rose/40",
    bg: "bg-rose/10",
    dot: "bg-rose",
    text: `The groups overlap a lot — the chosen columns don't separate the rows strongly. Try more relevant columns, fewer groups, or a different strategy.`,
  };
}

export function ClusterResultsStep({ results, summary, onNewSession, onDownload, onContinue }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = results[activeIdx];

  // reset to 0 when results change
  useEffect(() => { setActiveIdx(0); }, [results]);

  const chartData = useMemo(
    () => (active?.points || []).map((p) => ({ x: p.x, y: p.y, cluster: p.cluster })),
    [active],
  );

  const metricRows = useMemo(() => {
    if (!active) return [];
    const rows = [
      { label: "How well separated", value: active.metrics?.silhouette, tooltip: "How clearly the groups stand apart (-1 to 1, higher is better)" },
      { label: "Group distinctness", value: active.metrics?.calinski_harabasz, tooltip: "How distinct the groups are from each other (higher is better)" },
      { label: "Group tightness", value: active.metrics?.davies_bouldin, tooltip: "How compact each group is (lower is better)" },
    ];
    return rows.map((r) => ({
      ...r,
      fmt: r.value == null ? "—" : (r.label === "Group distinctness" ? r.value.toLocaleString() : r.value.toFixed(4)),
      colorClass: r.label === "Group distinctness" ? text(null) : scoreColor(r.value),
      pct: r.value == null ? 0 : clampPct(r.label, r.value),
    }));
  }, [active]);

  // normalize metric into bar-percentage for display
  function clampPct(label, v) {
    if (v == null) return 0;
    if (label === "Group distinctness") return Math.min(100, Math.max(5, (v / 500 * 100)));
    if (label === "Group tightness") return Math.min(100, Math.max(5, ((1 - v) ) * 100));
    return (Math.max(-1, Math.min(1, v)) + 1) / 2 * 100;
  }
  function text(r) { return r == null ? "text-muted-foreground" : "text-foreground"; }

  const nClusters = active?.n_clusters_found ?? 0;
  const sizes = useMemo(() => {
    if (!active || !active.cluster_sizes) return [];
    // build ratio bars for each cluster
    const total = (active?.points || []).length;
    return Object.entries(active.cluster_sizes)
      .map(([k, v]) => ({ cluster: Number(k), size: v, ratio: total ? v / total : 0 }))
      .sort((a, b) => a.cluster - b.cluster);
  }, [active]);

  const barData = useMemo(() => sizes.map((s) => ({ name: `Group ${s.cluster}`, count: s.size })), [sizes]);

  const verdict = separationVerdict(active?.metrics?.silhouette);
  const biggest = sizes.reduce((acc, s) => (!acc || s.size > acc.size ? s : acc), null);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Hero: algorithm selector + heading */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(600px 300px at 20% 0%, oklch(0.66 0.19 275 / 0.35), transparent 60%)",
        }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[image:var(--gradient-gold)] shadow-[var(--glow-amber)]">
            <Boxes className="h-10 w-10 text-white" />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-violet">
              <GitBranch className="h-3.5 w-3.5" /> Your data, grouped
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {nClusters} group{nClusters === 1 ? "" : "s"} found
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary?.rows_analyzed?.toLocaleString()} rows sorted into groups · {results.length} strategy
              {results.length === 1 ? "" : "ies"} compared
              {summary?.subsample_note ? ` · ${summary.subsample_note}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {results.map((r, i) => (
                <button
                  key={r.model}
                  onClick={() => setActiveIdx(i)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    i === activeIdx
                      ? "border-violet/60 bg-violet/15 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {r.model}
                  <span className="ml-1.5 font-mono text-[10px]">
                    {r.n_clusters_found} groups
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

      {!active && (
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">No clustering results yet.</div>
      )}

      {active && (
        <>
          {/* Plain-English verdict */}
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

          {/* Quality metrics */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {metricRows.map((m, i) => (
              <div key={m.label} className={`glass-panel interactive-card rounded-2xl p-4 animate-fade-in-up stagger-${i + 1}`} title={m.tooltip}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                <div className={`mt-1 font-mono text-2xl font-bold ${m.colorClass}`}>{m.fmt}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {active.silhouette_recommendation && (
            <div className="glass-panel rounded-xl border border-violet/30 bg-violet/10 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-violet">How to read this: </span>{active.silhouette_recommendation}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Scatter */}
            <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Where rows live</div>
                  <div className="text-xs text-muted-foreground">
                    Each dot is a row. Dots close together are similar — same color = same group.
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleDot className="h-3.5 w-3.5 text-violet" /> {chartData.length} rows
                </span>
              </div>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                    <XAxis
                      dataKey="x" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} type="number"
                      tickFormatter={() => ""} label={{ value: "similarity axis", position: "insideBottom", offset: -5, fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                    />
                    <YAxis
                      dataKey="y" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} type="number"
                      tickFormatter={() => ""} label={{ value: "similarity axis", angle: -90, position: "insideLeft", offset: 10, fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                    />
                    <ZAxis range={[28, 36]} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                      cursor={{ strokeDasharray: "3 3", fill: "oklch(1 0 0 / 0.03)" }}
                      formatter={(value, name, entry) => [String(value), `Group ${entry?.payload?.cluster}`]}
                    />
                    <Scatter data={chartData} isAnimationActive={false}>
                      {chartData.map((p, i) => (
                        <Cell key={i} fill={PALETTE[p.cluster % PALETTE.length]} fillOpacity={0.65} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* legend */}
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <span key={s.cluster} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[s.cluster % PALETTE.length] }} />
                    Group {s.cluster} · {s.size} rows
                  </span>
                ))}
              </div>
            </div>

            {/* Cluster size + bar chart */}
            <div className="glass-panel flex flex-col rounded-2xl p-5">
              <div className="mb-3">
                <div className="text-sm font-semibold">Group sizes</div>
                <div className="text-xs text-muted-foreground">How many rows landed in each group</div>
              </div>
              {biggest && (
                <div className="mb-3 rounded-lg border border-border/50 bg-card/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Largest: Group {biggest.cluster}</span>{" "}
                  with {biggest.size.toLocaleString()} rows ({(biggest.ratio * 100).toFixed(0)}% of all rows).
                </div>
              )}
              <div className="min-h-48 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                      cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {barData.map((b, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Cluster profile cards */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">What each group looks like</div>
                <div className="text-xs text-muted-foreground">Typical values inside each group — scroll sideways to see them all</div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MoveLeft className="h-3.5 w-3.5 text-violet" /> scroll for more
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2">
              {(active.profiles && Object.values(active.profiles)).map((p, i) => (
                <div key={p.cluster} className="glass-panel w-60 shrink-0 rounded-2xl border-t-2 p-4" style={{ borderTopColor: PALETTE[p.cluster % PALETTE.length] }}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: PALETTE[p.cluster % PALETTE.length] }}>
                        {p.cluster}
                      </span>
                      <span className="text-sm font-semibold">Group {p.cluster}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{p.size.toLocaleString()} rows · {(p.share * 100).toFixed(0)}%</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(p.features || {}).slice(0, 5).map(([col, val]) => (
                      <div key={col} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="truncate text-muted-foreground">{col}</span>
                        <span className="font-mono text-foreground">{typeof val === "number" ? val.toFixed(2) : val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}