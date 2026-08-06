import { createFileRoute, useSearch } from "@tanstack/react-router";
import { AiInsightsStep } from "@/components/smartml/AiInsightsStep";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/ai-insights")({
  component: AiInsightsRouteComponent,
});

function AiInsightsRouteComponent() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return <AiInsightsStep datasetId={datasetId} />;
}
