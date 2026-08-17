export function mapInspection(apiInspection, fileName) {
  const rows = apiInspection.rows ?? 0;
  const columns = apiInspection.column_names || [];
  const dtypes = apiInspection.dtypes || {};
  const missing = apiInspection.missing_values || {};
  const colStats = apiInspection.column_stats || {};
  const numeric = new Set(apiInspection.numeric_columns || []);
  const datetime = new Set(apiInspection.datetime_columns || []);
  const previewHeaders = apiInspection.preview_headers || [];
  const previewRows = apiInspection.preview_rows || [];

  return {
    filename: fileName,
    qualityScore: apiInspection.kpis?.data_quality_score ?? 100,
    rows,
    cols: apiInspection.columns ?? columns.length,
    totalCells: rows * (apiInspection.columns ?? columns.length),
    missingCells: Object.values(missing).reduce((sum, value) => sum + (value || 0), 0),
    duplicates: apiInspection.duplicate_rows ?? 0,
    columns: columns.map((name) => ({
      name,
      type: numeric.has(name) ? "numeric" : datetime.has(name) ? "datetime" : "categorical",
      missingPct: rows > 0 ? ((missing[name] || 0) / rows) * 100 : 0,
      unique: colStats[name]?.unique_count ?? 0,
      dtype: dtypes[name] || "unknown",
    })),
    preview: previewRows.map((values) => {
      const row = {};
      previewHeaders.forEach((header, idx) => {
        row[header] = values[idx];
      });
      return row;
    }),
    suggestedTarget: apiInspection.suggested_target || columns[columns.length - 1] || "",
    suggestedProblem: apiInspection.suggested_problem_type || "classification",
    targetReason: [
      `Based on column profiling, "${apiInspection.suggested_target || columns[columns.length - 1] || "target"}" is likely a strong prediction target.`,
      `Detected ${apiInspection.numeric_columns?.length || 0} numeric and ${apiInspection.categorical_columns?.length || 0} categorical columns for feature learning.`,
      `Missing values are automatically handled in preprocessing before training.`,
    ],
  };
}

export function mapResults(apiResults) {
  const problemType = apiResults.problem_type || "classification";
  const sortKey = problemType === "classification" ? "f1_score" : "r2_score";
  const ranked = [...(apiResults.results || [])]
    .sort((a, b) => (b.metrics?.[sortKey] ?? 0) - (a.metrics?.[sortKey] ?? 0))
    .map((item, idx) => {
      const metrics = { ...(item.metrics || {}) };
      if (metrics.f1_score != null && metrics.f1 == null) metrics.f1 = metrics.f1_score;
      if (metrics.r2_score != null && metrics.r2 == null) metrics.r2 = metrics.r2_score;
      return ({
      name: item.model_name,
      rank: idx + 1,
      isChampion: idx === 0,
      metrics,
      trainTimeSec: item.training_time || 0,
      status: item.status || "completed",
    });
    });
  return { problemType, ranked };
}