import { useEffect, useMemo, useState } from "react";
import {
  ScanSearch, Loader2, CircleAlert, Sparkles, Info, ChevronRight, CheckSquare, Square, Lightbulb,
} from "lucide-react";
import { API_BASE } from "@/api";

const DETECTOR_ACCENTS = {
  "Isolation Forest": "amber",
  "Local Outlier Factor": "cyan",
  "One-Class SVM": "violet",
};

const ACCENT_TEXT = { violet: "text-violet", cyan: "text-cyan", amber: "text-amber", emerald: "text-emerald" };
const ACCENT_BG = { violet: "bg-violet/15", cyan: "bg-cyan/15", amber: "bg-amber/15", emerald: "bg-emerald/15" };
const ACCENT_BORDER = { violet: "border-violet/40", cyan: "border-cyan/40", amber: "border-amber/40", emerald: "border-emerald/40" };

// Plain-language explanations so non-experts can pick without knowing ML.
const DETECTOR_PLAIN = {
  "Isolation Forest": {
    what: "Finds the rows that are 'easiest to single out' — like spotting the odd one out in a crowd.",
    example: "Like a game of 'spot the difference': rows that stand out quickly get flagged.",
    goodFor: "Best first choice. Fast, reliable, works on most data.",
  },
  "Local Outlier Factor": {
    what: "Compares each row with its neighbors — rows in sparse, lonely areas stand out.",
    example: "Like noticing a house far away from everyone else on a map of a city.",
    goodFor: "Good when 'unusual' means 'isolated' rather than 'extreme value'.",
  },
  "One-Class SVM": {
    what: "Learns the shape of the 'normal' region, then flags anything outside the boundary.",
    example: "Like drawing a fence around the usual area — anything on the other side is flagged.",
    goodFor: "Good when the normal data forms a clear shape.",
  },
};

const DEFAULT_DETECTORS = ["Isolation Forest"];

