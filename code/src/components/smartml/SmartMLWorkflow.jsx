import { lazy, Suspense } from "react";

import { AnalyzingStep } from "@/components/smartml/AnalyzingStep";
import { ModeSelector } from "@/components/smartml/ModeSelector";
import { UploadStep } from "@/components/smartml/UploadStep";
import { WorkflowStepper } from "@/components/smartml/WorkflowStepper";
import { STEPS_FOR } from "@/lib/smartml-constants";

const InspectionStep = lazy(() => import("@/components/smartml/InspectionStep").then((m) => ({ default: m.InspectionStep })));
const TrainingStep = lazy(() => import("@/components/smartml/TrainingStep").then((m) => ({ default: m.TrainingStep })));
const ResultsStep = lazy(() => import("@/components/smartml/ResultsStep").then((m) => ({ default: m.ResultsStep })));
const CleaningStep = lazy(() => import("@/components/smartml/CleaningStep").then((m) => ({ default: m.CleaningStep })));
const VisualizationStep = lazy(() => import("@/components/smartml/VisualizationStep").then((m) => ({ default: m.VisualizationStep })));
const ExportStep = lazy(() => import("@/components/smartml/ExportStep").then((m) => ({ default: m.ExportStep })));
const ClusterConfigStep = lazy(() => import("@/components/smartml/ClusterConfigStep").then((m) => ({ default: m.ClusterConfigStep })));
const ClusterTrainStep = lazy(() => import("@/components/smartml/ClusterTrainStep").then((m) => ({ default: m.ClusterTrainStep })));
const ClusterResultsStep = lazy(() => import("@/components/smartml/ClusterResultsStep").then((m) => ({ default: m.ClusterResultsStep })));
const ClusterExportStep = lazy(() => import("@/components/smartml/ClusterExportStep").then((m) => ({ default: m.ClusterExportStep })));
const ClusterVisualizeStep = lazy(() => import("@/components/smartml/ClusterVisualizeStep").then((m) => ({ default: m.ClusterVisualizeStep })));
const AnomalyConfigStep = lazy(() => import("@/components/smartml/AnomalyConfigStep").then((m) => ({ default: m.AnomalyConfigStep })));
const AnomalyTrainStep = lazy(() => import("@/components/smartml/AnomalyTrainStep").then((m) => ({ default: m.AnomalyTrainStep })));
const AnomalyResultsStep = lazy(() => import("@/components/smartml/AnomalyResultsStep").then((m) => ({ default: m.AnomalyResultsStep })));
const AnomalyVisualizeStep = lazy(() => import("@/components/smartml/AnomalyVisualizeStep").then((m) => ({ default: m.AnomalyVisualizeStep })));
const AnomalyExportStep = lazy(() => import("@/components/smartml/AnomalyExportStep").then((m) => ({ default: m.AnomalyExportStep })));

