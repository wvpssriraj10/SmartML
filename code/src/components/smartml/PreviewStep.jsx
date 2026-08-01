import { useState, useEffect } from "react";
import { Table, Search, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowRight, Download } from "lucide-react";

export function PreviewStep({ datasetId, onNavigateToCleaning }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchPreview = async () => {
    if (!datasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = new URL(`http://localhost:8000/api/datasets/${datasetId}/preview`);
      url.searchParams.append("page", page);
      url.searchParams.append("page_size", pageSize);
      if (search) url.searchParams.append("search", search);

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch dataset preview", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [datasetId, page, pageSize, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  if (!datasetId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-2xl">
        <Table className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-bold">No Dataset Selected</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Please upload or select a dataset from the Library to view the full paginated row preview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dataset Row Browser
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paginated row-level inspection for dataset: <strong className="font-mono text-foreground">{data?.name || datasetId}</strong>
          </p>
        </div>

        {onNavigateToCleaning && (
          <button
            onClick={() => onNavigateToCleaning(datasetId)}
            className="inline-flex items-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-xs font-semibold shadow-lg transition hover:scale-105"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Start Data Cleaning Studio
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Controls Strip: Search & Page Size */}
      <div className="glass-panel rounded-2xl p-4 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search dataset rows..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-card border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-card border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <span className="text-xs font-mono text-muted-foreground">
            Rows {data?.start_row || 0}–{data?.end_row || 0} of {data?.total_rows?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !data || data.rows?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No records matched your search query.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/80 backdrop-blur sticky top-0 z-10 border-b border-border/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground w-12 text-center">#</th>
                  {data.columns.map((col) => (
                    <th key={col} className="px-4 py-3 font-mono font-semibold text-foreground whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-accent/30 transition">
                    <td className="px-4 py-2.5 text-center text-muted-foreground font-mono text-[11px]">
                      {(data.start_row || 1) + rIdx}
                    </td>
                    {data.columns.map((col) => (
                      <td key={col} className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground max-w-xs truncate">
                        {row[col] !== undefined && row[col] !== null ? String(row[col]) : <span className="text-amber italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Pagination Controls */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>

            <button
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page === data.total_pages}
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
