import threading
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ml_engine.trainer import Trainer
from .database import update_job, append_job_log, is_cancelled


class TrainingCancelled(Exception):
    """Raised inside a worker when the user requests cancellation."""


def _check_cancelled(job_id):
    if is_cancelled(job_id):
        raise TrainingCancelled(job_id)


def _run_training(job_id, file_path, target_column, problem_type, model_selection, selected_models):
    try:
        update_job(job_id, status='running', progress=json.dumps({'completed': 0, 'total': 0, 'percent': 0}))
        append_job_log(job_id, 'Training worker started.')

        def report_progress(event):
            _check_cancelled(job_id)
            append_job_log(
                job_id,
                event['message'],
                event.get('level', 'info'),
                {
                    'completed': event.get('completed', 0),
                    'total': event.get('total', 0),
                    'percent': event.get('percent', 0),
                    'current_model': event.get('model'),
                }
            )

        trainer = Trainer(
            file_path=file_path,
            target_column=target_column,
            problem_type=problem_type,
            model_selection=model_selection,
            selected_models=selected_models,
            progress_callback=report_progress,
            artifact_dir=os.path.join(os.path.dirname(__file__), '..', 'artifacts', job_id)
        )

        summary = trainer.run()

        update_job(
            job_id,
            status='completed',
            results=json.dumps(summary['results'], indent=2),
            data_report=json.dumps(summary.get('data_report', {}), indent=2),
            inspection=json.dumps(summary.get('data_report', {}).get('inspection', {}), indent=2),
            artifact_path=summary.get('artifact_path'),
            progress=json.dumps({'completed': summary.get('successful', 0), 'total': summary.get('total_models_trained', 0), 'percent': 100})
        )
        append_job_log(job_id, 'Training complete. Results ranked and artifact saved.', 'success')

        best = summary.get('best_model', {})
        if best:
            update_job(job_id, best_model_name=best.get('name'),
                       best_model_metrics=json.dumps(best.get('metrics', {})))

    except TrainingCancelled:
        update_job(job_id, status='cancelled', error='Training cancelled by user.')
        append_job_log(job_id, 'Training cancelled by user.', 'warning')

    except Exception as e:
        update_job(job_id, status='failed', error=str(e))
        append_job_log(job_id, f'Training failed: {str(e)}', 'error')


def start_training(job_id, file_path, target_column, problem_type=None, model_selection='smart', selected_models=None):
    thread = threading.Thread(
        target=_run_training,
        args=(job_id, file_path, target_column, problem_type, model_selection, selected_models),
        daemon=True
    )
    thread.start()
    return thread


def _run_clustering(job_id, file_path, algorithms, n_clusters, columns):
    try:
        update_job(job_id, status='running', progress=json.dumps({'completed': 0, 'total': 0, 'percent': 0}))
        append_job_log(job_id, 'Clustering worker started.')

        def report_progress(event):
            _check_cancelled(job_id)
            append_job_log(
                job_id,
                event['message'],
                event.get('level', 'info'),
                {
                    'completed': event.get('completed', 0),
                    'total': event.get('total', 0),
                    'percent': event.get('percent', 0),
                    'current_model': event.get('model'),
                }
            )

        from ml_engine.cluster_trainer import ClusterTrainer

        trainer = ClusterTrainer(
            file_path=file_path,
            algorithms=algorithms,
            n_clusters=n_clusters,
            columns=columns,
            progress_callback=report_progress,
        )

        summary = trainer.run()

        update_job(
            job_id,
            status='completed',
            cluster_results=json.dumps(summary, indent=2),
            results=None,
            data_report=None,
            artifact_path=None,
            progress=json.dumps({'completed': summary.get('summary', {}).get('algorithms_run', 0), 'total': summary.get('summary', {}).get('algorithms_run', 0), 'percent': 100})
        )
        append_job_log(job_id, 'Clustering complete. Results saved.', 'success')

    except TrainingCancelled:
        update_job(job_id, status='cancelled', error='Clustering cancelled by user.')
        append_job_log(job_id, 'Clustering cancelled by user.', 'warning')

    except Exception as e:
        update_job(job_id, status='failed', error=str(e))
        append_job_log(job_id, f'Clustering failed: {str(e)}', 'error')


def start_clustering(job_id, file_path, algorithms=None, n_clusters=5, columns=None):
    thread = threading.Thread(
        target=_run_clustering,
        args=(job_id, file_path, algorithms, n_clusters, columns),
        daemon=True
    )
    thread.start()
    return thread


def _run_anomaly(job_id, file_path, detectors, contamination, columns):
    try:
        update_job(job_id, status='running', progress=json.dumps({'completed': 0, 'total': 0, 'percent': 0}))
        append_job_log(job_id, 'Anomaly detection worker started.')

        def report_progress(event):
            _check_cancelled(job_id)
            append_job_log(
                job_id,
                event['message'],
                event.get('level', 'info'),
                {
                    'completed': event.get('completed', 0),
                    'total': event.get('total', 0),
                    'percent': event.get('percent', 0),
                    'current_model': event.get('model'),
                }
            )

        from ml_engine.anomaly_trainer import AnomalyTrainer

        trainer = AnomalyTrainer(
            file_path=file_path,
            detectors=detectors,
            contamination=contamination,
            columns=columns,
            progress_callback=report_progress,
        )

        summary = trainer.run()

        update_job(
            job_id,
            status='completed',
            anomaly_results=json.dumps(summary, indent=2),
            results=None,
            data_report=None,
            cluster_results=None,
            artifact_path=None,
            progress=json.dumps({'completed': summary.get('summary', {}).get('detectors_run', 0), 'total': summary.get('summary', {}).get('detectors_run', 0), 'percent': 100})
        )
        append_job_log(job_id, 'Anomaly detection complete. Results saved.', 'success')

    except TrainingCancelled:
        update_job(job_id, status='cancelled', error='Anomaly scan cancelled by user.')
        append_job_log(job_id, 'Anomaly scan cancelled by user.', 'warning')

    except Exception as e:
        update_job(job_id, status='failed', error=str(e))
        append_job_log(job_id, f'Anomaly detection failed: {str(e)}', 'error')


def start_anomaly(job_id, file_path, detectors=None, contamination=0.05, columns=None):
    thread = threading.Thread(
        target=_run_anomaly,
        args=(job_id, file_path, detectors, contamination, columns),
        daemon=True
    )
    thread.start()
    return thread
