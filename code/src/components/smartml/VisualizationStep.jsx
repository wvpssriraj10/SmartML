import { useState, useEffect } from "react";
import {
  BarChart2, ScatterChart, LineChart as LineChartIcon, PieChart as PieChartIcon,
  LayoutGrid, Flame, RefreshCw, BarChart3
} from "lucide-react";
import { API_BASE } from "@/api";
import {
  BarChart, Bar, LineChart, Line, ScatterChart as RechartsScatter, Scatter,
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CHART_TYPES = [
  { key: "bar",       label: "Bar",       Icon: BarChart2 },
  { key: "line",      label: "Line",      Icon: LineChartIcon },
  { key: "scatter",   label: "Scatter",   Icon: ScatterChart },
  { key: "area",      label: "Area",      Icon: BarChart3 },
  { key: "pie",       label: "Pie",       Icon: PieChartIcon },
  { key: "histogram", label: "Histogram", Icon: LayoutGrid },
];

const PALETTE = [
  "#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6",
  "#a855f7","#ec4899","#14b8a6","#f97316","#8b5cf6",
];

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-xl p-3 border border-border/80 text-xs shadow-xl">
      {label !== undefined && <p className="font-semibold mb-1 text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-mono">
          {p.name}: <span className="font-bold">{typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export function VisualizationStep({ datasetId }) {
  const [meta, setMeta]       = useState(null);   // { columns, numeric_cols, categorical_cols }
  const [preview, setPreview] = useState([]);       // raw data rows
  const [loading, setLoading] = useState(true);
  const [xCol, setXCol]       = useState(null);
  const [yCol, setYCol]       = useState(null);
  const [chartType, setChartType] = useState("bar");
  const [maxRows] = useState(500);

  useEffect(() => {
    if (!datasetId) { setLoading(false); return; }

    const fetchMeta = async () => {
      try {
        const [detailRes, previewRes] = await Promise.all([
          fetch(`${API_BASE}/datasets/${datasetId}`),
          fetch(`${API_BASE}/datasets/${datasetId}/preview?page=1&page_size=${maxRows}`),
        ]);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const allCols = detail.columns || [];
          const numericCols = Object.entries(detail.metrics?.column_status || {})
            .filter(([, v]) => v.type === "numeric").map(([k]) => k);
          const categoricalCols = allCols.filter(c => !numericCols.includes(c));

          setMeta({ columns: allCols, numeric_cols: numericCols, categorical_cols: categoricalCols });

          if (numericCols.length >= 2) {
            setXCol(numericCols[0]);
            setYCol(numericCols[1]);
          } else if (categoricalCols.length && numericCols.length) {
            setXCol(categoricalCols[0]);
            setYCol(numericCols[0]);
          } else if (allCols.length >= 2) {
            setXCol(allCols[0]);
            setYCol(allCols[1]);
          }
        }
        if (previewRes.ok) {
          const pv = await previewRes.json();
          setPreview(pv.rows || []);
        }
      } catch (e) {
        console.error("Visualization fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, [datasetId]);

  // ─── Build chart data from raw preview rows ───────────────────────────────
  const chartData = (() => {
    if (!xCol || !yCol || !preview.length) return [];

    if (chartType === "histogram") {
      const nums = preview.map(r => parseFloat(r[xCol])).filter(n => !isNaN(n));
      if (!nums.length) return [];
      const min = Math.min(...nums), max = Math.max(...nums);
      const buckets = 20;
      const size = (max - min) / buckets || 1;
      const counts = Array.from({ length: buckets }, (_, i) => ({
        range: `${(min + i * size).toFixed(1)}`,
        count: 0,
      }));
      nums.forEach(n => {
        const idx = Math.min(Math.floor((n - min) / size), buckets - 1);
        counts[idx].count++;
      });
      return counts;
    }

    if (chartType === "pie") {
      const counts = {};
      preview.forEach(r => {
        const key = String(r[xCol] ?? "null");
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name, value]) => ({ name, value }));
    }

    if (chartType === "scatter") {
      return preview
        .map(r => ({
          x: parseFloat(r[xCol]),
          y: parseFloat(r[yCol]),
        }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y))
        .slice(0, 400);
    }

    // bar / line / area — aggregate by X
    const agg = {};
    preview.forEach(r => {
      const key = String(r[xCol] ?? "null");
      const val = parseFloat(r[yCol]);
      if (!agg[key]) agg[key] = { sum: 0, count: 0 };
      if (!isNaN(val)) { agg[key].sum += val; agg[key].count++; }
    });
    return Object.entries(agg)
      .slice(0, 60)
      .map(([name, { sum, count }]) => ({
        name,
        [yCol]: count ? parseFloat((sum / count).toFixed(2)) : 0,
      }));
  })();

  const renderChart = () => {
    const commonProps = { data: chartData, margin: { top: 10, right: 20, bottom: 40, left: 10 } };
    const axisStyle  = { fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" };
    const primary    = PALETTE[0];
    const secondary  = PALETTE[1];

    if (chartType === "bar")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval="preserveStartEnd" />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Bar dataKey={yCol} fill={primary} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    if (chartType === "line")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval="preserveStartEnd" />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Line dataKey={yCol} stroke={primary} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );

    if (chartType === "area")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={primary} stopOpacity={0.35} />
                <stop offset="95%" stopColor={primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={axisStyle} angle={-35} textAnchor="end" interval="preserveStartEnd" />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Area dataKey={yCol} stroke={primary} fill="url(#areaGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      );

    if (chartType === "scatter")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <RechartsScatter margin={commonProps.margin}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="x" type="number" name={xCol} tick={axisStyle} label={{ value: xCol, position: "insideBottom", offset: -30, fill: "#94a3b8", fontSize: 10 }} />
            <YAxis dataKey="y" type="number" name={yCol} tick={axisStyle} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CUSTOM_TOOLTIP />} />
            <Scatter data={chartData} fill={primary} fillOpacity={0.7} />
          </RechartsScatter>
        </ResponsiveContainer>
      );

    if (chartType === "pie")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip content={<CUSTOM_TOOLTIP />} />
          </PieChart>
        </ResponsiveContainer>
      );

    if (chartType === "histogram")
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="range" tick={axisStyle} angle={-35} textAnchor="end" interval={2} />
            <YAxis tick={axisStyle} />
            <Tooltip content={<CUSTOM_TOOLTIP />} />
            <Bar dataKey="count" fill={secondary} radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    return null;
  };

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading dataset for visualization…</span>
        </div>
      </div>
    );

  if (!datasetId || !meta)
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">No Dataset Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Upload or select a dataset from the Library to open the Bivariate Visualization workbench.
        </p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Bivariate Visualization Workbench</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Explore relationships across {meta.columns.length} columns · {preview.length?.toLocaleString()} data points loaded
        </p>
      </div>

      {/* Controls Panel */}
      <div className="glass-panel rounded-2xl border border-border/60 p-5 space-y-5">

        {/* Chart Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chart Type</label>
          <div className="flex flex-wrap gap-2">
            {CHART_TYPES.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setChartType(key)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  chartType === key
                    ? "border-primary bg-primary/15 text-primary shadow-sm"
                    : "border-border/60 bg-card/50 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Axis Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {chartType === "histogram" ? "Column (Distribution)" : "X-Axis Column"}
            </label>
            <select
              value={xCol || ""}
              onChange={e => setXCol(e.target.value)}
              className="w-full bg-card border border-border/80 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
            >
              {meta.columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {chartType !== "histogram" && chartType !== "pie" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Y-Axis Column</label>
              <select
                value={yCol || ""}
                onChange={e => setYCol(e.target.value)}
                className="w-full bg-card border border-border/80 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
              >
                {meta.columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="glass-panel rounded-2xl border border-border/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">
            {chartType === "histogram"
              ? `Distribution of "${xCol}"`
              : chartType === "pie"
              ? `Composition of "${xCol}"`
              : `"${xCol}" vs "${yCol}"`}
          </h3>
          <span className="text-xs text-muted-foreground font-mono">{chartData.length} data points</span>
        </div>

        {chartData.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No numeric data available for the selected columns and chart type.
          </div>
        ) : (
          renderChart()
        )}
      </div>

      {/* Quick Insights Strip */}
      {(chartType === "bar" || chartType === "line" || chartType === "area") && chartData.length > 0 && (() => {
        const vals = chartData.map(d => d[yCol]).filter(v => v !== undefined && !isNaN(v));
        const mx  = Math.max(...vals).toLocaleString(undefined, { maximumFractionDigits: 2 });
        const mn  = Math.min(...vals).toLocaleString(undefined, { maximumFractionDigits: 2 });
        const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toLocaleString(undefined, { maximumFractionDigits: 2 });
        return (
          <div className="grid grid-cols-3 gap-3">
            {[["Max", mx, "text-emerald"], ["Min", mn, "text-amber"], ["Avg", avg, "text-primary"]].map(([label, val, cls]) => (
              <div key={label} className="glass-panel rounded-xl p-3 border border-border/50 text-center">
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <div className={`font-display font-bold text-lg mt-0.5 ${cls}`}>{val}</div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
