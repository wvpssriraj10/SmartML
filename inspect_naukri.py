import pandas as pd
import os

uploads_dir = 'uploads'
files = os.listdir(uploads_dir)
print("Files in uploads:", files)
for f in files:
    if 'naukri' in f.lower() or f.endswith('.csv'):
        path = os.path.join(uploads_dir, f)
        df = pd.read_csv(path)
        print("File:", f)
        print("  Shape:", df.shape)
        print("  Dtypes:")
        print(df.dtypes)
        if 'salary' in df.columns:
            print("  Salary unique count:", df['salary'].nunique())
            print("  Salary sample values:", df['salary'].dropna().unique()[:5])
            print("  Salary null count:", df['salary'].isnull().sum())
