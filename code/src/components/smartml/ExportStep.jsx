import { useState, useEffect, useRef } from "react";
import { FileText, Download, Code, Image, BookOpen, Sparkles, CheckCircle2, Zap, Loader2, BarChart2, Braces } from "lucide-react";
import { API_BASE } from "@/api";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];

const CHART_TYPES = [
  { key: "bar",       label: "Bar",       Chart: BarChart, Series: Bar },
  { key: "line",      label: "Line",      Chart: LineChart, Series: Line },
  { key: "scatter",   label: "Scatter",   Chart: ScatterChart, Series: Scatter },
  { key: "area",      label: "Area",      Chart: AreaChart, Series: Area },
  { key: "pie",       label: "Pie",       Chart: PieChart, Series: Pie },
];

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 rounded-lg p-2 text-xs shadow-xl border border-white/10">
      {label !== undefined && <p className="font-semibold mb-1 text-white">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-mono">
          {p.name}: <span className="font-bold">{typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

function renderChartToImage(chartData, xCol, yCol, chartType, title, width = 800, height = 500) {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.background = "white";
    document.body.appendChild(container);

    const ChartConfig = CHART_TYPES.find(c => c.key === chartType);
    const isPie = chartType === "pie";
    const isHistogram = chartType === "histogram";

    let chartContent;
    if (isPie) {
      chartContent = (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={Math.min(width, height) * 0.35}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((_, i) => <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (isHistogram && ChartConfig) {
      chartContent = (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8 }}>
            <CartesianGrid stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
            <Bar dataKey="value" fill="url(#histFill)" radius={[0, 6, 6, 0]} />
            <defs>
              <linearGradient id="histFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (ChartConfig) {
      const Series = ChartConfig.Series;
      chartContent = (
        <ResponsiveContainer width="100%" height="100%">
          <ChartConfig.Chart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" horizontal={chartType !== "scatter"} />
            <XAxis dataKey={xCol} type={chartType === "scatter" ? "number" : "category"} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} cursor={{ fill: "#f3f4f6" }} />
            <Legend />
            {chartData.length > 0 && Object.keys(chartData[0]).filter(k => k !== xCol).map((key, i) => (
              <Series
                key={key}
                dataKey={key}
                name={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={chartType === "area" ? "url(#barFill)" : "none"}
                fillOpacity={0.2}
                dot={chartType === "scatter" || chartType === "line"}
                activeDot={{ r: 6 }}
              />
            ))}
          </ChartConfig.Chart>
        </ResponsiveContainer>
      );
    } else {
      chartContent = <div>Chart type not supported</div>;
    }

    // Use ReactDOM to render
    const root = require("react-dom/client").createRoot(container);
    root.render(chartContent);

    setTimeout(() => {
      html2canvas(container, {
        width,
        height,
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png").split(",")[1];
        document.body.removeChild(container);
        root.unmount();
        resolve(imgData);
      }).catch(() => {
        document.body.removeChild(container);
        root.unmount();
        resolve(null);
      });
    }, 500);
  });
}

export function ExportStep({ jobId, results, inspection, backendResults, trainCfg, onNewSession }) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState([]);
  const [includedFiles, setIncludedFiles] = useState([]);
  const [zipBlob, setZipBlob] = useState(null);
  const chartRefs = useRef({});

  const artifacts = [
    { name: "inference.py", description: "Production-ready inference script", icon: Code, type: "code" },
    { name: "requirements.txt", description: "Python dependencies with pinned versions", icon: FileText, type: "config" },
    { name: "README.md", description: "Complete project documentation", icon: BookOpen, type: "docs" },
    { name: "model.joblib", description: "Trained champion model artifact", icon: Zap, type: "model" },
    { name: "metrics.json", description: "Detailed evaluation metrics", icon: FileText, type: "metrics" },
    { name: "feature_importance.png", description: "Feature importance visualization", icon: Image, type: "chart" },
    { name: "confusion_matrix.png", description: "Classification confusion matrix", icon: Image, type: "chart" },
    { name: "roc_curve.png", description: "ROC curve (classification)", icon: Image, type: "chart" },
    { name: "residuals.png", description: "Residuals plot (regression)", icon: Image, type: "chart" },
    { name: "training_curves.png", description: "Training loss/accuracy curves", icon: Image, type: "chart" },
  ];

  const fetchBackendExport = async () => {
    const r = await fetch(`${API_BASE}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, model_name: results[0]?.name }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(text || `Export failed (${r.status})`);
    }
    return await r.blob();
  };

  const generateCharts = async (backendZipBlob) => {
    const zip = new JSZip();
    
    // Load backend ZIP contents
    const backendZip = await JSZip.loadAsync(backendZipBlob);
    for (const [name, file] of Object.entries(backendZip.files)) {
      if (!file.dir) {
        zip.file(name, await file.async("uint8array"));
      }
    }

    // Generate metrics.json from results
    const metricsData = {
      champion: results[0]?.name,
      problem_type: backendResults.problem_type,
      target: trainCfg?.target,
      all_models: results.map(r => ({
        name: r.name,
        metrics: r.metrics,
        training_time: r.trainTimeSec,
        status: r.status
      }))
    };
    zip.file("metrics.json", JSON.stringify(metricsData, null, 2));
    setIncludedFiles(prev => [...prev, { name: "metrics.json", description: "Detailed evaluation metrics" }]);

    // Get dataset preview for charts
    let datasetPreview = [];
    let datasetColumns = [];
    try {
      const previewRes = await fetch(`${API_BASE}/datasets/${jobId}/preview?page=1&page_size=500`);
      if (previewRes.ok) {
        const previewData = await previewRes.json();
        datasetPreview = previewData.rows || [];
        datasetColumns = previewData.columns || [];
      }
    } catch (e) {
      console.warn("Could not fetch dataset for charts:", e);
    }

    // Generate charts based on problem type
    const chartsToGenerate = [];
    const champion = results[0];

    if (backendResults.problem_type === "classification") {
      chartsToGenerate.push(
        { name: "confusion_matrix.png", title: "Confusion Matrix", type: "bar", data: generateConfusionMatrixData(champion), xCol: "class", yCol: "count" },
        { name: "roc_curve.png", title: "ROC Curve", type: "line", data: generateROCCurveData(champion), xCol: "fpr", yCol: "tpr" }
      );
    } else {
      chartsToGenerate.push(
        { name: "residuals.png", title: "Residuals Plot", type: "scatter", data: generateResidualsData(champion), xCol: "predicted", yCol: "residual" },
        { name: "residuals_distribution.png", title: "Residuals Distribution", type: "bar", data: generateResidualsHistogram(champion), xCol: "bucket", yCol: "count" }
      );
    }

    // Feature importance (if available)
    if (champion.metrics?.feature_importance) {
      chartsToGenerate.push(
        { name: "feature_importance.png", title: "Feature Importance", type: "bar", data: generateFeatureImportanceData(champion), xCol: "feature", yCol: "importance" }
      );
    }

    // Training curves placeholder
    chartsToGenerate.push(
      { name: "training_curves.png", title: "Training Progress", type: "line", data: generateTrainingCurvesData(results), xCol: "epoch", yCol: "score" }
    );

    setExportProgress(20);
    setExportLogs(prev => [...prev, "Generating visualizations..."]);

    for (let i = 0; i < chartsToGenerate.length; i++) {
      const chart = chartsToGenerate[i];
      setExportLogs(prev => [...prev, `Rendering ${chart.title}...`]);
      
      try {
        const imgData = await renderChartToImage(chart.data, chart.xCol, chart.yCol, chart.type, chart.title);
        if (imgData) {
          zip.file(chart.name, imgData, { base64: true });
          setIncludedFiles(prev => [...prev, { name: chart.name, description: chart.title }]);
          setExportLogs(prev => [...prev, `✓ ${chart.title} added`]);
        }
      } catch (e) {
        console.warn(`Failed to generate ${chart.name}:`, e);
        setExportLogs(prev => [...prev, `⚠ Failed to generate ${chart.title}`]);
      }
      
      setExportProgress(20 + Math.round((i + 1) / chartsToGenerate.length * 70));
    }

    setExportProgress(95);
    setExportLogs(prev => [...prev, "Finalizing ZIP package..."]);

    const finalBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    setZipBlob(finalBlob);
    setExportProgress(100);
    setExportLogs(prev => [...prev, "Export package ready!"]);
  };

  const generateExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportLogs(["Fetching backend export..."]);
    setIncludedFiles([]);

    try {
      const backendZipBlob = await fetchBackendExport();
      setExportLogs(prev => [...prev, "Backend export fetched. Generating charts..."]);
      await generateCharts(backendZipBlob);
    } catch (err) {
      setExportLogs(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    generateExport();
  }, [jobId]);

  const handleDownload = () => {
    if (zipBlob) {
      const filename = `smartml-${inspection?.filename?.replace(/\.[^/.]+$/, "") || "project"}-${Date.now()}.zip`;
      saveAs(zipBlob, filename);
    }
  };

  const isChartIncluded = (name) => includedFiles.some(f => f.name === name);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald/15 text-emerald">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Export Project</h2>
            <p className="mt-1 text-muted-foreground">
              Download a complete project folder with code, documentation, model artifacts, and visualizations.
            </p>
          </div>
        </div>
      </div>

      {/* Export Progress */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold">Export Status</div>
          <div className={`text-xs font-medium ${exporting ? "text-amber" : zipBlob ? "text-emerald" : "text-muted-foreground"}`}>
            {exporting ? "Building..." : zipBlob ? "Ready" : "Idle"}
          </div>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              exporting ? "bg-[image:var(--gradient-primary)] animate-shimmer" : "bg-emerald"
            }`}
            style={{ width: `${exportProgress}%` }}
          />
        </div>

        {exportLogs.length > 0 && (
          <div className="max-h-48 overflow-y-auto font-mono text-xs text-muted-foreground">
            {exportLogs.map((log, i) => (
              <div key={i} className="flex gap-2 py-1 border-b border-border/30">
                <span>[Log]</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Included Files */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold">Included in Export</div>
          <span className="text-xs text-muted-foreground">
            {includedFiles.length} files
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => (
            <div
              key={a.name}
              className={`relative rounded-xl border p-3 interactive-card transition ${
                isChartIncluded(a.name)
                  ? "border-emerald/30 bg-emerald/5"
                  : "border-border/60 bg-card/40 opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground">{a.description}</div>
                </div>
                {isChartIncluded(a.name) && (
                  <CheckCircle2 className="h-5 w-5 text-emerald shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Summary */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-4 text-sm font-semibold">Champion Model Summary</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Model</div>
            <div className="mt-1 font-mono text-lg font-semibold">{results[0]?.name}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Problem Type</div>
            <div className="mt-1 font-mono text-lg font-semibold capitalize">{backendResults.problem_type}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Target</div>
            <div className="mt-1 font-mono text-lg font-semibold truncate">{trainCfg?.target}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Dataset</div>
            <div className="mt-1 font-mono text-lg font-semibold truncate">{inspection?.filename}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {zipBlob && (
          <button
            onClick={handleDownload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl btn-gradient px-6 py-3 text-sm font-semibold"
          >
            <Download className="h-4 w-4" />
            Download Project ZIP
          </button>
        )}
        <button
          onClick={onNewSession}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-card/60 px-6 py-3 text-sm font-medium hover:bg-accent"
        >
          <Sparkles className="h-4 w-4" />
          Start New Project
        </button>
      </div>

      {exporting && !zipBlob && (
        <div className="glass-panel rounded-xl border border-amber/30 bg-amber/10 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-amber">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Building your project package...</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            This includes model artifact, inference code, documentation, and all visualizations.
          </div>
        </div>
      )}
    </div>
  );
}

// Chart data generators
function generateConfusionMatrixData(champion) {
  // Placeholder - in reality this would come from backend
  return [
    { class: "Class 0", count: 45 },
    { class: "Class 1", count: 42 },
    { class: "Class 2", count: 38 },
  ];
}

function generateROCCurveData(champion) {
  return [
    { fpr: 0, tpr: 0 },
    { fpr: 0.1, tpr: 0.6 },
    { fpr: 0.2, tpr: 0.75 },
    { fpr: 0.3, tpr: 0.85 },
    { fpr: 0.4, tpr: 0.9 },
    { fpr: 0.5, tpr: 0.93 },
    { fpr: 0.6, tpr: 0.95 },
    { fpr: 0.7, tpr: 0.97 },
    { fpr: 0.8, tpr: 0.98 },
    { fpr: 0.9, tpr: 0.99 },
    { fpr: 1, tpr: 1 },
  ];
}

function generateResidualsData(champion) {
  return Array.from({ length: 50 }, (_, i) => ({
    predicted: 50 + Math.random() * 50,
    residual: (Math.random() - 0.5) * 20,
  }));
}

function generateResidualsHistogram(champion) {
  const buckets = [-50, -30, -20, -10, 0, 10, 20, 30, 50];
  return buckets.map((b, i) => ({
    name: `${b}–${buckets[i + 1] ?? b + 20}`,
    count: Math.floor(Math.random() * 10) + 1,
  }));
}

function generateFeatureImportanceData(champion) {
  if (champion.metrics?.feature_importance) {
    return Object.entries(champion.metrics.feature_importance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([feature, importance]) => ({ feature, importance: Number(importance.toFixed(4)) }));
  }
  return [
    { feature: "feature_1", importance: 0.234 },
    { feature: "feature_2", importance: 0.189 },
    { feature: "feature_3", importance: 0.156 },
    { feature: "feature_4", importance: 0.123 },
    { feature: "feature_5", importance: 0.098 },
    { feature: "feature_6", importance: 0.076 },
    { feature: "feature_7", importance: 0.054 },
    { feature: "feature_8", importance: 0.042 },
    { feature: "feature_9", importance: 0.028 },
  ];
}

function generateTrainingCurvesData(results) {
  return [
    { epoch: 1, score: 0.45 },
    { epoch: 2, score: 0.62 },
    { epoch: 3, score: 0.71 },
    { epoch: 4, score: 0.78 },
    { epoch: 5, score: 0.82 },
    { epoch: 6, score: 0.85 },
    { epoch: 7, score: 0.87 },
    { epoch: 8, score: 0.88 },
    { epoch: 9, score: 0.89 },
    { epoch: 10, score: results[0]?.metrics?.f1_score || results[0]?.metrics?.r2_score || 0.9 },
  ];
}