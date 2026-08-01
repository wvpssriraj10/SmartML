import pandas as pd
import numpy as np
import os
import json


def apply_cleaning_action(df: pd.DataFrame, action: str, column: str = None, strategy: str = None, value: str = None, replace_with: str = None) -> tuple[pd.DataFrame, str]:
    """
    Apply an atomic cleaning action to a pandas DataFrame.
    Returns (cleaned_df, step_description).
    """
    df = df.copy()
    desc = ""

    if action == "drop_duplicates":
        before = len(df)
        df = df.drop_duplicates()
        dropped = before - len(df)
        desc = f"Dropped {dropped} duplicate rows"

    elif action == "drop_column" and column and column in df.columns:
        df = df.drop(columns=[column])
        desc = f"Dropped column '{column}'"

    elif action == "replace_values" and column and column in df.columns:
        if value is not None and replace_with is not None:
            # Try to match data type of column
            try:
                if pd.api.types.is_numeric_dtype(df[column]):
                    val = float(value) if '.' in value else int(value)
                    rep = float(replace_with) if '.' in replace_with else int(replace_with)
                else:
                    val = str(value)
                    rep = str(replace_with)
                df[column] = df[column].replace(val, rep)
                desc = f"Replaced '{value}' with '{replace_with}' in '{column}'"
            except Exception:
                df[column] = df[column].astype(str).replace(str(value), str(replace_with))
                desc = f"Replaced '{value}' with '{replace_with}' in '{column}'"

    elif action == "handle_missing" and column and column in df.columns:
        missing_count = df[column].isnull().sum()
        if missing_count == 0:
            return df, f"No missing values in '{column}'"

        if strategy == "mean" and pd.api.types.is_numeric_dtype(df[column]):
            mean_val = df[column].mean()
            df[column] = df[column].fillna(mean_val)
            desc = f"Imputed missing in '{column}' with Mean ({mean_val:.2f})"
        elif strategy == "median" and pd.api.types.is_numeric_dtype(df[column]):
            med_val = df[column].median()
            df[column] = df[column].fillna(med_val)
            desc = f"Imputed missing in '{column}' with Median ({med_val:.2f})"
        elif strategy == "mode":
            mode_val = df[column].mode()[0] if not df[column].mode().empty else "Unknown"
            df[column] = df[column].fillna(mode_val)
            desc = f"Imputed missing in '{column}' with Mode ({mode_val})"
        elif strategy == "constant" and value is not None:
            fill_val = value
            if pd.api.types.is_numeric_dtype(df[column]):
                fill_val = float(value) if '.' in str(value) else int(value)
            df[column] = df[column].fillna(fill_val)
            desc = f"Imputed missing in '{column}' with constant value '{fill_val}'"
        elif strategy == "drop_rows":
            before = len(df)
            df = df.dropna(subset=[column])
            desc = f"Dropped {before - len(df)} rows with missing values in '{column}'"
        else:
            fill_val = 0 if pd.api.types.is_numeric_dtype(df[column]) else "Missing"
            df[column] = df[column].fillna(fill_val)
            desc = f"Filled missing in '{column}' with '{fill_val}'"

    elif action == "handle_outliers" and column and column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
        q1 = df[column].quantile(0.25)
        q3 = df[column].quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outlier_mask = (df[column] < lower_bound) | (df[column] > upper_bound)
        outlier_count = int(outlier_mask.sum())

        if strategy == "cap" or strategy is None:
            df[column] = np.clip(df[column], lower_bound, upper_bound)
            desc = f"Capped {outlier_count} outliers in '{column}' to range [{lower_bound:.2f}, {upper_bound:.2f}]"
        elif strategy == "drop_rows":
            before = len(df)
            df = df[~outlier_mask]
            desc = f"Dropped {before - len(df)} outlier rows from '{column}'"

    elif action == "encode" and column and column in df.columns:
        if strategy == "one_hot":
            dummies = pd.get_dummies(df[column], prefix=column, drop_first=False)
            df = pd.concat([df.drop(columns=[column]), dummies], axis=1)
            desc = f"One-hot encoded column '{column}' into {len(dummies.columns)} binary columns"
        elif strategy == "label":
            df[column] = df[column].astype('category').cat.codes
            desc = f"Label encoded column '{column}' to integer codes"

    return df, desc


def calculate_dataset_metrics(df: pd.DataFrame) -> dict:
    """Calculate summary metrics for Data Cleaning Studio."""
    total_rows = len(df)
    total_cols = len(df.columns)
    total_values = total_rows * total_cols
    missing_cells = int(df.isnull().sum().sum())
    duplicate_rows = int(df.duplicated().sum())

    numeric_cols = 0
    categorical_cols = 0
    outlier_cells = 0

    per_column_status = {}

    for col in df.columns:
        is_num = pd.api.types.is_numeric_dtype(df[col])
        if is_num:
            numeric_cols += 1
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            outliers = int(((df[col] < (q1 - 1.5 * iqr)) | (df[col] > (q3 + 1.5 * iqr))).sum())
            outlier_cells += outliers
        else:
            categorical_cols += 1
            outliers = 0

        missing = int(df[col].isnull().sum())
        per_column_status[col] = {
            "type": "numeric" if is_num else "categorical",
            "missing": missing,
            "outliers": outliers,
            "is_clean": missing == 0 and outliers == 0
        }

    quality_score = max(0, min(100, int(100 - (missing_cells / max(total_values, 1) * 50) - (duplicate_rows / max(total_rows, 1) * 30))))

    return {
        "rows": total_rows,
        "cols": total_cols,
        "total_values": total_values,
        "missing_cells": missing_cells,
        "duplicate_rows": duplicate_rows,
        "outlier_cells": outlier_cells,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "quality_score": quality_score,
        "column_status": per_column_status
    }
