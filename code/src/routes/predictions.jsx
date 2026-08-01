import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { PredictionsStep } from "@/components/smartml/PredictionsStep";

export const Route = createFileRoute("/predictions")({
  component: PredictionsRouteComponent,
});

function PredictionsRouteComponent() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const datasetId = search.datasetId;

  return (
    <PredictionsStep
      datasetId={datasetId}
      onNavigateToHome={() => navigate({ to: "/" })}
    />
  );
}
