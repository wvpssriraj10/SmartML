import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UploadLibraryStep } from "@/components/smartml/UploadLibraryStep";
import { setActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/uploads")({
  component: UploadsRouteComponent,
});

function UploadsRouteComponent() {
  const navigate = useNavigate();

  const handleActivate = (id) => {
    setActiveDataset(id);
    navigate({ to: "/cleaning", search: { datasetId: id } });
  };

  const handleSelectDataset = (id, target) => {
    setActiveDataset(id);
    navigate({ to: "/preview", search: { datasetId: id } });
  };

  return (
    <UploadLibraryStep
      libraryOnly
      onUploadSuccess={(data) => {
        const id = data.job_id || data.dataset_id;
        if (id) handleActivate(id);
      }}
      onSelectDataset={handleSelectDataset}
      onActivateDataset={handleActivate}
      onNavigateToCleaning={(id) => {
        setActiveDataset(id);
        navigate({ to: "/cleaning", search: { datasetId: id } });
      }}
      onNavigateToVisualization={(id) => {
        setActiveDataset(id);
        navigate({ to: "/visualization", search: { datasetId: id } });
      }}
    />
  );
}