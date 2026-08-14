import { createFileRoute, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const VisualizationStep = lazy(() => import("@/components/smartml/VisualizationStep").then((m) => ({ default: m.VisualizationStep })));

export const Route = createFileRoute("/visualization")({
  component: VisualizationRouteComponent,
});

function VisualizationRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <VisualizationStep datasetId={datasetId} />
    </Suspense>
  );
}
