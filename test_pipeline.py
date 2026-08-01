from ml_engine.preprocessing import DatasetInspector
from ml_engine.pipeline import run_pipeline
from sklearn.datasets import load_iris, load_diabetes, load_wine
import pandas as pd
import os
import json


def test_with_iris():
    print("=" * 60)
    print("TEST 1: Iris Dataset (Classification, Small)")
    print("=" * 60)
    iris = load_iris()
    df = pd.DataFrame(iris.data, columns=iris.feature_names)
    df['target'] = iris.target
    path = "iris_test.csv"
    df.to_csv(path, index=False)

    result = run_pipeline(path, target_column='target', problem_type='classification')
    print_inspection(result)
    print_results(result)

    os.remove(path)
    return result


def test_with_diabetes():
    print("\n" + "=" * 60)
    print("TEST 2: Diabetes Dataset (Regression, Medium)")
    print("=" * 60)
    diabetes = load_diabetes()
    df = pd.DataFrame(diabetes.data, columns=diabetes.feature_names)
    df['target'] = diabetes.target
    path = "diabetes_test.csv"
    df.to_csv(path, index=False)

    result = run_pipeline(path, target_column='target', problem_type='regression')
    print_inspection(result)
    print_results(result)

    os.remove(path)
    return result


def test_with_wine():
    print("\n" + "=" * 60)
    print("TEST 3: Wine Dataset (Classification, Multi-class)")
    print("=" * 60)
    wine = load_wine()
    df = pd.DataFrame(wine.data, columns=wine.feature_names)
    df['target'] = wine.target
    path = "wine_test.csv"
    df.to_csv(path, index=False)

    result = run_pipeline(path, target_column='target', problem_type='classification')
    print_inspection(result)
    print_results(result)

    os.remove(path)
    return result


def test_with_manual_selection():
    print("\n" + "=" * 60)
    print("TEST 4: Manual Model Selection (Only 2 models)")
    print("=" * 60)
    iris = load_iris()
    df = pd.DataFrame(iris.data, columns=iris.feature_names)
    df['target'] = iris.target
    path = "iris_manual_test.csv"
    df.to_csv(path, index=False)

    result = run_pipeline(
        path,
        target_column='target',
        problem_type='classification',
        model_selection='manual',
        selected_models=['Logistic Regression', 'Random Forest']
    )
    print_inspection(result)
    print_results(result)

    os.remove(path)
    return result


def print_inspection(result):
    report = result['data_report']
    insp = report['inspection']
    print(f"\nRows: {insp['rows']}, Columns: {insp['columns']}")
    print(f"Columns: {insp['column_names']}")
    print(f"Numeric: {insp['numeric_columns']}")
    print(f"Categorical: {insp['categorical_columns']}")
    print(f"Problem Type: {report['problem_type']}")
    print(f"Strategy: {report['model_selection_strategy']}")
    print(f"Models Trained: {report['models_trained']}")


def print_results(result):
    print(f"\nTotal Models: {result['total_models_trained']}")
    print(f"Successful: {result['successful']}, Failed: {result['failed']}")
    print("\nRankings:")
    for r in result['results'][:5]:
        status = "[OK]" if r['status'] == 'completed' else "[FAIL]"
        metrics_str = ", ".join([f"{k}={v}" for k, v in r['metrics'].items()])
        print(f"  #{r['rank']} {status} {r['model_name']}: {metrics_str} ({r['training_time']}s)")

    if result['best_model']:
        bm = result['best_model']
        print(f"\nBest Model: {bm['name']}")
        print(f"Why: {bm['why']}")


if __name__ == "__main__":
    print("INSTALLING DEPENDENCIES...")
    os.system("pip install pandas numpy scikit-learn xgboost lightgbm joblib -q")

    test_with_iris()
    test_with_diabetes()
    test_with_wine()
    test_with_manual_selection()
    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)
