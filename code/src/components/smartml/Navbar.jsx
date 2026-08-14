import { useEffect, useRef, useState } from "react";
import { Sparkles, Plus, Wifi, Sparkle, BarChart3, SlidersHorizontal, Brain, TrendingUp, Lightbulb, Sun, Moon, RotateCcw } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

const THEME_KEY = "smartml_theme";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 450);
  }
  root.classList.toggle("light", theme === "light");
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

applyTheme(getInitialTheme());

export function Navbar({ onNewSession, connected = true, activeDatasetId }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [theme, setTheme] = useState(getInitialTheme);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (theme) applyTheme(theme, true);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const datasetParam = activeDatasetId ? `?datasetId=${activeDatasetId}` : '';

  const datasetItems = activeDatasetId ? [
    { label: "Cleaning", href: `/cleaning${datasetParam}`, icon: SlidersHorizontal },
    { label: "Visualization", href: `/visualization${datasetParam}`, icon: BarChart3 },
    { label: "Feature Analysis", href: `/feature-analysis${datasetParam}`, icon: Sparkle },
    { label: "Training", href: `/training${datasetParam}`, icon: Brain },
    { label: "AI Insights", href: `/ai-insights${datasetParam}`, icon: Lightbulb },
    { label: "Predictions", href: `/predictions${datasetParam}`, icon: TrendingUp },
  ] : [];

  const navItems = [...datasetItems];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/80 animate-fade-in-up">
      <div className="relative mx-auto flex h-16 items-center justify-between px-6">
        {/* Centered logo */}
        <Link to="/" className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 hover:opacity-90 transition-all duration-200 ease-expo">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)] animate-float">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-tight">
              Smart<span className="text-gradient">ML</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              AutoML & Analytics
            </span>
          </div>
        </Link>

        {/* Central Multi-Route Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1 rounded-full border border-border/60 bg-card/40 p-1 backdrop-blur-md animate-fade-in-up stagger-1">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = currentPath === item.href.split('?')[0];
            return (
              <Link
                key={item.label}
                to={item.href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ease-expo animate-fade-in-up ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-105"
                }`}
              >
                <Icon className="h-3.5 w-3.5 transition-transform duration-200 ease-expo group-hover:scale-110" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 animate-fade-in-up stagger-1">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-muted-foreground transition hover:text-foreground hover:bg-accent/60 hover:scale-105"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs md:flex interactive-card">
            <span className={`relative flex h-2 w-2`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${connected ? "bg-emerald animate-ping" : "bg-amber"} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald" : "bg-amber"}`} />
            </span>
            <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{connected ? "Connected" : "Connecting…"}</span>
          </div>

          <button
            onClick={() => window.dispatchEvent(new Event("smartml:new-session"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium btn-ghost"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New Session
          </button>
        </div>
      </div>
    </header>
  );
}

