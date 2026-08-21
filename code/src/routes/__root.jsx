import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { Navbar } from "@/components/smartml/Navbar";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import appCss from "../styles.css?url";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-panel rounded-2xl p-10">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md btn-gradient px-4 py-2 text-sm font-medium"
          >
            Back to SmartML
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }) {
  console.error(error);
  const router = useRouter();

  const message = error?.message || String(error || "Unknown error");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-panel rounded-2xl p-10">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try refreshing or head back home.</p>
        {message && (
          <p className="mt-3 break-words rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 font-mono text-xs text-rose">
            {message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md btn-gradient px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SmartML — AI-Powered AutoML Dashboard" },
      { name: "description", content: "Upload a dataset and train 10 ML models automatically. SmartML compares algorithms, picks a champion, and delivers deployable code." },
      { property: "og:title", content: "SmartML — AI-Powered AutoML Dashboard" },
      { property: "og:description", content: "AutoML with a beautiful workflow: upload, inspect, train, and ship the best model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function AppShell() {
  const { isAuthenticated, loading, reconnect } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Connecting to SmartML…</p>
          <button
            onClick={reconnect}
            className="mt-4 inline-flex items-center justify-center rounded-lg btn-gradient px-4 py-2 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthGate />
  );
}

function AuthGate() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId;

  // Clear stale active dataset on fresh app load
  useEffect(() => {
    try { localStorage.removeItem("smartml_active_dataset"); } catch {}
  }, []);

  return (
    <>
      <Navbar activeDatasetId={datasetId} />
      <main className="min-h-screen">
        <Outlet />
      </main>
    </>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}
