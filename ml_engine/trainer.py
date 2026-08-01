import time
import json
import os
import joblib
import re
import numpy as np
from .preprocessing import DatasetInspector, Preprocessor
from .models import MODEL_REGISTRY, get_smart_models, train_model
from .metrics import compute_classification_metrics, compute_regression_metrics, rank_models


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

        preprocessor = Preprocessor(inspector.df, self.target_column, self.problem_type)
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
            models_dict = MODEL_REGISTRY.get(self.problem_type, {})
            self.data_report['model_selection_strategy'] = 'all_models'

        self.data_report['models_trained'] = list(models_dict.keys())
        total = len(models_dict)
        X_train, X_test, y_train, y_test = data['X_train'].values, data['X_test'].values, data['y_train'], data['y_test']

        for idx, (name, info) in enumerate(models_dict.items()):
            start = time.time()
            try:
                self._report(f'Training {name}…', idx, total, name)
                result = train_model(info, X_train, y_train, name)
                self.trained_models[name] = result['model']
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

    def _save_best_artifact(self):
        """Persist the winning estimator and its fitted transformation state."""
        completed = next((r for r in self.results if r['status'] == 'completed'), None)
        if not completed or not self.artifact_dir or not self.preprocessor:
            return
        model = self.trained_models.get(completed['model_name'])
        if model is None:
            return
        os.makedirs(self.artifact_dir, exist_ok=True)
        os.makedirs(os.path.join(self.artifact_dir, 'models'), exist_ok=True)
        for name, trained_model in self.trained_models.items():
            safe_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
            joblib.dump(self.preprocessor.export_artifact(trained_model), os.path.join(self.artifact_dir, 'models', f'{safe_name}.joblib'))
        # Keep the winner at a predictable top-level path for simple deployments.
        joblib.dump(self.preprocessor.export_artifact(model), os.path.join(self.artifact_dir, 'model.joblib'))
        self.artifact_path = self.artifact_dir

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
