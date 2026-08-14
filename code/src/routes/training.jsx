import { createFileRoute, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getActiveDataset } from "@/lib/active-dataset";

const TrainingStepWithPoll = lazy(() => import("@/components/smartml/TrainingStepWithPoll").then((m) => ({ default: m.TrainingStepWithPoll })));

export const Route = createFileRoute("/training")({
  component: TrainingRouteComponent,
});

function TrainingRouteComponent() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
      <TrainingStepWithPoll datasetId={datasetId} />
    </Suspense>
  );
}