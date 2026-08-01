import threading
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ml_engine.trainer import Trainer
from .database import update_job, append_job_log


def _run_training(job_id, file_path, target_column, problem_type, model_selection, selected_models):
    try:
        update_job(job_id, status='running', progress=json.dumps({'completed': 0, 'total': 0, 'percent': 0}))
        append_job_log(job_id, 'Training worker started.')

        def report_progress(event):
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
