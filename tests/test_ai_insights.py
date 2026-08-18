import pytest

from ml_engine.ai_insights import generate_executive_insights, generate_pdf_report


class TestExecutiveInsights:
    def test_clean_dataset(self, iris_df):
        insights = generate_executive_insights(iris_df, "iris.csv")
        assert insights["rows"] == 150
        assert insights["cols"] == 5
        assert insights["data_completeness_pct"] == 100.0
        # iris has exactly 1 duplicate row -> 99.3% consistency
        assert insights["consistency_pct"] == 99.3
        assert insights["quality_score"] > 0
        assert insights["risk_score"] >= 5
        assert insights["risk_level"] in ("LOW", "MODERATE", "HIGH")
        assert insights["dataset_name"] == "iris.csv"
        assert len(insights["recommended_actions"]) == 4
        assert insights["processing_summary"]["missing_fixed"] == 0

    def test_dirty_dataset(self, dirty_df):
        insights = generate_executive_insights(dirty_df, "dirty.csv")
        assert insights["rows"] == 5
        assert insights["data_completeness_pct"] < 100.0
        assert insights["consistency_pct"] == 100.0  # dirty_df has no duplicate rows
        assert insights["processing_summary"]["missing_fixed"] == 2

    def test_anomaly_detection_finds_outlier(self):
        import pandas as pd

        df = pd.DataFrame(
            {
                "a": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 1000.0],
                "b": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            }
        )
        insights = generate_executive_insights(df, "out.csv")
        assert insights["anomalies_summary"]["total"] >= 1
        assert insights["anomalies"][0]["severity"] in ("CRITICAL", "WARNING")

    def test_correlations_found(self):
        import pandas as pd

        df = pd.DataFrame(
            {
                "a": [1, 2, 3, 4, 5],
                "b": [2, 4, 6, 8, 10],  # perfectly correlated with a
                "c": [5, 4, 3, 2, 1],
            }
        )
        insights = generate_executive_insights(df, "corr.csv")
        assert len(insights["strong_correlations"]) >= 1


class TestPdfReport:
    def test_generates_valid_pdf_bytes(self, iris_df):
        insights = generate_executive_insights(iris_df, "iris.csv")
        pdf = generate_pdf_report("iris.csv", insights)
        assert pdf.startswith(b"%PDF")
        assert len(pdf) > 1000

    def test_pdf_with_anomalies(self):
        import pandas as pd

        df = pd.DataFrame(
            {
                "a": [1.0, 2.0, 3.0, 4.0, 5.0, 1000.0],
                "b": [10, 20, 30, 40, 50, 60],
            }
        )
        insights = generate_executive_insights(df, "out.csv")
        pdf = generate_pdf_report("out.csv", insights)
        assert pdf.startswith(b"%PDF")
