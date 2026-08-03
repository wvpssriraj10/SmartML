import { useState, useEffect } from "react";
import { 
  Brain, Download, ShieldAlert, CheckCircle2, AlertTriangle, 
  Sparkles, Layers, TrendingUp, BarChart, FileText, ArrowUpRight, Zap
} from "lucide-react";
import { API_BASE } from "@/api";

export function AiInsightsStep({ datasetId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!datasetId) {
      setLoading(false);
      return;
    }
    const fetchInsights = async () => {
      try {
        const res = await fetch(`${API_BASE}/datasets/${datasetId}/ai-insights`);
        if (res.ok) {
          const json = await res.json();
          setData(json.insights);
        }
      } catch (e) {
        console.error("Failed to fetch AI insights", e);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [datasetId]);

  const handleDownloadPdf = () => {
    if (!datasetId) return;
    window.open(`${API_BASE}/datasets/${datasetId}/pdf-report`);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Synthesizing AI Executive Insights & Scanning Anomalies…</span>
        </div>
      </div>
    );
  }

  if (!datasetId || !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl">
        <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">No Dataset Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please select or upload a dataset from the Upload section to generate AI Executive Insights and download PDF reports.
        </p>
      </div>
    );
  }

  const riskColor = data.risk_level === 'HIGH' ? 'text-red-400 bg-red-500/20 border-red-500/30' :
                    data.risk_level === 'MODERATE' ? 'text-amber bg-amber/20 border-amber/30' :
                    'text-emerald bg-emerald/20 border-emerald/30';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              AI Executive Insights & Intelligence
            </h1>
            <span className="rounded-full bg-primary/20 text-primary border border-primary/30 text-xs font-semibold px-2.5 py-0.5">
              AUTO-GEN
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated narrative storytelling, business risk assessment, anomaly detection, and PDF reporting.
          </p>
        </div>

        <button
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-xs font-semibold shadow-lg hover:scale-105 transition"
        >
          <Download className="h-4 w-4" />
          Download Executive PDF Report
        </button>
      </div>

      {/* Top Metric Row (4 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-border/60">
          <span className="text-xs font-medium text-muted-foreground">Dataset Correlation</span>
          <div className="text-2xl font-bold font-display mt-1">{data.dataset_correlation}</div>
          <span className="text-[10px] text-muted-foreground">Inter-feature metric</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-border/60">
          <span className="text-xs font-medium text-muted-foreground">Data Completeness</span>
          <div className="text-2xl font-bold font-display text-emerald mt-1">{data.data_completeness_pct}%</div>
          <span className="text-[10px] text-muted-foreground">Non-null cell percentage</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-border/60">
          <span className="text-xs font-medium text-muted-foreground">Risk Level</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`rounded-full px-3 py-0.5 text-sm font-bold border ${riskColor}`}>
              {data.risk_level} ({data.risk_score}/100)
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">Evaluated operational risk</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-border/60">
          <span className="text-xs font-medium text-muted-foreground">Data Quality Score</span>
          <div className="text-2xl font-bold font-display text-gradient mt-1">{data.quality_score}%</div>
          <span className="text-[10px] text-muted-foreground">Overall health score</span>
        </div>
      </div>

      {/* Comprehensive Intelligence Grid (6 metrics) */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comprehensive Intelligence Overview
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Missing Values</span>
            <div className="text-lg font-bold mt-0.5">{data.intelligence_grid.missing_pct}%</div>
          </div>
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Duplicate Rows</span>
            <div className="text-lg font-bold mt-0.5">{data.intelligence_grid.duplicate_pct}%</div>
          </div>
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Categorical Features</span>
            <div className="text-lg font-bold mt-0.5">{data.intelligence_grid.categorical_count}</div>
          </div>
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Numerical Features</span>
            <div className="text-lg font-bold mt-0.5">{data.intelligence_grid.numerical_count}</div>
          </div>
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Anomalies Detected</span>
            <div className={`text-lg font-bold mt-0.5 ${data.intelligence_grid.anomalies_count > 0 ? "text-amber" : "text-emerald"}`}>
              {data.intelligence_grid.anomalies_count}
            </div>
          </div>
          <div className="glass-panel rounded-xl p-3 border border-border/50">
            <span className="text-[11px] text-muted-foreground">Strong Correlations</span>
            <div className="text-lg font-bold mt-0.5">{data.intelligence_grid.strong_correlations_count}</div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: The Data Story & Business Risk Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* The Data Story */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-border/60 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">The Data Story</h2>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {data.data_story}
          </p>

          <div className="rounded-xl bg-card/60 p-4 border border-border/50 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Executive Summary</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.executive_summary}
            </p>
          </div>

          {/* Quality Breakdown Bars */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality Dimensions</span>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Completeness</span>
                  <span className="font-mono text-emerald">{data.data_completeness_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald transition-all" style={{ width: `${data.data_completeness_pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Consistency</span>
                  <span className="font-mono text-blue-400">{data.consistency_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-blue-400 transition-all" style={{ width: `${data.consistency_pct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Validity</span>
                  <span className="font-mono text-amber">{data.validity_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-amber transition-all" style={{ width: `${data.validity_pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Business Risk Assessment */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-border/60 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber" />
              <h2 className="font-display text-lg font-bold">Business Risk Assessment</h2>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${riskColor}`}>
              {data.risk_level} RISK
            </span>
          </div>

          {/* Risk Breakdown Category Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Revenue Risk</span>
                <span className="font-mono text-amber">{data.risk_breakdown.revenue_risk}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber transition-all" style={{ width: `${data.risk_breakdown.revenue_risk}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Expense Risk</span>
                <span className="font-mono text-blue-400">{data.risk_breakdown.expense_risk}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-blue-400 transition-all" style={{ width: `${data.risk_breakdown.expense_risk}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Operational Risk</span>
                <span className="font-mono text-emerald">{data.risk_breakdown.operational_risk}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald transition-all" style={{ width: `${data.risk_breakdown.operational_risk}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Data Quality Risk</span>
                <span className="font-mono text-purple-400">{data.risk_breakdown.data_quality_risk}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-purple-400 transition-all" style={{ width: `${data.risk_breakdown.data_quality_risk}%` }} />
              </div>
            </div>
          </div>

          {/* Recommended Actions List */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recommended Strategic Actions
            </h4>
            <div className="space-y-2">
              {data.recommended_actions?.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground bg-card/40 p-2.5 rounded-xl border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-0.5" />
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Anomaly Detection Report Table */}
      <div className="glass-panel rounded-2xl p-6 border border-border/60 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Statistical Anomaly Scanner</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Outliers and extreme values detected via 3.0+ Z-Score and 1.5x IQR boundary tests.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-2.5 py-0.5">
              Critical: {data.anomalies_summary?.critical || 0}
            </span>
            <span className="rounded-full bg-amber/20 text-amber border border-amber/30 text-xs font-semibold px-2.5 py-0.5">
              Warning: {data.anomalies_summary?.warning || 0}
            </span>
          </div>
        </div>

        {data.anomalies?.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground italic">
            No statistical anomalies detected in numerical columns.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/60 border-b border-border/60">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-muted-foreground">Row #</th>
                  <th className="px-4 py-2.5 font-semibold text-muted-foreground">Column</th>
                  <th className="px-4 py-2.5 font-semibold text-muted-foreground">Actual Value</th>
                  <th className="px-4 py-2.5 font-semibold text-muted-foreground">Expected Range</th>
                  <th className="px-4 py-2.5 font-semibold text-muted-foreground">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.anomalies?.map((a, idx) => (
                  <tr key={idx} className="hover:bg-accent/30 transition">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-foreground">Row {a.row_id}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-primary">{a.column}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-foreground">{a.actual_value}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{a.expected_range}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        a.severity === 'CRITICAL' 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                          : 'bg-amber/20 text-amber border border-amber/30'
                      }`}>
                        {a.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
