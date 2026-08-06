import { createFileRoute, useSearch } from "@tanstack/react-router";
import { TrainingStepWithPoll } from "@/components/smartml/TrainingStepWithPoll";
import { getActiveDataset } from "@/lib/active-dataset";

export const Route = createFileRoute("/training")({
  component: TrainingRouteComponent,
});

function TrainingRouteComponent() {
  const search = useSearch({ strict: false });
  const datasetId = search.datasetId || getActiveDataset();

  return (
    <TrainingStepWithPoll datasetId={datasetId} />
  );
}