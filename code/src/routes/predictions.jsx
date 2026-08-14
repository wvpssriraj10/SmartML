import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const PredictionsStep = lazy(() => import("@/components/smartml/PredictionsStep").then((m) => ({ default: m.PredictionsStep })));

export const Route = createFileRoute("/predictions")({
  component: PredictionsRouteComponent,
});

function PredictionsRouteComponent() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <PredictionsStep
        datasetId={datasetId}
        onNavigateToHome={() => navigate({ to: "/" })}
      />
    </Suspense>
  );
}
