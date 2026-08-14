import { createFileRoute, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const FeatureAnalysisStep = lazy(() => import("@/components/smartml/FeatureAnalysisStep").then((m) => ({ default: m.FeatureAnalysisStep })));

export const Route = createFileRoute("/feature-analysis")({
  component: FeatureAnalysisRouteComponent,
});

function FeatureAnalysisRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <FeatureAnalysisStep datasetId={datasetId} />
    </Suspense>
  );
}
