import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { MoveLeft, ArrowRight, Sparkles, Boxes, GitBranch, ChevronLeft } from "lucide-react";
import { generateClusterNames } from "@/lib/cluster-names";

const PALETTE = [
  "#a78bfa", "#f97316", "#34d399", "#22d3ee", "#facc15",
  "#fb7185", "#818cf8", "#4ade80", "#f472b6", "#2dd4bf",
  "#c084fc", "#fbbf24", "#60a5fa",
];

const MAX_FEATURES = 8;

// Build a parallel-coordinates dataset: one row per feature, one column per cluster.
// Numeric feature values are min-max normalized across clusters so the axes are comparable.
function buildParallelData(profiles) {
  const entries = Object.values(profiles || {});
  if (!entries.length) return { data: [], features: [], hasNumeric: false };

  const featureSet = new Set();
  for (const e of entries) {
    for (const col of Object.keys(e.features || {})) featureSet.add(col);
  }
  const features = Array.from(featureSet).slice(0, MAX_FEATURES);

  // Determine which features are numeric by checking any profile value.
  const numeric = {};
  for (const col of features) {
    numeric[col] = entries.some((e) => typeof e.features?.[col] === "number");
  }
  const hasNumeric = Object.values(numeric).some(Boolean);

  const data = features.map((col) => {
    const row = { feature: col };
    const nums = entries
      .map((e) => e.features?.[col])
      .filter((v) => typeof v === "number");
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 1;
    const range = max - min || 1;
    for (const e of entries) {
      const key = `c${e.cluster}`;
      const val = e.features?.[col];
      row[key] = numeric[col] && typeof val === "number" ? (val - min) / range : 0;
    }
    return row;
  });

  return { data, features, hasNumeric };
}

export function ClusterVisualizeStep({ results, inspection, onDone, onBack }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = results[activeIdx] || results[0];

  const names = useMemo(
    () => generateClusterNames(active?.profiles, {}),
    [active],
  );

  const parallel = useMemo(() => buildParallelData(active?.profiles), [active]);

  // Column display names (strip underscores, keep readable).
  const colLabel = useMemo(() => {
    const map = {};
    for (const c of inspection?.columns || []) map[c.name] = c.name;
    return map;
  }, [inspection]);

  const profileEntries = Object.values(active?.profiles || {});
  const clusters = profileEntries.map((p) => p.cluster);
  const clusterSizes = useMemo(() => {
    const m = {};
    for (const p of profileEntries) m[p.cluster] = p.size;
    return m;
  }, [profileEntries]);

  // Legend names per cluster (priority: auto name, else Group N).
  const legendName = (c) => {
    const n = names[String(c)];
    return n ? n.name.split(" (Group")[0] : `Group ${c}`;
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          background: "radial-gradient(600px 300px at 80% 0%, oklch(0.66 0.19 275 / 0.35), transparent 60%)",
        }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)]">
            <Boxes className="h-10 w-10 text-white" />
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-widest text-violet">
              <GitBranch className="h-3.5 w-3.5" /> Compare the groups
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How the groups differ</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See which columns separate one group from another, in plain sight.
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

      {/* Auto-generated group names */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {profileEntries.map((p, i) => {
          const n = names[String(p.cluster)];
          return (
            <div
              key={p.cluster}
              className="glass-panel rounded-2xl border-l-4 p-4 animate-fade-in-up"
              style={{ borderLeftColor: PALETTE[p.cluster % PALETTE.length] }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: PALETTE[p.cluster % PALETTE.length] }}
                >
                  {p.cluster}
                </span>
                <span className="text-sm font-semibold leading-tight">{n?.name || `Group ${p.cluster}`}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-amber" />
                <span>{p.size.toLocaleString()} rows · {(p.share * 100).toFixed(0)}% of data</span>
              </div>
              {n?.reason && (
                <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{n.reason}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Parallel coordinates */}
      {parallel.hasNumeric && (
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-4">
            <div className="text-sm font-semibold">How groups compare across columns</div>
            <div className="text-xs text-muted-foreground">
              Each line is a group. Columns that fan out are the ones that separate groups; columns where lines
              overlap don't. Values are scaled 0 (low) to 1 (high) for readability.
            </div>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parallel.data} margin={{ top: 8, right: 16, bottom: 40, left: 8 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                <XAxis
                  dataKey="feature"
                  tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => colLabel[v] || v}
                  angle={-20}
                  height={50}
                  interval={0}
                />
                <YAxis domain={[0, 1]} hide />
                <Tooltip
                  contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                />
                {clusters.map((c) => (
                  <Line
                    key={c}
                    type="linear"
                    dataKey={`c${c}`}
                    stroke={PALETTE[c % PALETTE.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: PALETTE[c % PALETTE.length], strokeWidth: 0 }}
                    isAnimationActive={false}
                    name={legendName(c)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Per-feature comparison bars */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4">
          <div className="text-sm font-semibold">Who stands out on each column</div>
          <div className="text-xs text-muted-foreground">
            Average value per group. A group that's far from the others on a column is what makes it distinctive.
          </div>
        </div>
        {parallel.hasNumeric ? (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parallel.data} margin={{ top: 8, right: 16, bottom: 60, left: 8 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis
                  dataKey="feature"
                  tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => colLabel[v] || v}
                  angle={-20}
                  height={60}
                  interval={0}
                />
                <YAxis domain={[0, 1]} tick={{ fill: "oklch(0.68 0.03 260)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.19 0.035 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                  formatter={(value, name) => [Number(Number(value).toFixed(2)), legendName(name.replace("c", ""))]}
                />
                <Legend
                  formatter={(value) => legendName(value.replace("c", ""))}
                  wrapperStyle={{ fontSize: 11 }}
                />
                {clusters.map((c) => (
                  <Bar
                    key={c}
                    dataKey={`c${c}`}
                    fill={PALETTE[c % PALETTE.length]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  >
                    {parallel.data.map((_, i) => (
                      <Cell key={i} fill={PALETTE[c % PALETTE.length]} fillOpacity={0.85} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 text-center text-xs text-muted-foreground">
            This dataset's columns don't have numeric values, so there's no numeric comparison to draw. The group
            names above still show what each group looks like.
          </div>
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
