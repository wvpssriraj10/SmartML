import time
import json
import os
import joblib
import re
import numpy as np
import pandas as pd
from .preprocessing import DatasetInspector, Preprocessor
from .models import MODEL_REGISTRY, get_smart_models, train_model
from .metrics import compute_classification_metrics, compute_regression_metrics, rank_models

# Cap rows used for training. Free-tier hosts (512 MB) cannot hold huge datasets
# plus every fitted model in memory. Inspect the full file; train on a sample.
MAX_TRAIN_ROWS = 15000


def _subsample_for_training(df, target_column, limit=MAX_TRAIN_ROWS):
    if len(df) <= limit:
        return df, None
    classes = df[target_column] if target_column in df.columns else None
    if classes is not None and classes.nunique() <= 100:
        try:
            per_class = max(1, limit // max(classes.nunique(), 1))
            sample = pd.concat([
                g.sample(min(len(g), per_class), random_state=42)
                for _, g in df.groupby(target_column)
            ])
            if len(sample) > limit:
                sample = sample.sample(n=limit, random_state=42)
            return sample.reset_index(drop=True), len(df)
        except Exception:
            pass
    sample = df.sample(n=min(limit, len(df)), random_state=42)
    return sample.reset_index(drop=True), len(df)


def convert(obj):
    if isinstance(obj, dict):
        return {k: convert(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


class Trainer:
    def __init__(self, file_path, target_column, problem_type=None, model_selection='auto', selected_models=None,
                 progress_callback=None, artifact_dir=None):
        self.file_path = file_path
        self.target_column = target_column
        self.problem_type = problem_type
        self.model_selection = model_selection
        self.selected_models = selected_models
        self.results = []
        self.data_report = {}
        self.inference_time = {}
        self.progress_callback = progress_callback
        self.artifact_dir = artifact_dir
        self.trained_models = {}
        self.preprocessor = None
        self.artifact_path = None

    def _report(self, message, completed=0, total=0, model=None, level='info'):
        if self.progress_callback:
            self.progress_callback({
                'message': message,
                'completed': completed,
                'total': total,
                'percent': round((completed / total) * 100) if total else 0,
                'model': model,
                'level': level,
            })

    def run(self):
        inspector = DatasetInspector(self.file_path)
        inspector.load()
        self.data_report['inspection'] = inspector.inspect()

        raw_df = inspector.df.copy()
        training_df, subsampled_from = _subsample_for_training(raw_df, self.target_column)
        if subsampled_from:
            self.data_report['dataset_subsampled'] = {
                'original_rows': subsampled_from,
                'training_rows': len(training_df),
                'note': 'Dataset larger than the free-tier training limit; inspecting all rows but training on a stratified sample.'
            }

        preprocessor = Preprocessor(training_df, self.target_column, self.problem_type)
        preprocessor.clean()
        if preprocessor.problem_type is None:
            preprocessor.detect_problem_type()
        self.problem_type = preprocessor.problem_type
        self.data_report['problem_type'] = self.problem_type

        data = preprocessor.preprocess()
        self.preprocessor = preprocessor

        self.data_report['dataset_shape'] = {
            'X_train': data['X_train'].shape,
            'X_test': data['X_test'].shape,
            'features': len(data['feature_names'])
        }
        if data.get('target_classes'):
            self.data_report['target_classes'] = data['target_classes']
            self.data_report['num_classes'] = data['num_classes']

        data_profile = {
            'problem_type': self.problem_type,
            'n_rows': self.data_report['inspection']['rows'],
            'n_features': len(data['feature_names']),
            'n_classes': data.get('num_classes', 2)
        }

        if self.model_selection == 'smart':
            models_dict = get_smart_models(data_profile)
            self.data_report['model_selection_strategy'] = 'smart_auto_pick'
        elif self.model_selection == 'manual' and self.selected_models:
            available = MODEL_REGISTRY.get(self.problem_type, {})
            models_dict = {name: available[name] for name in self.selected_models if name in available}
            self.data_report['model_selection_strategy'] = 'user_selected'
        else:
            # Limit "all models" mode to top 4 from smart priority to fit 512 MB RAM
            smart_models = get_smart_models(data_profile)
            limited_keys = list(smart_models.keys())[:4]
            models_dict = {name: available[name] for name in limited_keys if name in available}
            self.data_report['model_selection_strategy'] = 'all_models_limited'

        self.data_report['models_trained'] = list(models_dict.keys())
        total = len(models_dict)
        X_train, X_test, y_train, y_test = data['X_train'].values, data['X_test'].values, data['y_train'], data['y_test']

        for idx, (name, info) in enumerate(models_dict.items()):
            start = time.time()
            try:
                self._report(f'Training {name}…', idx, total, name)
                result = train_model(info, X_train, y_train, name)
                y_pred = result['model'].predict(X_test)
                elapsed = round(time.time() - start, 3)

                if self.problem_type == 'classification':
                    y_prob = None
                    if hasattr(result['model'], 'predict_proba'):
                        try:
                            y_prob = result['model'].predict_proba(X_test)
                        except:
                            pass
                    metrics = compute_classification_metrics(y_test, y_pred, y_prob)
                else:
                    metrics = compute_regression_metrics(y_test, y_pred)

                self.results.append({
                    'model_name': name,
                    'metrics': metrics,
                    'training_time': result['training_time'],
                    'total_time': elapsed,
                    'status': 'completed'
                })
                self.trained_models[name] = result['model']
                self._persist_model_artifact(name, result['model'])
                # Keep peak memory low on constrained hosts: only retain the best so far.
                self._prune_models()
                self._report(f'{name} completed.', idx + 1, total, name, 'success')
            except Exception as e:
                self.results.append({
                    'model_name': name,
                    'metrics': {},
                    'training_time': 0,
                    'total_time': 0,
                    'status': 'failed',
                    'error': str(e)
                })
                self._report(f'{name} failed: {str(e)}', idx + 1, total, name, 'error')

        self.results = rank_models(self.results, self.problem_type)
        self._save_best_artifact()

        return self.summarize()

    def _persist_model_artifact(self, name, model):
        if not self.artifact_dir or not self.preprocessor:
            return
        try:
            os.makedirs(self.artifact_dir, exist_ok=True)
            os.makedirs(os.path.join(self.artifact_dir, 'models'), exist_ok=True)
            safe_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
            joblib.dump(self.preprocessor.export_artifact(model), os.path.join(self.artifact_dir, 'models', f'{safe_name}.joblib'))
        except Exception:
            pass

    def _prune_models(self):
        """Keep only the current best model in memory to cap RAM usage."""
        if not self.results:
            return
        ranked = rank_models(list(self.results), self.problem_type)
        best_name = ranked[0]['model_name'] if ranked else None
        for name in list(self.trained_models.keys()):
            if name != best_name:
                del self.trained_models[name]

    def _save_best_artifact(self):
        """Persist the winning estimator at a predictable top-level path."""
        completed = next((r for r in self.results if r['status'] == 'completed'), None)
        if not completed or not self.artifact_dir or not self.preprocessor:
            return
        model = self.trained_models.get(completed['model_name'])
        if model is None:
            return
        os.makedirs(self.artifact_dir, exist_ok=True)
        joblib.dump(self.preprocessor.export_artifact(model), os.path.join(self.artifact_dir, 'model.joblib'))
        self.artifact_path = self.artifact_dir
        # Free the winner too once serialized; results carry everything the UI needs.
        self.trained_models.clear()

    def summarize(self):
        best = self.results[0] if self.results else None
        return convert({
            'data_report': self.data_report,
            'results': self.results,
            'best_model': {
                'name': best['model_name'] if best else None,
                'metrics': best['metrics'] if best else {},
                'why': self._generate_explanation(best) if best else None
            } if best else None,
            'total_models_trained': len(self.results),
            'successful': sum(1 for r in self.results if r['status'] == 'completed'),
            'failed': sum(1 for r in self.results if r['status'] == 'failed'),
            'artifact_path': self.artifact_path
        })

    def _generate_explanation(self, best):
        name = best['model_name']
        metrics = best['metrics']
        lines = [f"{name} performed best on your dataset."]
        if 'f1_score' in metrics:
            lines.append(f"It achieved an F1 score of {metrics['f1_score']}.")
        if 'accuracy' in metrics:
            lines.append(f"Accuracy: {metrics['accuracy']}.")
        if 'r2_score' in metrics:
            lines.append(f"R2 Score: {metrics['r2_score']}.")
        lines.append(f"Training took {best['training_time']} seconds.")
        return ' '.join(lines)

    def get_model_results(self, model_name):
        for r in self.results:
            if r['model_name'] == model_name:
                return r
        return None
