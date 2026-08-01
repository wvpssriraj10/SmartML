import { createFileRoute, useSearch } from "@tanstack/react-router";
import { AiInsightsStep } from "@/components/smartml/AiInsightsStep";

export const Route = createFileRoute("/ai-insights")({
  component: AiInsightsRouteComponent,
});

function AiInsightsRouteComponent() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId;

  return <AiInsightsStep datasetId={datasetId} />;
}
