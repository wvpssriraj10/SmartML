import { useState, useEffect } from "react";
import { Sparkle, AlertTriangle, CheckCircle2, Info, TrendingUp, Hash, Type } from "lucide-react";
import { API_BASE } from "@/api";

const PALETTE = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6",
  "#a855f7","#ec4899","#14b8a6","#f97316","#8b5cf6",
];

// Simple heatmap cell component
function HeatCell({ value }) {
  const abs = Math.abs(value);
  const alpha = Math.min(abs, 1);
  const bg = value >= 0
    ? `rgba(99,102,241,${alpha * 0.85})`
    : `rgba(239,68,68,${alpha * 0.85})`;
  const textColor = alpha > 0.4 ? "#fff" : "#94a3b8";
  return (
    <div
      className="flex items-center justify-center rounded text-[10px] font-mono font-semibold transition-all hover:scale-110"
      style={{ background: bg, color: textColor, width: 36, height: 36 }}
    >
      {isNaN(value) ? "—" : value.toFixed(2)}
    </div>
  );
}

export function FeatureAnalysisStep({ datasetId }) {
  const [dataset, setDataset]   = useState(null);
  const [preview,  setPreview]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [corrData, setCorrData] = useState(null); // { cols, matrix }

  useEffect(() => {
    if (!datasetId) { setLoading(false); return; }

    const load = async () => {
      try {
        const [detRes, pvRes] = await Promise.all([
          fetch(`${API_BASE}/datasets/${datasetId}`),
          fetch(`${API_BASE}/datasets/${datasetId}/preview?page=1&page_size=1000`),
        ]);

        if (detRes.ok) setDataset(await detRes.json());
        if (pvRes.ok)  {
          const pv = await pvRes.json();
          setPreview(pv.rows || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datasetId]);

  // Compute correlation matrix client-side from preview data
  useEffect(() => {
    if (!preview.length || !dataset) return;

    const colStatus = dataset.metrics?.column_status || {};
    const numCols   = Object.entries(colStatus)
      .filter(([, v]) => v.type === "numeric")
      .map(([k]) => k)
      .slice(0, 12); // cap at 12 for heatmap readability

    if (numCols.length < 2) return;

    const vectors = {};
    numCols.forEach(col => {
      vectors[col] = preview.map(r => parseFloat(r[col])).filter(n => !isNaN(n));
    });

    const mean  = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    const corr  = (a, b) => {
      const n   = Math.min(a.length, b.length);
      if (n < 2) return NaN;
      const ma  = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < n; i++) {
        const ea = a[i] - ma, eb = b[i] - mb;
        num += ea * eb; da += ea * ea; db += eb * eb;
      }
      return da === 0 || db === 0 ? NaN : num / Math.sqrt(da * db);
    };

    const matrix = numCols.map(ci =>
      numCols.map(cj => ci === cj ? 1.0 : corr(vectors[ci], vectors[cj]))
    );

    setCorrData({ cols: numCols, matrix });
  }, [preview, dataset]);

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Computing feature correlations…</span>
        </div>
      </div>
    );

  if (!datasetId || !dataset)
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl">
        <Sparkle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">No Dataset Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Upload or select a dataset to explore feature correlations and AI-derived feature readiness scores.
        </p>
      </div>
    );

  const colStatus  = dataset.metrics?.column_status || {};
  const allCols    = dataset.columns || [];
  const numCols    = allCols.filter(c => colStatus[c]?.type === "numeric");
  const catCols    = allCols.filter(c => colStatus[c]?.type === "categorical");
  const metrics    = dataset.metrics || {};

  // Redundant feature pairs (|corr| >= 0.9)
  const redundant = [];
  if (corrData) {
    corrData.cols.forEach((ci, i) => {
      corrData.cols.forEach((cj, j) => {
        if (i < j && Math.abs(corrData.matrix[i][j]) >= 0.9) {
          redundant.push({ col1: ci, col2: cj, corr: corrData.matrix[i][j].toFixed(2) });
        }
      });
    });
  }

  // Strong pairs (0.65–0.89)
  const strongPairs = [];
  if (corrData) {
    corrData.cols.forEach((ci, i) => {
      corrData.cols.forEach((cj, j) => {
        const v = Math.abs(corrData.matrix[i]?.[j] ?? 0);
        if (i < j && v >= 0.65 && v < 0.9) {
          strongPairs.push({ col1: ci, col2: cj, corr: corrData.matrix[i][j].toFixed(2) });
        }
      });
    });
  }

  // Feature readiness per column
  const readiness = allCols.map(col => {
    const st = colStatus[col] || {};
    const missingScore = Math.max(0, 100 - (st.missing || 0) / Math.max(metrics.rows, 1) * 100);
    const outlierScore = st.type === "numeric"
      ? Math.max(0, 100 - (st.outliers || 0) / Math.max(metrics.rows, 1) * 100)
      : 100;
    const score = Math.round((missingScore * 0.6 + outlierScore * 0.4));
    return { col, score, type: st.type, missing: st.missing || 0, outliers: st.outliers || 0 };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Feature Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Correlation heatmap, redundancy detection, and per-feature readiness scores for {allCols.length} columns.
        </p>
      </div>

      {/* Summary Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Numerical Features",   value: numCols.length,     color: "text-blue-400" },
          { label: "Categorical Features", value: catCols.length,     color: "text-amber" },
          { label: "Redundant Pairs",      value: redundant.length,   color: redundant.length ? "text-red-400" : "text-emerald" },
          { label: "Strong Correlations",  value: strongPairs.length, color: "text-purple-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-panel rounded-xl p-3.5 border border-border/60">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <div className={`text-xl font-bold font-display mt-0.5 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Feature Readiness List */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-5 border border-border/60 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Feature Readiness Scores
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {readiness.map(({ col, score, type, missing, outliers }) => (
              <div key={col} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-card/40">
                {type === "numeric"
                  ? <Hash className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  : <Type className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-mono truncate">{col}</span>
                    <span className={`text-xs font-bold shrink-0 ${score >= 90 ? "text-emerald" : score >= 70 ? "text-amber" : "text-red-400"}`}>
                      {score}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${score >= 90 ? "bg-emerald" : score >= 70 ? "bg-amber" : "bg-red-400"}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {(missing > 0 || outliers > 0) && (
                    <div className="flex gap-2 mt-0.5">
                      {missing > 0 && <span className="text-[9px] text-amber">Missing: {missing}</span>}
                      {outliers > 0 && <span className="text-[9px] text-red-400">Outliers: {outliers}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Correlation Heatmap + Redundancy Alerts */}
        <div className="lg:col-span-8 space-y-5">

          {/* Correlation Heatmap */}
          <div className="glass-panel rounded-2xl p-5 border border-border/60 space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Pearson Correlation Heatmap</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Computed client-side on {Math.min(preview.length, 1000)} sample rows · Numerical columns only
              </p>
            </div>

            {!corrData ? (
              <p className="text-sm text-muted-foreground italic p-4 text-center">
                Insufficient numerical columns for correlation analysis (need ≥ 2 numeric features).
              </p>
            ) : (
              <div className="overflow-x-auto">
                {/* Column header row */}
                <div className="flex gap-1 mb-1 pl-[76px]">
                  {corrData.cols.map(c => (
                    <div key={c} className="w-9 text-[9px] font-mono text-muted-foreground truncate text-center" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 52 }}>
                      {c}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {corrData.cols.map((rowCol, i) => (
                  <div key={rowCol} className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] font-mono text-muted-foreground text-right truncate" style={{ width: 70 }}>
                      {rowCol}
                    </span>
                    {corrData.cols.map((_, j) => (
                      <HeatCell key={j} value={corrData.matrix[i][j]} />
                    ))}
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex h-2 w-32 rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, rgba(239,68,68,0.8), transparent, rgba(99,102,241,0.8))" }} />
                  <span className="text-[10px] text-muted-foreground">-1 (negative) ← 0 → +1 (positive)</span>
                </div>
              </div>
            )}
          </div>

          {/* Redundancy & Strong Correlation Alerts */}
          {(redundant.length > 0 || strongPairs.length > 0) && (
            <div className="glass-panel rounded-2xl p-5 border border-border/60 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber" />
                Feature Relationship Alerts
              </h3>

              {redundant.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                    ⚠ Redundant Pairs (|corr| ≥ 0.9) — Consider dropping one
                  </p>
                  <div className="space-y-1.5">
                    {redundant.map(({ col1, col2, corr }, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs">
                        <span className="font-mono text-foreground">{col1} ↔ {col2}</span>
                        <span className="font-bold text-red-400">corr = {corr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {strongPairs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber uppercase tracking-wider">
                    ↗ Strong Correlations (0.65–0.89) — Good predictive signal
                  </p>
                  <div className="space-y-1.5">
                    {strongPairs.slice(0, 6).map(({ col1, col2, corr }, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl bg-amber/10 border border-amber/20 px-3 py-2 text-xs">
                        <span className="font-mono text-foreground">{col1} ↔ {col2}</span>
                        <span className="font-bold text-amber">corr = {corr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Feature Suggestions */}
          <div className="glass-panel rounded-2xl p-5 border border-primary/20 bg-primary/5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkle className="h-4 w-4 text-primary" />
              AI Feature Suggestions
            </h3>
            <div className="space-y-2">
              {numCols.length >= 2 && (
                <div className="flex items-start gap-2 text-xs bg-card/60 rounded-xl p-3 border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>Consider creating <strong>interaction features</strong> from strongly correlated numerical pairs for non-linear models.</span>
                </div>
              )}
              {catCols.length > 0 && (
                <div className="flex items-start gap-2 text-xs bg-card/60 rounded-xl p-3 border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>Encode <strong>{catCols.length} categorical column{catCols.length > 1 ? "s" : ""}</strong> before training — visit the Cleaning Studio to apply One-Hot or Label encoding.</span>
                </div>
              )}
              {redundant.length > 0 && (
                <div className="flex items-start gap-2 text-xs bg-card/60 rounded-xl p-3 border border-border/40">
                  <AlertTriangle className="h-4 w-4 text-amber shrink-0 mt-0.5" />
                  <span>Drop at least one column from each redundant pair to reduce multicollinearity risk in linear models.</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs bg-card/60 rounded-xl p-3 border border-border/40">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Target <strong>feature readiness ≥ 85%</strong> for all columns before initiating AutoML training for optimal model accuracy.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
