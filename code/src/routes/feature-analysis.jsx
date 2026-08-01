import { createFileRoute, useSearch } from "@tanstack/react-router";
import { FeatureAnalysisStep } from "@/components/smartml/FeatureAnalysisStep";

export const Route = createFileRoute("/feature-analysis")({
  component: FeatureAnalysisRouteComponent,
});

function FeatureAnalysisRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId;

  return <FeatureAnalysisStep datasetId={datasetId} />;
}
