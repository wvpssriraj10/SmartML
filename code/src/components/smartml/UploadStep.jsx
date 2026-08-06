import { useEffect, useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, FileJson, FileText, CheckCircle2, Clock3, Database } from "lucide-react";

const ACCEPTED = [".csv", ".xlsx", ".xls", ".json"];

export function UploadStep({ onUploaded, onResumeJob, recentJobs = [] }) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);
  const dropZoneRef = useRef(null);

  useEffect(() => {
    const handleWindowDragOver = (e) => {
      if (!dropZoneRef.current) return;
      const rect = dropZoneRef.current.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setDragOver(false);
      }
    };

    const resetDrag = () => {
      setDragOver(false);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragleave", resetDrag);
    window.addEventListener("drop", resetDrag);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragleave", resetDrag);
      window.removeEventListener("drop", resetDrag);
    };
  }, []);

  const handleFile = (f) => {
    // Hard limit: 200 MB (free-tier RAM constraint)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (f.size > MAX_SIZE) {
      alert(`File too large (${(f.size / 1e6).toFixed(1)} MB). Max 200 MB on free tier.`);
      return;
    }
    setFile(f);
    setStatus("uploading");
    setProgress(0);
    const steps = ["Reading file…", "Parsing schema…", "Validating rows…", "Handshake complete"];
    let p = 0;
    const timer = setInterval(() => {
      p += 8 + Math.random() * 12;
      setProgress(Math.min(100, Math.round(p)));
      if (p >= 100) {
        clearInterval(timer);
        setStatus("done");
        setTimeout(() => onUploaded(f), 400);
      }
    }, 140);
    void steps;
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
    if (f) handleFile(f);
  };

  return (
    <div className="animate-fade-in-up mx-auto max-w-4xl">
      <div className="mb-10 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium shadow-[var(--glow-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse-glow" />
          <span className="uppercase tracking-widest text-[10px] text-foreground/80">Step 1 · Dataset</span>
          <span className="text-muted-foreground">Drop your dataset to begin</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          Ship a model in
          <br />
          <span className="text-gradient">under 60 seconds.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Drop a dataset. SmartML inspects it, trains <span className="text-foreground font-semibold">10 algorithms</span> in parallel, and hands back deployable code.
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
        className={`conic-ring relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed p-16 text-center transition-all ${
          dragOver ? "border-primary/70 bg-primary/10 scale-[1.01]" : "border-border/70 bg-card/50 backdrop-blur-xl"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)] ${status === "uploading" ? "animate-pulse-glow" : "animate-float"}`}>
          {status === "done" ? <CheckCircle2 className="h-9 w-9 text-white" /> : <UploadCloud className="h-9 w-9 text-white" />}
        </div>
        <div className="text-lg font-semibold">
          {status === "idle" && "Drop your file here, or click to browse"}
          {status === "uploading" && "Uploading…"}
          {status === "done" && "Upload complete"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {file ? file.name : "CSV · Excel (.xlsx, .xls) · JSON — up to 200 MB"}
        </div>
        <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 max-w-md mx-auto mt-2">
          ⚠ Currently limited to ~200 MB (free-tier RAM). Larger dataset support coming soon.
        </p>

        {status === "uploading" && (
          <div className="mt-6 w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Streaming to worker…</span>
              <span className="font-mono">{progress}%</span>
            </div>
          </div>
        )}

        {status === "idle" && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-xl btn-gradient px-5 py-2.5 text-sm font-semibold"
          >
            Choose file
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { icon: FileSpreadsheet, label: "CSV", desc: "Comma-separated" },
          { icon: FileSpreadsheet, label: "Excel", desc: ".xlsx, .xls" },
          { icon: FileJson, label: "JSON", desc: "Array of records" },
        ].map((f, i) => (
          <div key={f.label} className={`glass-panel flex items-center gap-3 rounded-xl p-4 interactive-card animate-fade-in-up stagger-${i + 1}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{f.label}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        No dataset? Try our <button className="text-primary underline underline-offset-2 hover:text-violet">Sample churn dataset</button>
      </div>

      {recentJobs.length > 0 && (
        <section className="mt-12 text-left" aria-labelledby="recent-datasets-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                <Database className="h-3.5 w-3.5 text-primary" />
                Workspace library
              </div>
              <h2 id="recent-datasets-title" className="text-xl font-semibold">Your datasets</h2>
            </div>
            <span className="text-xs text-muted-foreground">{recentJobs.length} recent</span>
          </div>
          <div className="space-y-2">
            {recentJobs.map((job, i) => {
              const status = job.status || "uploaded";
              const statusLabel = status === "completed" ? "FINALIZED" : status.replace(/_/g, " ").toUpperCase();
              const date = job.updated_at || job.created_at;
              const canResume = status === "uploaded" || status === "completed";
              return (
                <div key={job.id} className={`glass-panel flex items-center gap-3 rounded-xl px-4 py-3 interactive-card animate-fade-in-up stagger-${(i % 8) + 1}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{job.original_filename}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {date ? new Date(date).toLocaleDateString() : "Recently uploaded"}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide ${
                    status === "completed"
                      ? "border-emerald/30 bg-emerald/10 text-emerald"
                      : "border-amber/30 bg-amber/10 text-amber"
                  }`}>
                    {statusLabel}
                  </span>
                  {canResume && (
                    <button
                      type="button"
                      onClick={() => onResumeJob?.(job)}
                      className="shrink-0 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
                    >
                      Resume
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
