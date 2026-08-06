import { createFileRoute, useSearch } from "@tanstack/react-router";
import { VisualizationStep } from "@/components/smartml/VisualizationStep";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/visualization")({
  component: VisualizationRouteComponent,
});

function VisualizationRouteComponent() {
  const search    = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return <VisualizationStep datasetId={datasetId} />;
}
