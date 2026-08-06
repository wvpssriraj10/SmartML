import { Sparkles, Plus, Wifi, FolderUp, Table, Sparkle, BarChart3, SlidersHorizontal, Brain, TrendingUp, Home, Database } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

export function Navbar({ onNewSession, connected = true, activeDatasetId }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const datasetParam = activeDatasetId ? `?datasetId=${activeDatasetId}` : '';

  const alwaysItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Uploads", href: "/uploads", icon: Database },
  ];

  const datasetItems = activeDatasetId ? [
    { label: "Cleaning", href: `/cleaning${datasetParam}`, icon: SlidersHorizontal },
    { label: "Visualization", href: `/visualization${datasetParam}`, icon: BarChart3 },
    { label: "Feature Analysis", href: `/feature-analysis${datasetParam}`, icon: Sparkle },
    { label: "AI Insights", href: `/ai-insights${datasetParam}`, icon: Brain },
    { label: "Predictions", href: `/predictions${datasetParam}`, icon: TrendingUp },
  ] : [];

  const navItems = [...alwaysItems, ...datasetItems];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/80">
      <div className="mx-auto flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--glow-primary)]">
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
        </div>

        {/* Central Multi-Route Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1 rounded-full border border-border/60 bg-card/40 p-1 backdrop-blur-md">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.href.split('?')[0];
            return (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs md:flex">
            <span className={`relative flex h-2 w-2`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${connected ? "bg-emerald animate-ping" : "bg-amber"} opacity-60`} />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald" : "bg-amber"}`} />
            </span>
            <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{connected ? "Connected" : "Connecting…"}</span>
          </div>

          <button
            onClick={onNewSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        </div>
      </div>
    </header>
  );
}

