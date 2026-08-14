import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { setActiveDataset } from "@/lib/active-dataset";

const UploadLibraryStep = lazy(() => import("@/components/smartml/UploadLibraryStep").then((m) => ({ default: m.UploadLibraryStep })));

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
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
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
    </Suspense>
  );
}