import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const PreviewStep = lazy(() => import("@/components/smartml/PreviewStep").then((m) => ({ default: m.PreviewStep })));

export const Route = createFileRoute("/preview")({
  component: PreviewRouteComponent,
});

function PreviewRouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <PreviewStep
        datasetId={datasetId}
        onNavigateToCleaning={(id) => navigate({ to: "/cleaning", search: { datasetId: id } })}
      />
    </Suspense>
  );
}
