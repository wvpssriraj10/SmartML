import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { PreviewStep } from "@/components/smartml/PreviewStep";

export const Route = createFileRoute("/preview")({
  component: PreviewRouteComponent,
});

function PreviewRouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId;

  return (
    <PreviewStep
      datasetId={datasetId}
      onNavigateToCleaning={(id) => navigate({ to: "/cleaning", search: { datasetId: id } })}
    />
  );
}
