import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const CleaningStep = lazy(() => import("@/components/smartml/CleaningStep").then((m) => ({ default: m.CleaningStep })));

export const Route = createFileRoute("/cleaning")({
  component: CleaningRouteComponent,
});

function CleaningRouteComponent() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <CleaningStep
        datasetId={datasetId}
        onNavigateToPreview={(id) => navigate({ to: "/preview", search: { datasetId: id } })}
      />
    </Suspense>
  );
}
