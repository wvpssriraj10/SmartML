import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset, setActiveDataset } from "@/lib/active-dataset";

const UploadLibraryStep = lazy(() => import("@/components/smartml/UploadLibraryStep").then((m) => ({ default: m.UploadLibraryStep })));

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
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
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
    </Suspense>
  );
}
