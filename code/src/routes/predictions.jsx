import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { PredictionsStep } from "@/components/smartml/PredictionsStep";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/predictions")({
  component: PredictionsRouteComponent,
});

function PredictionsRouteComponent() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <PredictionsStep
      datasetId={datasetId}
      onNavigateToHome={() => navigate({ to: "/" })}
    />
  );
}
