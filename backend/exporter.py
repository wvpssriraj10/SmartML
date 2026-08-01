"""Create a deployable bundle for a persisted SmartML training artifact."""
import json


INFERENCE_TEMPLATE = '''#!/usr/bin/env python3
"""SmartML Dashboard inference entry point."""
import sys
import joblib
import pandas as pd

MODEL_NAME = {model_name!r}
PROBLEM_TYPE = {problem_type!r}
TRAINING_METRICS = {metrics}


def load_artifact(path="model.joblib"):
    return joblib.load(path)


def preprocess(df, artifact):
    df = df.copy()
    target = artifact["target_column"]
    if target in df:
        df = df.drop(columns=[target])
    output = pd.DataFrame(index=df.index)
    numeric = artifact["numeric_columns"]
    if numeric:
        raw = df.reindex(columns=numeric)
        imputed = artifact["imputer"].transform(raw)
        output[numeric] = artifact["scaler"].transform(imputed)
    for column in artifact["categorical_columns"]:
        values = df[column].astype(str).fillna("missing") if column in df else pd.Series("missing", index=df.index)
        encoder = artifact["encoders"][column]
        lookup = {{value: index for index, value in enumerate(encoder.classes_)}}
        output[column] = values.map(lookup).fillna(-1).astype(int)
    return output.reindex(columns=artifact["feature_names"], fill_value=0)


def predict(input_data, return_proba=False):
    if isinstance(input_data, dict):
        df = pd.DataFrame([input_data])
    elif isinstance(input_data, list):
        df = pd.DataFrame(input_data)
    else:
        df = input_data.copy()
    artifact = load_artifact()
    model = artifact["model"]
    features = preprocess(df, artifact)
    predictions = model.predict(features)
    if return_proba and PROBLEM_TYPE == "classification" and hasattr(model, "predict_proba"):
        return predictions, model.predict_proba(features)
    return predictions


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python inference.py input.csv")
    data = pd.read_csv(sys.argv[1])
    data["prediction"] = predict(data)
    data.to_csv("predictions.csv", index=False)
    print("Saved predictions.csv")
'''


def generate_inference_code(model_name: str, problem_type: str, metrics: dict) -> str:
    return INFERENCE_TEMPLATE.format(
        model_name=model_name,
        problem_type=problem_type,
        metrics=json.dumps(metrics, indent=2),
    )


def generate_requirements() -> str:
    return """pandas>=1.5.0
scikit-learn>=1.2.0
joblib>=1.2.0
xgboost>=1.7.0
lightgbm>=3.3.0
"""


def generate_readme(model_name: str, problem_type: str, metrics: dict) -> str:
    lines = '\n'.join(f'- **{key}**: {value}' for key, value in metrics.items())
    return f'''# SmartML Export — {model_name}

This folder includes the trained model and the fitted preprocessing state.

## Task

- Type: {problem_type}
- Model: {model_name}

## Metrics

{lines}

## Predict

```bash
pip install -r requirements.txt
python inference.py input.csv
```

Predictions are written to `predictions.csv`.
'''
