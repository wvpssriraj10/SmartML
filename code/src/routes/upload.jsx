import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { UploadLibraryStep } from "@/components/smartml/UploadLibraryStep";
import { getActiveDataset, setActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/upload")({
  component: UploadRouteComponent,
});

function UploadRouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const activeDatasetId = search.datasetId || getActiveDataset();

  const activate = (id) => {
    setActiveDataset(id);
    navigate({ to: "/cleaning", search: { datasetId: id } });
  };

  const handleUploadSuccess = (data) => {
    const id = data.job_id || data.dataset_id;
    if (id) activate(id);
  };

  const handleSelectDataset = (id, target) => {
    setActiveDataset(id);
    navigate({ to: "/preview", search: { datasetId: id } });
  };

  return (
    <UploadLibraryStep
      onUploadSuccess={handleUploadSuccess}
      onSelectDataset={handleSelectDataset}
      onActivateDataset={activate}
      onNavigateToCleaning={(id) => activate(id)}
      onNavigateToVisualization={(id) => {
        setActiveDataset(id);
        navigate({ to: "/visualization", search: { datasetId: id } });
      }}
    />
  );
}
