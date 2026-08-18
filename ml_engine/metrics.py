import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
    mean_squared_error, mean_absolute_error, r2_score
)


def compute_classification_metrics(y_true, y_pred, y_prob=None):
    metrics = {
        'accuracy': round(accuracy_score(y_true, y_pred), 4),
        'precision': round(precision_score(y_true, y_pred, average='weighted', zero_division=0), 4),
        'recall': round(recall_score(y_true, y_pred, average='weighted', zero_division=0), 4),
        'f1_score': round(f1_score(y_true, y_pred, average='weighted', zero_division=0), 4)
    }
    if y_prob is not None:
        try:
            if y_prob.shape[1] == 2:
                auc = roc_auc_score(y_true, y_prob[:, 1])
            else:
                auc = roc_auc_score(y_true, y_prob, multi_class='ovr')
            metrics['roc_auc'] = None if (auc is None or auc != auc) else round(auc, 4)
        except Exception:
            metrics['roc_auc'] = None
    return metrics


def compute_regression_metrics(y_true, y_pred):
    return {
        'mse': round(mean_squared_error(y_true, y_pred), 4),
        'rmse': round(np.sqrt(mean_squared_error(y_true, y_pred)), 4),
        'mae': round(mean_absolute_error(y_true, y_pred), 4),
        'r2_score': round(r2_score(y_true, y_pred), 4)
    }


def rank_models(results, problem_type):
    if problem_type == 'classification':
        results.sort(key=lambda x: x['metrics'].get('f1_score', 0), reverse=True)
    else:
        results.sort(key=lambda x: x['metrics'].get('r2_score', -999), reverse=True)
    for i, r in enumerate(results):
        r['rank'] = i + 1
    return results
