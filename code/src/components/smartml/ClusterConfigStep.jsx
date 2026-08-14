import { useEffect, useMemo, useState } from "react";
import {
  GitBranch, Loader2, CircleAlert, Sparkles, Info, ChevronRight, CheckSquare, Square, Lightbulb,
} from "lucide-react";
import { API_BASE } from "@/api";

const ALGO_ACCENTS = {
  "K-Means": "violet",
  "PCA": "cyan",
  "Agglomerative": "amber",
  "Gaussian Mixture": "emerald",
};

const ACCENT_TEXT = { violet: "text-violet", cyan: "text-cyan", amber: "text-amber", emerald: "text-emerald" };
const ACCENT_BG = { violet: "bg-violet/15", cyan: "bg-cyan/15", amber: "bg-amber/15", emerald: "bg-emerald/15" };
const ACCENT_BORDER = { violet: "border-violet/40", cyan: "border-cyan/40", amber: "border-amber/40", emerald: "border-emerald/40" };

// Plain-language explanations so non-experts can pick without knowing ML.
const ALGO_PLAIN = {
  "K-Means": {
    what: "Groups rows into a set number of even-ish groups by how similar they are.",
    example: "Like sorting your music into a few playlists — every song lands in exactly one.",
    goodFor: "Best first choice. Fast and easy to understand.",
  },
  "PCA": {
    what: "First shrinks your data down to its two most important dimensions, then groups the points there.",
    example: "Like squashing a map onto a single page so you can see where the towns cluster.",
    goodFor: "Great for a first look — fast, and reveals the biggest differences in your data.",
  },
  "Agglomerative": {
    what: "Starts with every row as its own group, then merges the most similar ones step by step.",
    example: "Like a family tree of similarity — you pick the level to cut it.",
    goodFor: "Good for seeing how groups nest inside bigger groups.",
  },
  "Gaussian Mixture": {
    what: "Soft groups — a row can belong partly to several groups.",
    example: "Like saying a customer is 60% shopper and 40% browser.",
    goodFor: "Good when boundaries are fuzzy.",
  },
};

const DEFAULT_ALGOS = ["K-Means", "PCA"];

export function ClusterConfigStep({ inspection, onStart }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [selected, setSelected] = useState(DEFAULT_ALGOS);
  const [nClusters, setNClusters] = useState(4);
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/cluster/meta`)
      .then((r) => r.json())
      .then((m) => {
        setMeta(m);
        setSelected(Object.keys(m.algorithms || {}).slice(0, 2));
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

  const canStart = selected.length > 0 && nClusters >= 2 && columns.length > 0;

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/15 text-violet">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Group your data</h2>
            <p className="text-xs text-muted-foreground">
              Three simple choices, then SmartML finds the groups for you
            </p>
          </div>
        </div>
        {meta && (
          <span className="glass-panel rounded-full px-3 py-1.5 text-[11px] text-muted-foreground">
            {meta.note ?? `${meta.max_rows.toLocaleString()} row cap (free tier)`}
          </span>
        )}
      </div>

      {/* What is clustering — plain language */}
      <div className="glass-panel flex items-start gap-3 rounded-2xl border border-violet/25 bg-violet/5 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">What's happening here?</span>{" "}
          SmartML will look at your data and sort the rows into groups of similar ones — no target
          column needed. Rows that are alike end up in the same group; rows that are very different
          end up apart. You don't need to know how the math works — just pick how many groups you'd
          like to look for and which method to try.
        </div>
      </div>

      {metaError && (
        <div className="glass-panel flex items-start gap-2.5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <div>
            <div className="font-semibold text-amber">Couldn't load the list of grouping methods</div>
            <div className="mt-0.5 text-muted-foreground">{metaError}</div>
          </div>
        </div>
      )}

      {!meta && !metaError && (
        <div className="glass-panel flex items-center gap-3 rounded-xl p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading available grouping methods…
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: algo + cluster count */}
        <div className="space-y-6 lg:col-span-2">
          {/* Algorithms → grouping methods */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Ways to group</div>
                <div className="text-xs text-muted-foreground">
                  Each is a different "strategy". Pick 2 and compare — they'll often agree.
                </div>
              </div>
              <button
                onClick={() => setSelected(Object.keys(meta?.algorithms || {}))}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Try all
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(meta?.algorithms ? Object.entries(meta.algorithms) : [["K-Means", {}], ["PCA", {}]]).map(([name, info], i) => {
                const accent = ALGO_ACCENTS[name] || "violet";
                const isOn = selected.includes(name);
                const plain = ALGO_PLAIN[name];
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

          {/* Cluster count */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">How many groups to look for?</div>
                <div className="text-xs text-muted-foreground">
                  Think: "if I had to sort these rows into buckets, how many buckets?"
                </div>
              </div>
              <span className="glass-panel rounded-xl px-3 py-1.5 font-mono text-lg font-bold text-violet">
                {nClusters}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={12}
              value={nClusters}
              onChange={(e) => setNClusters(Number(e.target.value))}
              className="w-full accent-violet"
            />
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>2 (fewer groups)</span><span>12 (more groups)</span>
            </div>
            <div className="mt-3 rounded-lg border border-violet/20 bg-violet/10 p-2.5 text-[11px] text-muted-foreground">
              Tip: start with a small number — 3 to 5 groups is usually enough to tell a story. You
              can always re-run with more if the groups look mushed together.
            </div>
          </div>

          {/* Column picker */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">What to compare rows on?</div>
                <div className="text-xs text-muted-foreground">
                  These columns are used to decide how similar two rows are. Pick the ones that
                  matter to you.
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet/15 text-violet">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Ready to explore</div>
                <div className="text-[11px] text-muted-foreground">Sensible defaults pre-selected</div>
              </div>
            </div>

            <div className="mb-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Grouping strategies</span>
                <span className="font-mono text-foreground">{selected.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Number of groups</span>
                <span className="font-mono text-foreground">{nClusters}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Columns compared</span>
                <span className="font-mono text-foreground">{columns.length}</span></div>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <Info className="h-3.5 w-3.5 text-cyan" /> What you'll get
              </div>
              A picture of your groups, which rows belong to which group, and a plain-English
              read on how well-separated the groups are.
            </div>

            <button
              disabled={!canStart}
              onClick={() => onStart({ algorithms: selected, n_clusters: nClusters, columns })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Find my groups <ChevronRight className="h-4 w-4" />
            </button>
            {!canStart && (
              <div className="mt-2 text-center text-[10.5px] text-amber">
                Pick at least one strategy, 2+ groups, and one column
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
