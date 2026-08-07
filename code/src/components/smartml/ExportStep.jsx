import { useState, useEffect } from "react";
import { FileText, Download, Code, Image, BookOpen, Sparkles, CheckCircle2, Zap, Loader2 } from "lucide-react";
import { API_BASE } from "@/api";

export function ExportStep({ jobId, results, inspection, backendResults, trainCfg, onNewSession }) {
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState([]);
  const [includedFiles, setIncludedFiles] = useState([]);

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

  const generateExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportLogs(["Preparing export package..."]);
    setIncludedFiles([]);

    try {
      const r = await fetch(`${API_BASE}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, model_name: results[0]?.name }),
      });

      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(text || `Export failed (${r.status})`);
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportProgress(100);
      setExportLogs((prev) => [...prev, "Export package ready for download."]);
      
      // Simulate included files
      setIncludedFiles(artifacts.filter(a => a.type !== "chart" || backendResults.problem_type === "classification"));
    } catch (err) {
      setExportLogs((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    generateExport();
  }, [jobId]);

  const handleDownload = () => {
    if (exportUrl) {
      const a = document.createElement("a");
      a.href = exportUrl;
      a.download = `smartml-${inspection?.filename?.replace(/\.[^/.]+$/, "") || "project"}-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(exportUrl);
    }
  };

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
          <div className={`text-xs font-medium ${exporting ? "text-amber" : exportUrl ? "text-emerald" : "text-muted-foreground"}`}>
            {exporting ? "Building..." : exportUrl ? "Ready" : "Idle"}
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
                includedFiles.some(f => f.name === a.name)
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
                {includedFiles.some(f => f.name === a.name) && (
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
        {exportUrl && (
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

      {exporting && !exportUrl && (
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