import { useState, useEffect, useRef } from "react";
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, Clock, Trash2, SlidersHorizontal,
  Eye, BarChart3, Database, Loader2, AlertCircle
} from "lucide-react";

import { API_BASE } from "@/api";

const ACCEPTED = [".csv", ".xlsx", ".xls", ".json"];

export function UploadLibraryStep({ onUploadSuccess, onSelectDataset, onNavigateToCleaning, onNavigateToVisualization, onActivateDataset, libraryOnly = false }) {
  const [datasets, setDatasets]   = useState([]);
  const [libLoading, setLibLoading] = useState(true);
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState(null);
  const [successFile, setSuccessFile] = useState(null);
  const inputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const isPointerOverZone = (x, y) => {
    const zone = dropZoneRef.current;
    if (!zone) return false;
    const rect = zone.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  useEffect(() => {
    const handleWindowDragOver = (e) => {
      if (!dropZoneRef.current) return;
      if (!isPointerOverZone(e.clientX, e.clientY)) {
        setDragOver(false);
      }
    };

    const handleWindowDragLeave = () => {
      setDragOver(false);
    };

    const handleWindowDrop = () => {
      setDragOver(false);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", handleWindowDragLeave);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", handleWindowDragLeave);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  // ── fetch library ──────────────────────────────────────────────────────────
  const fetchLibrary = async () => {
    try {
      const res = await fetch(`${API_BASE}/datasets`);
      if (res.ok) {
        const json = await res.json();
        setDatasets(json.datasets || []);
      }
    } catch { /* offline */ }
    finally { setLibLoading(false); }
  };

  useEffect(() => { fetchLibrary(); }, []);

  // ── upload handler ─────────────────────────────────────────────────────────
  const uploadFile = async (file) => {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type "${ext}". Please upload CSV, Excel, or JSON.`);
      return;
    }
    // Hard limit: 200 MB (free-tier RAM constraint)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File too large (${(file.size / 1e6).toFixed(1)} MB). Max 200 MB on free tier.`);
      return;
    }
    setError(null);
    setSuccessFile(null);
    setUploading(true);
    setProgress(5);

    // Animate progress bar while waiting for API
    const ticker = setInterval(() => {
      setProgress(p => Math.min(90, p + 3 + Math.random() * 5));
    }, 300);

    try {
      // Step 1: Try presigned upload first (bypasses Render's ~100 MB body limit)
      const presignRes = await fetch(`${API_BASE}/upload/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ filename: file.name, content_type: file.type || "text/csv" }),
      });
      clearInterval(ticker);
      setProgress(15);

      let data;
      if (presignRes.ok) {
        const { url, key, bucket } = await presignRes.json();

        // Step 2: Upload directly to storage (browser → Supabase)
        const uploadRes = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "text/csv" },
        });
        if (!uploadRes.ok) {
          throw new Error("Upload to storage failed");
        }
        setProgress(50);

        // Step 3: Tell backend to download from storage and inspect
        const completeRes = await fetch(`${API_BASE}/upload/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ key, filename: file.name, bucket }),
        });
        if (!completeRes.ok) {
          const err = await completeRes.json();
          throw new Error(err.detail || "Failed to complete upload");
        }
        setProgress(100);
        data = await completeRes.json();
      } else {
        // Fallback: storage not configured (e.g. no credentials on Render) → use classic upload
        const form = new FormData();
        form.append("file", file);
        const directRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: form,
        });
        if (!directRes.ok) {
          const err = await directRes.json().catch(() => ({}));
          throw new Error(err.detail || `Upload failed (${directRes.status})`);
        }
        setProgress(100);
        data = await directRes.json();
      }

      setSuccessFile(file.name);

      // Refresh dataset library
      await fetchLibrary();

      if (onUploadSuccess) onUploadSuccess(data);
    } catch (e) {
      clearInterval(ticker);
      setError(e.message);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    setDragOver(false);
  };

  const handleDragEnd = () => {
    setDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  const handleDelete = async (datasetId) => {
    if (!confirm("Delete this dataset and all its cleaning history?")) return;
    try {
      await fetch(`${API_BASE}/datasets/${datasetId}`, { method: "DELETE" });
      setDatasets(prev => prev.filter(d => d.id !== datasetId));
    } catch { /* ignore */ }
  };

  const inProgress  = datasets.filter(d => d.status !== "finalized");
  const finalized   = datasets.filter(d => d.status === "finalized");

  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* ── Drop Zone ─────────────────────────────────────────────────────── */}
      {!libraryOnly && (
      <div className="space-y-3">
        <div className="text-center space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Upload a <span className="text-gradient">Dataset</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            CSV · Excel · JSON — up to 200 MB
          </p>
          <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 max-w-md mx-auto">
            ⚠ Currently limited to ~200 MB (free-tier RAM). Larger dataset support coming soon.
          </p>
        </div>

        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={(e) => { e.preventDefault(); }}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={onDrop}
          className={`conic-ring relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-14 text-center transition-all ${
            dragOver   ? "border-primary bg-primary/10 scale-[1.01]" :
            uploading  ? "border-primary/60 bg-card/60"               :
            successFile? "border-emerald/60 bg-emerald/5"              :
                         "border-border/60 bg-card/40 backdrop-blur-xl hover:border-primary/40 hover:bg-primary/5"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
          />

          {/* Icon */}
          <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-2xl shadow-[var(--glow-primary)] transition ${
            successFile ? "bg-emerald" : "bg-[image:var(--gradient-primary)]"
          } ${uploading ? "animate-pulse-glow" : "animate-float"}`}>
            {uploading   ? <Loader2 className="h-9 w-9 text-white animate-spin" /> :
             successFile ? <CheckCircle2 className="h-9 w-9 text-white" /> :
                           <UploadCloud className="h-9 w-9 text-white" />}
          </div>

          <p className="text-lg font-semibold">
            {uploading    ? "Uploading & profiling dataset…" :
             successFile  ? `✓ "${successFile}" uploaded!` :
                            "Drop your file here, or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {!uploading && !successFile && "Your dataset is profiled instantly. No data ever leaves your machine."}
          </p>

          {/* Progress bar */}
          {uploading && (
            <div className="mt-6 w-full max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Sending to SmartML engine…</span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
            </div>
          )}

          {/* Browse button */}
          {!uploading && !successFile && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); inputRef.current?.click(); }}
              className="mt-6 rounded-xl btn-gradient px-6 py-2.5 text-sm font-semibold shadow-lg"
            >
              Choose File
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
      )}

      {/* ── Dataset Library ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-bold">Dataset Library</h2>
          </div>
          <span className="text-xs text-muted-foreground">{datasets.length} saved dataset{datasets.length !== 1 ? "s" : ""}</span>
        </div>

        {libLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-border/60 p-8 text-center">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No saved datasets yet. Upload a file above to get started.</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* In-Progress */}
            {inProgress.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  In Progress ({inProgress.length})
                </h3>
                {inProgress.map(ds => (
                  <div key={ds.id} className="glass-panel rounded-xl border border-border/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/30 transition">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-amber" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{ds.name}</span>
                          <span className="rounded-full bg-amber/20 text-amber border border-amber/30 text-[10px] font-bold px-2 py-0.5">IN PROGRESS</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ds.filename} · {(ds.row_count || 0).toLocaleString()} rows · {ds.col_count || 0} cols ·{" "}
                          {(ds.cleaning_pipeline?.length || 0)} cleaning step{ds.cleaning_pipeline?.length !== 1 ? "s" : ""} saved
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button onClick={() => onActivateDataset?.(ds.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Open Dataset
                      </button>
                      <button onClick={() => onSelectDataset?.(ds.id, "preview")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-3 py-1.5 text-xs font-medium hover:bg-accent transition">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      <button onClick={() => handleDelete(ds.id)}
                        className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Finalized */}
            {finalized.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finalized ({finalized.length})
                </h3>
                {finalized.map(ds => (
                  <div key={ds.id} className="glass-panel rounded-xl border border-emerald/20 bg-emerald/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-emerald/10 border border-emerald/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{ds.name}</span>
                          <span className="rounded-full bg-emerald/20 text-emerald border border-emerald/30 text-[10px] font-bold px-2 py-0.5">FINALIZED</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ds.filename} · {(ds.row_count || 0).toLocaleString()} rows · {ds.col_count || 0} cols · Ready for ML
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => onActivateDataset?.(ds.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition">
                        <BarChart3 className="h-3.5 w-3.5" /> Open Dataset
                      </button>
                      <button onClick={() => onNavigateToCleaning?.(ds.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-xs font-medium hover:bg-accent transition">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Cleaning
                      </button>
                      <button onClick={() => handleDelete(ds.id)}
                        className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:bg-red-500/20 hover:text-red-400 transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
