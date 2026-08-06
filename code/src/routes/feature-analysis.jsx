import { createFileRoute, useSearch } from "@tanstack/react-router";
import { FeatureAnalysisStep } from "@/components/smartml/FeatureAnalysisStep";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/feature-analysis")({
  component: FeatureAnalysisRouteComponent,
});

function FeatureAnalysisRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return <FeatureAnalysisStep datasetId={datasetId} />;
}
