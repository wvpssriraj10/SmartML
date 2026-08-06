import { useState, useEffect } from "react";
import {
  SlidersHorizontal, CheckCircle2, AlertTriangle, Trash2, RotateCcw, 
  Download, Lock, Sparkles, Hash, Type, ChevronRight, Layers, ArrowRight, Eye
} from "lucide-react";
import { API_BASE } from "@/api";

export function CleaningStep({ datasetId, onNavigateToPreview }) {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Form states for actions
  const [missingStrategy, setMissingStrategy] = useState("mean");
  const [missingConstant, setMissingConstant] = useState("");
  const [outlierStrategy, setOutlierStrategy] = useState("cap");
  const [encodeStrategy, setEncodeStrategy] = useState("one_hot");
  const [replaceTarget, setReplaceTarget] = useState("");
  const [replaceWith, setReplaceWith] = useState("");

  const fetchDatasetDetails = async () => {
    if (!datasetId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/datasets/${datasetId}`);
      if (res.ok) {
        const data = await res.json();
        setDataset(data);
        if (data.columns && data.columns.length > 0 && !selectedColumn) {
          setSelectedColumn(data.columns[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch dataset details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasetDetails();
  }, [datasetId]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApplyAction = async (action, extraParams = {}) => {
    if (!datasetId || dataset?.status === 'finalized') return;
    setActionLoading(true);
    try {
      const payload = {
        action,
        column: selectedColumn,
        ...extraParams
      };
      const res = await fetch(`${API_BASE}/datasets/${datasetId}/cleaning/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setDataset(prev => ({
          ...prev,
          cleaning_pipeline: data.pipeline,
          metrics: data.metrics,
          columns: data.columns,
          row_count: data.metrics.rows,
          col_count: data.metrics.cols
        }));
        if (!data.columns.includes(selectedColumn) && data.columns.length > 0) {
          setSelectedColumn(data.columns[0]);
        }
        showToast(data.message);
      }
    } catch (e) {
      console.error("Action failed", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!datasetId || dataset?.status === 'finalized') return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/datasets/${datasetId}/cleaning/undo`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setDataset(prev => ({
          ...prev,
          cleaning_pipeline: data.pipeline,
          metrics: data.metrics,
          columns: data.columns,
          row_count: data.metrics.rows,
          col_count: data.metrics.cols
        }));
        showToast(data.message);
      }
    } catch (e) {
      console.error("Undo failed", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!datasetId) return;
    try {
      const res = await fetch(`${API_BASE}/datasets/${datasetId}/finalize`, {
        method: "POST"
      });
      if (res.ok) {
        setDataset(prev => ({ ...prev, status: 'finalized' }));
        showToast("Dataset successfully finalized and locked!");
      }
    } catch (e) {
      console.error("Finalize failed", e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading Data Cleaning Studio…</span>
        </div>
      </div>
    );
  }

  if (!datasetId || !dataset) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl">
        <SlidersHorizontal className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">No Dataset Active</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please upload a dataset from the Upload section to open the Data Cleaning Studio.
        </p>
      </div>
    );
  }

  const metrics = dataset.metrics || {};
  const columnStatus = metrics.column_status || {};
  const pipeline = dataset.cleaning_pipeline || [];
  const selectedColMeta = columnStatus[selectedColumn] || {};

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald/90 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Pipeline History Breadcrumb */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">
                Data Cleaning Studio
              </h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                dataset.status === 'finalized' 
                  ? 'bg-emerald/20 text-emerald border border-emerald/30' 
                  : 'bg-amber/20 text-amber border border-amber/30'
              }`}>
                {dataset.status === 'finalized' ? 'FINALIZED' : 'IN PROGRESS'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Refine, impute, cap, and encode columns before training models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`${API_BASE}/datasets/${datasetId}/download`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-xs font-medium hover:bg-accent transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </button>

            {dataset.status !== 'finalized' && (
              <button
                onClick={handleFinalize}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald/80 hover:bg-emerald px-3 py-1.5 text-xs font-semibold text-white transition shadow-sm"
              >
                <Lock className="h-3.5 w-3.5" />
                Finalize Dataset
              </button>
            )}
          </div>
        </div>

        {/* Pipeline History Breadcrumb */}
        <div className="glass-panel rounded-xl p-3 border border-border/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Cleaning History Pipeline ({pipeline.length} steps)
            </span>
            {pipeline.length > 0 && dataset.status !== 'finalized' && (
              <button
                onClick={handleUndo}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 text-xs text-amber hover:underline font-medium"
              >
                <RotateCcw className="h-3 w-3" />
                Undo Last Step
              </button>
            )}
          </div>

          {pipeline.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No cleaning steps applied yet. Select a column below to begin.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {pipeline.map((step, idx) => (
                <div key={step.step_id || idx} className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <span className="font-bold">{idx + 1}.</span>
                    <span>{step.description}</span>
                  </div>
                  {idx < pipeline.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Strip (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-panel rounded-xl p-3.5 border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Total Columns</span>
          <div className="text-xl font-bold font-display mt-0.5">{metrics.cols || 0}</div>
          <span className="text-[10px] text-muted-foreground">{metrics.numeric_cols || 0} numeric, {metrics.categorical_cols || 0} cat</span>
        </div>

        <div className="glass-panel rounded-xl p-3.5 border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Total Values</span>
          <div className="text-xl font-bold font-display mt-0.5">{metrics.total_values?.toLocaleString() || 0}</div>
          <span className="text-[10px] text-muted-foreground">{metrics.rows?.toLocaleString() || 0} rows</span>
        </div>

        <div className="glass-panel rounded-xl p-3.5 border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Missing Cells</span>
          <div className={`text-xl font-bold font-display mt-0.5 ${(metrics.missing_cells || 0) > 0 ? "text-amber" : "text-emerald"}`}>
            {metrics.missing_cells || 0}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {metrics.missing_cells > 0 ? "Needs imputation" : "100% Complete"}
          </span>
        </div>

        <div className="glass-panel rounded-xl p-3.5 border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Outliers Detected</span>
          <div className={`text-xl font-bold font-display mt-0.5 ${(metrics.outlier_cells || 0) > 0 ? "text-amber" : "text-emerald"}`}>
            {metrics.outlier_cells || 0}
          </div>
          <span className="text-[10px] text-muted-foreground">IQR factor 1.5</span>
        </div>

        <div className="glass-panel rounded-xl p-3.5 border border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground">Quality Score</span>
          <div className="text-xl font-bold font-display text-gradient mt-0.5">{metrics.quality_score || 100}%</div>
          <span className="text-[10px] text-muted-foreground">Calculated health</span>
        </div>
      </div>

      {/* Main Studio 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* Left Column: Columns List */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-4 border border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Columns ({dataset.columns?.length || 0})
            </h3>
            <button
              onClick={() => handleApplyAction("drop_duplicates")}
              disabled={actionLoading || dataset.status === 'finalized'}
              className="text-xs text-primary hover:underline font-medium"
            >
              Drop Duplicates
            </button>
          </div>

          <div className="max-h-[460px] overflow-y-auto pr-1 space-y-1.5">
            {dataset.columns?.map(col => {
              const meta = columnStatus[col] || {};
              const isSelected = selectedColumn === col;
              const hasIssues = meta.missing > 0 || meta.outliers > 0;

              return (
                <button
                  key={col}
                  onClick={() => setSelectedColumn(col)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/50 bg-card/40 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {meta.type === "numeric" ? (
                      <Hash className="h-4 w-4 text-blue-400 shrink-0" />
                    ) : (
                      <Type className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs font-mono font-medium truncate">{col}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {meta.missing > 0 && (
                      <span className="rounded-full bg-amber/20 text-amber text-[10px] font-semibold px-2 py-0.5">
                        Missing {meta.missing}
                      </span>
                    )}
                    {meta.outliers > 0 && (
                      <span className="rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold px-2 py-0.5">
                        Outliers {meta.outliers}
                      </span>
                    )}
                    {!hasIssues && (
                      <span className="rounded-full bg-emerald/20 text-emerald text-[10px] font-semibold px-1.5 py-0.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Cleaned
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Active Column Cleaning Workbench */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-border/60 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Target Column:</span>
              <span className="font-mono text-sm font-bold text-primary">{selectedColumn}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Type: <strong className="capitalize">{selectedColMeta.type || "unknown"}</strong> · 
              Missing: <strong className={selectedColMeta.missing > 0 ? "text-amber" : ""}>{selectedColMeta.missing || 0}</strong> · 
              Outliers: <strong className={selectedColMeta.outliers > 0 ? "text-amber" : ""}>{selectedColMeta.outliers || 0}</strong>
            </p>
          </div>

          <hr className="border-border/60" />

          {/* Cleaning Actions */}
          <div className="space-y-4">
            {/* Missing Values Action */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Handle Missing Values
              </label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/80">What it is:</strong> Cells where the data is blank or absent. Most models can't train on blank cells — they get ignored or cause errors.
              </p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                <strong className="text-primary">Why we recommend it:</strong> filling in missing values lets the model use every row. The averages below are good default guesses when a value is simply missing at random.
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={missingStrategy}
                  onChange={(e) => setMissingStrategy(e.target.value)}
                  className="bg-card border border-border/80 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary flex-1"
                >
                  {selectedColMeta.type === "numeric" && <option value="mean">Impute Mean</option>}
                  {selectedColMeta.type === "numeric" && <option value="median">Impute Median</option>}
                  <option value="mode">Impute Mode</option>
                  <option value="constant">Impute Constant Value</option>
                  <option value="drop_rows">Drop Rows</option>
                </select>

                {missingStrategy === "constant" && (
                  <input
                    type="text"
                    placeholder="Val"
                    value={missingConstant}
                    onChange={(e) => setMissingConstant(e.target.value)}
                    className="w-20 bg-card border border-border/80 rounded-lg px-2 py-1 text-xs"
                  />
                )}

                <button
                  onClick={() => handleApplyAction("handle_missing", { strategy: missingStrategy, value: missingConstant })}
                  disabled={actionLoading || dataset.status === 'finalized'}
                  className="rounded-lg btn-gradient px-3 py-1.5 text-xs font-medium"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Outliers Action */}
            {selectedColMeta.type === "numeric" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Handle Outliers (IQR 1.5x)
                </label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground/80">What it is:</strong> Outliers are extreme values far outside the typical range of this column (e.g. one salary of ₹99,99,999 among salaries around ₹50,000). They're found using the IQR rule, which flags anything beyond 1.5x the distance between the 25th and 75th percentile.
                </p>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  <strong className="text-primary">Why we recommend capping:</strong> extreme values can pull averages and model predictions far off. Capping clips outliers down to the nearest sensible boundary instead of deleting rows — so you keep your data while limiting the damage. Dropping rows only makes sense when outliers look like bad data, not real extremes.
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={outlierStrategy}
                    onChange={(e) => setOutlierStrategy(e.target.value)}
                    className="bg-card border border-border/80 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary flex-1"
                  >
                    <option value="cap">Cap Outliers (IQR Clipping)</option>
                    <option value="drop_rows">Drop Outlier Rows</option>
                  </select>

                  <button
                    onClick={() => handleApplyAction("handle_outliers", { strategy: outlierStrategy })}
                    disabled={actionLoading || dataset.status === 'finalized'}
                    className="rounded-lg btn-gradient px-3 py-1.5 text-xs font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Categorical Encoding */}
            {selectedColMeta.type === "categorical" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Encoding Strategy
                </label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground/80">What it is:</strong> Models understand numbers, not words. Encoding converts text categories (like "Red", "Green", "Blue") into numbers so they can be used for training.
                </p>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  <strong className="text-primary">One-Hot</strong> creates a separate column per category — best when categories have no order (colors, cities). <strong className="text-primary">Label encoding</strong> assigns numbers 1, 2, 3… — only use it when categories have a natural order (Low, Medium, High).
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={encodeStrategy}
                    onChange={(e) => setEncodeStrategy(e.target.value)}
                    className="bg-card border border-border/80 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary flex-1"
                  >
                    <option value="one_hot">One-Hot Encoding</option>
                    <option value="label">Label / Integer Encoding</option>
                  </select>

                  <button
                    onClick={() => handleApplyAction("encode", { strategy: encodeStrategy })}
                    disabled={actionLoading || dataset.status === 'finalized'}
                    className="rounded-lg btn-gradient px-3 py-1.5 text-xs font-medium"
                  >
                    Encode
                  </button>
                </div>
              </div>
            )}

            {/* Value Replacement */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Replace Specific Value
              </label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/80">What it is:</strong> Sometimes a value is off for a known reason — a typo ("N/A" vs "NA"), a temporary code (customer "0", date "9999"), or a placeholder like "Unknown". This swaps every matching cell to a cleaner value.
              </p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                <strong className="text-primary">Use it when</strong> you know exactly what's wrong and what to fix it to — it's the most surgical fix and won't touch anything else.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Target Value"
                  value={replaceTarget}
                  onChange={(e) => setReplaceTarget(e.target.value)}
                  className="bg-card border border-border/80 rounded-lg px-2.5 py-1.5 text-xs flex-1"
                />
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  type="text"
                  placeholder="Replace With"
                  value={replaceWith}
                  onChange={(e) => setReplaceWith(e.target.value)}
                  className="bg-card border border-border/80 rounded-lg px-2.5 py-1.5 text-xs flex-1"
                />
                <button
                  onClick={() => handleApplyAction("replace_values", { value: replaceTarget, replace_with: replaceWith })}
                  disabled={actionLoading || !replaceTarget || dataset.status === 'finalized'}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Utility & Dataset Controls */}
        <div className="lg:col-span-3 glass-panel rounded-2xl p-4 border border-border/60 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Utilities & Controls
          </h3>

          <div className="space-y-2.5">
            <button
              onClick={() => handleApplyAction("drop_column")}
              disabled={actionLoading || dataset.status === 'finalized'}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 py-2.5 text-xs font-medium text-red-400 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Drop Column '{selectedColumn}'
            </button>

            {onNavigateToPreview && (
              <button
                onClick={() => onNavigateToPreview(datasetId)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/60 hover:bg-accent py-2.5 text-xs font-medium transition"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview Full Rows Table
              </button>
            )}

            <button
              onClick={handleUndo}
              disabled={actionLoading || pipeline.length === 0 || dataset.status === 'finalized'}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/60 hover:bg-accent py-2.5 text-xs font-medium transition disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber" />
              Undo Last Step
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
