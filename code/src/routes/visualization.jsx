import { createFileRoute, useSearch } from "@tanstack/react-router";
import { VisualizationStep } from "@/components/smartml/VisualizationStep";

export const Route = createFileRoute("/visualization")({
  component: VisualizationRouteComponent,
});

function VisualizationRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId;

  return <VisualizationStep datasetId={datasetId} />;
}
