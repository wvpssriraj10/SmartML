import pandas as pd
import pytest


@pytest.fixture
def iris_df():
    from sklearn.datasets import load_iris

    iris = load_iris()
    df = pd.DataFrame(iris.data, columns=iris.feature_names)
    df["target"] = iris.target
    return df


@pytest.fixture
def iris_csv(tmp_path, iris_df):
    path = tmp_path / "iris.csv"
    iris_df.to_csv(path, index=False)
    return str(path)


@pytest.fixture
def dirty_df():
    return pd.DataFrame(
        {
            "num": [1.0, 2.0, None, 4.0, 100.0],
            "cat": ["a", "a", "b", None, "c"],
            "target": [0, 1, 0, 1, 0],
        }
    )


@pytest.fixture
def dirty_csv(tmp_path, dirty_df):
    path = tmp_path / "dirty.csv"
    dirty_df.to_csv(path, index=False)
    return str(path)