export function AnomalyConfigStep({ inspection, onStart }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [selected, setSelected] = useState(DEFAULT_DETECTORS);
  const [contamination, setContamination] = useState(0.05);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/anomaly/meta`)
      .then((r) => r.json())
      .then((m) => {
        setMeta(m);
        setSelected(Object.keys(m.detectors || {}).slice(0, 1));
      })
      .catch((e) => setMetaError(String(e)));
  }, []);

  useEffect(() => {
    if (!inspection) return;
    const numeric = (inspection.columns || [])
      .filter((c) => c.type === "numeric")
      .map((c) => c.name);
    if (numeric.length === 0) {
      setColumns((inspection.columns || []).slice(0, 6).map((c) => c.name));
    } else {
      setColumns(numeric);
    }
  }, [inspection]);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const toggleColumn = (name) =>
    setColumns((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]));

  const columnsForSelection = useMemo(
    () => (inspection?.columns || []).filter((c) => c.type === "numeric" || c.type === "categorical"),
    [inspection],
  );

  const canStart = selected.length > 0 && columns.length > 0;

  const contaminationPct = Math.round(contamination * 100);

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/15 text-amber">
            <ScanSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Scan for unusual rows</h2>
            <p className="text-xs text-muted-foreground">
              SmartML will hunt for the rows that don't fit the pattern
            </p>
          </div>
        </div>
        {meta && (
          <span className="glass-panel rounded-full px-3 py-1.5 text-[11px] text-muted-foreground">
            {meta.note ?? `${meta.max_rows.toLocaleString()} row cap (free tier)`}
          </span>
        )}
      </div>

      {/* What is anomaly detection — plain language */}
      <div className="glass-panel flex items-start gap-3 rounded-2xl border border-amber/25 bg-amber/5 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/15 text-amber">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">What's happening here?</span>{" "}
          Most rows follow a pattern. Occasionally a few don't — a suspiciously large order, a typo,
          a sensor glitch. SmartML learns what "normal" looks like from your data, then flags the rows
          that stand out. You decide how sensitive the scan should be.
        </div>
      </div>

      {metaError && (
        <div className="glass-panel flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <div>
            <div className="font-semibold text-amber">Couldn't load the list of detectors</div>
            <div className="mt-0.5 text-muted-foreground">{metaError}</div>
          </div>
        </div>
      )}

      {!meta && !metaError && (
        <div className="glass-panel flex items-center gap-3 rounded-xl p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading available detectors…
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: detectors + sensitivity */}
        <div className="space-y-6 lg:col-span-2">
          {/* Detectors */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Ways to look</div>
                <div className="text-xs text-muted-foreground">
                  Each is a different "strategy". Pick 1-2 and compare — they often agree.
                </div>
              </div>
              <button
                onClick={() => setSelected(Object.keys(meta?.detectors || {}))}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Try all
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(meta?.detectors ? Object.entries(meta.detectors) : [["Isolation Forest", {}]]).map(([name, info], i) => {
                const accent = DETECTOR_ACCENTS[name] || "amber";
                const isOn = selected.includes(name);
                const plain = DETECTOR_PLAIN[name];
                return (
                  <button
                    key={name}
                    onClick={() => toggle(name)}
                    className={`glass-panel interactive-card relative overflow-hidden rounded-xl border p-4 text-left transition-all animate-fade-in-up stagger-${(i % 6) + 1} ${
                      isOn ? `${ACCENT_BORDER[accent]} ${ACCENT_BG[accent]}` : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{name}</div>
                      {isOn
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4 text-muted-foreground/50" />}
                    </div>
                    {plain ? (
                      <>
                        <div className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {plain.what}
                        </div>
                        <div className="mt-1.5 text-[11px] italic leading-relaxed text-muted-foreground/80">
                          Think of it like {plain.example}
                        </div>
                        <div className={`mt-2 text-[10px] font-medium leading-relaxed ${ACCENT_TEXT[accent]}`}>
                          {plain.goodFor}
                        </div>
                      </>
                    ) : (
                      <div className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {info.description}
                      </div>
                    )}
                    {info.max_rows && (
                      <div className="mt-2 text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        Handles up to {info.max_rows.toLocaleString()} rows
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sensitivity */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">How sensitive should the scan be?</div>
                <div className="text-xs text-muted-foreground">
                  Roughly how many rows you expect to be unusual (out of 100)
                </div>
              </div>
              <span className="glass-panel rounded-xl px-3 py-1.5 font-mono text-lg font-bold text-amber">
                ~{contaminationPct}%
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={contaminationPct}
              onChange={(e) => setContamination(Number(e.target.value) / 100)}
              className="w-full accent-amber"
            />
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>1% (only extreme oddballs)</span><span>20% (cast a wide net)</span>
            </div>
            <div className="mt-3 rounded-lg border border-amber/20 bg-amber/10 p-2.5 text-[11px] text-muted-foreground">
              Tip: start at 5%. If too many normal rows get flagged, lower it. If you see obvious
              problems being missed, raise it.
            </div>
          </div>

          {/* Column picker */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">What to judge rows on?</div>
                <div className="text-xs text-muted-foreground">
                  These columns are used to decide if a row is unusual. Pick the ones that matter.
                </div>
              </div>
              <span className="rounded-full border border-border/60 bg-card/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                {columns.length} chosen
              </span>
            </div>
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {columnsForSelection.map((c) => {
                const isOn = columns.includes(c.name);
                return (
                  <button
                    key={c.name}
                    onClick={() => toggleColumn(c.name)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                      isOn
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border/60 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
              {columnsForSelection.length === 0 && (
                <div className="py-2 text-xs text-muted-foreground">
                  No usable columns found — your data may be all IDs or dates.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: summary + action */}
        <div className="lg:col-span-1">
          <div className="glass-panel glow-border rounded-2xl p-5 lg:sticky lg:top-24">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/15 text-amber">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Ready to scan</div>
                <div className="text-[11px] text-muted-foreground">Sensible defaults pre-selected</div>
              </div>
            </div>

            <div className="mb-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Detectors</span>
                <span className="font-mono text-foreground">{selected.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sensitivity</span>
                <span className="font-mono text-foreground">~{contaminationPct}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Columns judged</span>
                <span className="font-mono text-foreground">{columns.length}</span></div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5 text-cyan" /> What you'll get
              </div>
              Which rows are flagged, why they stand out, and a plain-English read on how unusual
              they really are.
            </div>

            <button
              disabled={!canStart}
              onClick={() => onStart({ detectors: selected, contamination, columns })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find unusual rows <ChevronRight className="h-4 w-4" />
            </button>
            {!canStart && (
              <div className="mt-2 text-center text-[10.5px] text-amber">
                Pick at least one detector and one column
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
