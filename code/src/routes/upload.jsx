import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UploadLibraryStep } from "@/components/smartml/UploadLibraryStep";
import { useState } from "react";

export const Route = createFileRoute("/upload")({
  component: UploadRouteComponent,
});

function UploadRouteComponent() {
  const navigate = useNavigate();
  const [activeDatasetId, setActiveDatasetId] = useState(null);

  const handleUploadSuccess = (data) => {
    const id = data.job_id || data.dataset_id;
    if (id) {
      setActiveDatasetId(id);
      navigate({ to: "/cleaning", search: { datasetId: id } });
    }
  };

  const handleSelectDataset = (id, target) => {
    setActiveDatasetId(id);
    if (target === 'preview') {
      navigate({ to: "/preview", search: { datasetId: id } });
    } else {
      navigate({ to: "/cleaning", search: { datasetId: id } });
    }
  };

  return (
    <UploadLibraryStep
      onUploadSuccess={handleUploadSuccess}
      onSelectDataset={handleSelectDataset}
      onNavigateToCleaning={(id) => navigate({ to: "/cleaning", search: { datasetId: id } })}
      onNavigateToVisualization={(id) => navigate({ to: "/visualization", search: { datasetId: id } })}
    />
  );
}
