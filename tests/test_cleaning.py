import pytest

from ml_engine.cleaning import apply_cleaning_action, calculate_dataset_metrics


class TestDropDuplicates:
    def test_drops_duplicate_rows(self, dirty_df):
        df = dirty_df.copy()
        df.loc[len(df)] = df.iloc[0]
        out, desc = apply_cleaning_action(df, "drop_duplicates")
        assert len(out) == len(dirty_df)
        assert "duplicate" in desc.lower()


class TestDropColumn:
    def test_drops_named_column(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "drop_column", column="cat")
        assert "cat" not in out.columns
        assert "Dropped column 'cat'" == desc

    def test_missing_column_is_noop(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "drop_column", column="nope")
        assert list(out.columns) == list(dirty_df.columns)
        assert desc == ""


class TestReplaceValues:
    def test_numeric_replace(self, dirty_df):
        df = dirty_df.copy()
        out, desc = apply_cleaning_action(df, "replace_values", column="num", value="2.0", replace_with="9.0")
        assert 9.0 in out["num"].values
        assert "Replaced" in desc

    def test_string_replace(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "replace_values", column="cat", value="a", replace_with="z")
        assert out["cat"].tolist().count("z") == 2


class TestHandleMissing:
    def test_no_missing_returns_unchanged(self, iris_df):
        out, desc = apply_cleaning_action(iris_df, "handle_missing", column="target", strategy="mean")
        assert len(out) == len(iris_df)
        assert "No missing" in desc

    def test_impute_mean(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_missing", column="num", strategy="mean")
        assert out["num"].isnull().sum() == 0
        assert "Mean" in desc

    def test_impute_median(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_missing", column="num", strategy="median")
        assert out["num"].isnull().sum() == 0
        # median of [1.0, 2.0, 4.0, 100.0] is 3.0
        assert out["num"].iloc[2] == 3.0

    def test_impute_mode(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_missing", column="cat", strategy="mode")
        assert out["cat"].isnull().sum() == 0
        assert out["cat"].iloc[3] == "a"

    def test_impute_constant(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_missing", column="num", strategy="constant", value="7")
        assert out["num"].iloc[2] == 7

    def test_drop_rows(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_missing", column="num", strategy="drop_rows")
        assert len(out) == 4


class TestHandleOutliers:
    def test_cap_clips_outliers(self, dirty_df):
        df = dirty_df.copy()
        out, desc = apply_cleaning_action(df, "handle_outliers", column="num", strategy="cap")
        q1, q3 = df["num"].quantile(0.25), df["num"].quantile(0.75)
        iqr = q3 - q1
        assert out["num"].max() <= q3 + 1.5 * iqr
        assert "Capped 1 outlier" in desc

    def test_drop_rows(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "handle_outliers", column="num", strategy="drop_rows")
        assert len(out) == 4
        assert "Dropped 1 outlier" in desc


class TestEncode:
    def test_one_hot(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "encode", column="cat", strategy="one_hot")
        assert "cat_a" in out.columns
        assert "cat" not in out.columns
        assert "binary columns" in desc

    def test_label(self, dirty_df):
        out, desc = apply_cleaning_action(dirty_df, "encode", column="cat", strategy="label")
        assert out["cat"].dtype == "int32" or str(out["cat"].dtype).startswith("int")
        assert "integer codes" in desc


class TestCalculateDatasetMetrics:
    def test_counts(self, dirty_df):
        m = calculate_dataset_metrics(dirty_df)
        assert m["rows"] == 5
        assert m["cols"] == 3
        assert m["total_values"] == 15
        assert m["missing_cells"] == 2
        assert m["numeric_cols"] == 2
        assert m["categorical_cols"] == 1
        assert m["quality_score"] <= 100

    def test_per_column_status(self, dirty_df):
        m = calculate_dataset_metrics(dirty_df)
        assert m["column_status"]["num"]["type"] == "numeric"
        assert m["column_status"]["cat"]["type"] == "categorical"
        assert m["column_status"]["num"]["missing"] == 1
