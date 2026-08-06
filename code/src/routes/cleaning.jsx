import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { CleaningStep } from "@/components/smartml/CleaningStep";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/cleaning")({
  component: CleaningRouteComponent,
});

function CleaningRouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <CleaningStep
      datasetId={datasetId}
      onNavigateToPreview={(id) => navigate({ to: "/preview", search: { datasetId: id } })}
    />
  );
}