export function SmartMLWorkflow({
  step,
  setStep,
  mode,
  onModeChange,
  file,
  jobId,
  analysisReady,
  inspection,
  trainCfg,
  results,
  backendResults,
  trainingStatus,
  trainingProgress,
  trainingLogs,
  modelStates,
  trainingElapsed,
  recentJobs,
  clusterCfg,
  clusterResults,
  clusterLogs,
  clusterAlgoStates,
  clusterStatus,
  clusterProgress,
  clusterElapsed,
  anomalyCfg,
  anomalyResults,
  anomalyLogs,
  anomalyAlgoStates,
  anomalyStatus,
  anomalyProgress,
  anomalyElapsed,
  resolvedProblem,
  onUploaded,
  onAnalyzed,
  onCleaningDone,
  onStartTraining,
  onResultsDone,
  onVisualizationDone,
  onNewSession,
  onResumeJob,
  onDownload,
  onStartClustering,
  onDownloadClusters,
  onStartAnomaly,
  onDownloadAnomaly,
}) {
  const STEPS = STEPS_FOR[mode] || STEPS_FOR.predict;

  return (
    <>
      {step === "mode" && <ModeSelector mode={mode} onChange={onModeChange} />}

      {step !== "upload" && step !== "mode" && (
        <WorkflowStepper steps={STEPS} currentKey={step} />
      )}

      <Suspense fallback={<div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>}>
        {step === "upload" && <UploadStep onUploaded={onUploaded} onResumeJob={onResumeJob} recentJobs={recentJobs} />}
        {step === "analyzing" && <AnalyzingStep fileName={file?.name ?? "dataset"} ready={analysisReady} onDone={onAnalyzed} />}
        {step === "cleaning" && jobId && (
          <CleaningStep datasetId={jobId} onNavigateToPreview={onCleaningDone} />
        )}
        {step === "inspection" && inspection && (
          <InspectionStep inspection={inspection} onStartTraining={onStartTraining} />
        )}
        {step === "training" && (
          <TrainingStep
            target={trainCfg?.target}
            problemType={trainCfg?.problemType}
            status={trainingStatus}
            progress={trainingProgress}
            elapsed={trainingElapsed}
            logs={trainingLogs}
            models={modelStates}
          />
        )}
        {step === "cluster-config" && inspection && (
          <ClusterConfigStep inspection={inspection} onStart={onStartClustering} />
        )}
        {step === "cluster-train" && (
          <ClusterTrainStep
            algorithms={clusterCfg?.algorithms || []}
            status={clusterStatus}
            progress={clusterProgress}
            elapsed={clusterElapsed}
            logs={clusterLogs}
            modelStates={clusterAlgoStates}
          />
        )}
        {step === "cluster-results" && clusterResults && (
          <ClusterResultsStep
            results={clusterResults}
            summary={clusterResults.summary}
            onNewSession={onNewSession}
            onDownload={onDownloadClusters}
            onContinue={() => setStep("cluster-visualize")}
          />
        )}
        {step === "cluster-visualize" && clusterResults && (
          <ClusterVisualizeStep
            results={clusterResults}
            inspection={inspection}
            onBack={() => setStep("cluster-results")}
            onDone={() => setStep("cluster-export")}
          />
        )}
        {step === "cluster-export" && clusterResults && (
          <ClusterExportStep
            results={clusterResults}
            summary={clusterResults.summary}
            onNewSession={onNewSession}
            onDownload={onDownloadClusters}
            onBack={() => setStep("cluster-visualize")}
          />
        )}
        {step === "anomaly-config" && inspection && (
          <AnomalyConfigStep inspection={inspection} onStart={onStartAnomaly} />
        )}
        {step === "anomaly-train" && (
          <AnomalyTrainStep
            detectors={anomalyCfg?.detectors || []}
            status={anomalyStatus}
            progress={anomalyProgress}
            elapsed={anomalyElapsed}
            logs={anomalyLogs}
            modelStates={anomalyAlgoStates}
          />
        )}
        {step === "anomaly-results" && anomalyResults && (
          <AnomalyResultsStep
            results={anomalyResults.results || []}
            summary={anomalyResults.summary}
            onNewSession={onNewSession}
            onDownload={onDownloadAnomaly}
            onContinue={() => setStep("anomaly-visualize")}
          />
        )}
        {step === "anomaly-visualize" && anomalyResults && (
          <AnomalyVisualizeStep
            results={anomalyResults.results || []}
            onBack={() => setStep("anomaly-results")}
            onDone={() => setStep("anomaly-export")}
          />
        )}
        {step === "anomaly-export" && anomalyResults && (
          <AnomalyExportStep
            results={anomalyResults.results || []}
            summary={anomalyResults.summary}
            onNewSession={onNewSession}
            onDownload={onDownloadAnomaly}
            onBack={() => setStep("anomaly-visualize")}
          />
        )}
        {step === "results" && results && inspection && backendResults && (
          <ResultsStep
            results={results}
            problemType={backendResults.problem_type || resolvedProblem}
            columns={inspection.columns}
            target={trainCfg?.target}
            onNewSession={onNewSession}
            onDownload={onDownload}
            onContinue={onResultsDone}
          />
        )}
        {step === "visualization" && jobId && (
          <VisualizationStep datasetId={jobId} onDone={onVisualizationDone} />
        )}
        {step === "export" && jobId && results && inspection && backendResults && (
          <ExportStep
            jobId={jobId}
            results={results}
            inspection={inspection}
            backendResults={backendResults}
            trainCfg={trainCfg}
            onNewSession={onNewSession}
          />
        )}
      </Suspense>
    </>
  );
}