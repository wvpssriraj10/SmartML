from .trainer import Trainer


def run_pipeline(file_path, target_column, problem_type=None, model_selection='smart', selected_models=None):
    trainer = Trainer(
        file_path=file_path,
        target_column=target_column,
        problem_type=problem_type,
        model_selection=model_selection,
        selected_models=selected_models
    )
    return trainer.run()
