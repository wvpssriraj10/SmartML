import { useState, useEffect } from "react";
import { TrendingUp, Cpu, Zap, Target, CheckCircle2, ArrowRight, BarChart3 } from "lucide-react";

const MODEL_CARDS = [
  { name: "Logistic Regression",   type: "Classification", icon: "📊", speed: "Fast",   note: "Great baseline for binary targets" },
  { name: "Random Forest",          type: "Both",           icon: "🌲", speed: "Medium", note: "Robust ensemble, handles non-linearity" },
  { name: "Gradient Boosting",      type: "Both",           icon: "🚀", speed: "Medium", note: "State-of-the-art tabular performance" },
  { name: "XGBoost",                type: "Both",           icon: "⚡", speed: "Fast",   note: "Industry-standard for structured data" },
  { name: "LightGBM",               type: "Both",           icon: "💡", speed: "Fast",   note: "Memory-efficient for large datasets" },
  { name: "Ridge Regression",       type: "Regression",     icon: "📈", speed: "Fast",   note: "Penalised linear model, low variance" },
  { name: "Decision Tree",          type: "Both",           icon: "🌿", speed: "Fast",   note: "Highly interpretable tree model" },
  { name: "SVM",                    type: "Both",           icon: "🔷", speed: "Slow",   note: "Effective in high-dimensional spaces" },
  { name: "KNN",                    type: "Both",           icon: "🔵", speed: "Medium", note: "Instance-based lazy learner" },
  { name: "Neural Net (MLP)",       type: "Both",           icon: "🧠", speed: "Slow",   note: "Deep learning for complex patterns" },
];

export function PredictionsStep({ datasetId, onNavigateToHome }) {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) { setLoading(false); return; }
    const fetch_ = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/datasets/${datasetId}`);
        if (res.ok) setDataset(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [datasetId]);

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">AutoML Predictions Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Train up to 10 models simultaneously with automated hyperparameter tuning. The best model is surfaced automatically.
          </p>
        </div>

        {onNavigateToHome && dataset && (
          <button
            onClick={onNavigateToHome}
            className="inline-flex items-center gap-2 rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold shadow-lg hover:scale-105 transition"
          >
            <Zap className="h-4 w-4" />
            Launch Training Wizard
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active Dataset Banner */}
      {dataset && (
        <div className="glass-panel rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{dataset.name}</p>
              <p className="text-xs text-muted-foreground">
                {dataset.row_count?.toLocaleString()} rows · {dataset.col_count} columns ·{" "}
                <span className={dataset.status === "finalized" ? "text-emerald" : "text-amber"}>
                  {dataset.status === "finalized" ? "✓ Finalized — Ready for Training" : "⚠ In Progress — Finalize before training for best results"}
                </span>
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
            dataset.status === "finalized"
              ? "bg-emerald/20 text-emerald border-emerald/30"
              : "bg-amber/20 text-amber border-amber/30"
          }`}>
            {dataset.status?.toUpperCase()}
          </span>
        </div>
      )}

      {/* AutoML Pipeline Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Cpu,     title: "Auto Feature Engineering",  desc: "Missing value imputation, outlier handling, categorical encoding, and normalization are applied automatically." },
          { icon: Zap,     title: "10 Models in Parallel",      desc: "All models train concurrently. Real-time progress logs stream to the training dashboard." },
          { icon: BarChart3,title: "Champion Selection",        desc: "Models are ranked by F1 / R² score. The champion is highlighted for immediate export and deployment." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="glass-panel rounded-2xl p-5 border border-border/60 space-y-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Model Catalogue */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Available Models ({MODEL_CARDS.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {MODEL_CARDS.map(({ name, type, icon, speed, note }) => (
            <div key={name} className="glass-panel rounded-xl p-4 border border-border/60 space-y-2 hover:border-primary/40 transition">
              <div className="flex items-start justify-between gap-1">
                <span className="text-xl">{icon}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                  speed === "Fast"   ? "bg-emerald/20 text-emerald border border-emerald/30" :
                  speed === "Medium" ? "bg-amber/20 text-amber border border-amber/30" :
                                       "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>{speed}</span>
              </div>
              <p className="text-xs font-semibold leading-tight">{name}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{note}</p>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary/70">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Training Tips */}
      <div className="glass-panel rounded-2xl p-5 border border-border/60 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald" />
          Best Practices Before Training
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            "Finalize your dataset in the Cleaning Studio before launching training.",
            "Use Feature Analysis to drop redundant columns and reduce multicollinearity.",
            "Review the AI Insights report to identify and resolve critical anomalies.",
            "For regression targets, verify the column is continuous (not categorical).",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-card/40 p-3 rounded-xl border border-border/40">
              <span className="text-primary font-bold shrink-0">{i + 1}.</span>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
