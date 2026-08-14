import { createFileRoute, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const AiInsightsStep = lazy(() => import("@/components/smartml/AiInsightsStep").then((m) => ({ default: m.AiInsightsStep })));

export const Route = createFileRoute("/ai-insights")({
  component: AiInsightsRouteComponent,
});

function AiInsightsRouteComponent() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <AiInsightsStep datasetId={datasetId} />
    </Suspense>
  );
}
