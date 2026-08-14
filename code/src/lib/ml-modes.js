import {
  Target,
  GitBranch,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  SlidersHorizontal,
  Cpu,
  BarChart3,
  LineChart,
  Package,
  ScanSearch,
} from "lucide-react";

export const ML_MODES = {
  predict: {
    id: "predict",
    label: "Predict a target",
    tagline: "Supervised learning",
    description:
      "Pick a column to predict and train the best model. Ideal when you have answers already labeled in the data.",
    icon: Target,
    accent: "emerald",
    steps: [
      { key: "upload", label: "Dataset" },
      { key: "cleaning", label: "Cleaning" },
      { key: "inspection", label: "Configure" },
      { key: "training", label: "Train" },
      { key: "results", label: "Results" },
      { key: "visualization", label: "Visualize" },
      { key: "export", label: "Export" },
    ],
  },
  explore: {
    id: "explore",
    label: "Explore patterns",
    tagline: "Unsupervised · Clustering",
    description:
      "No target needed. SmartML groups similar rows into clusters so you can discover segments, cohorts, and patterns.",
    icon: GitBranch,
    accent: "violet",
    steps: [
      { key: "upload", label: "Dataset" },
      { key: "cleaning", label: "Cleaning" },
      { key: "cluster-config", label: "Cluster settings" },
      { key: "cluster-train", label: "Cluster" },
      { key: "cluster-results", label: "Clusters" },
      { key: "cluster-visualize", label: "Compare" },
      { key: "cluster-export", label: "Export" },
    ],
  },
  detect: {
    id: "detect",
    label: "Detect anomalies",
    tagline: "Unsupervised · Outliers",
    description:
      "Find unusual rows that stand out — fraud, errors, or edge cases — before they break your analysis.",
    icon: AlertTriangle,
    accent: "amber",
    steps: [
      { key: "upload", label: "Dataset" },
      { key: "cleaning", label: "Cleaning" },
      { key: "anomaly-config", label: "Detector settings" },
      { key: "anomaly-train", label: "Scan" },
      { key: "anomaly-results", label: "Anomalies" },
      { key: "anomaly-visualize", label: "Inspect" },
      { key: "anomaly-export", label: "Export" },
    ],
  },
};

export const ACCENT_STYLES = {
  emerald: {
    text: "text-emerald",
    border: "border-emerald/40",
    bgSoft: "bg-emerald/10",
    bgHover: "hover:bg-emerald/10 hover:border-emerald/50",
    glow: "shadow-[0_0_24px_-8px_var(--color-emerald)]",
  },
  violet: {
    text: "text-violet",
    border: "border-violet/40",
    bgSoft: "bg-violet/10",
    bgHover: "hover:bg-violet/10 hover:border-violet/50",
    glow: "shadow-[0_0_24px_-8px_var(--color-violet)]",
  },
  amber: {
    text: "text-amber",
    border: "border-amber/40",
    bgSoft: "bg-amber/10",
    bgHover: "hover:bg-amber/10 hover:border-amber/50",
    glow: "shadow-[0_0_24px_-8px_var(--color-amber)]",
  },
};