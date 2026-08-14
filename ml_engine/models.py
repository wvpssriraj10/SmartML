from sklearn.linear_model import LogisticRegression, RidgeClassifier, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor, AdaBoostClassifier, AdaBoostRegressor
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.naive_bayes import GaussianNB
import xgboost as xgb
import lightgbm as lgb
import time


MODEL_REGISTRY = {
    'classification': {
        'Logistic Regression': {
            'model': LogisticRegression,
            'params': {'max_iter': 300, 'random_state': 42, 'n_jobs': 1}
        },
        'Ridge Classifier': {
            'model': RidgeClassifier,
            'params': {'random_state': 42}
        },
        'Decision Tree': {
            'model': DecisionTreeClassifier,
            'params': {'random_state': 42, 'max_depth': 10}
        },
        'Random Forest': {
            'model': RandomForestClassifier,
            'params': {'random_state': 42, 'n_jobs': 1, 'n_estimators': 50}
        },
        'Gradient Boosting': {
            'model': GradientBoostingClassifier,
            'params': {'random_state': 42}
        },
        'XGBoost': {
            'model': xgb.XGBClassifier,
            'params': {'random_state': 42, 'n_jobs': 1, 'nthread': 1, 'verbosity': 0}
        },
        'LightGBM': {
            'model': lgb.LGBMClassifier,
            'params': {'random_state': 42, 'n_jobs': 1, 'num_threads': 1, 'verbose': -1}
        },
        'SVM': {
            'model': SVC,
            'params': {'random_state': 42, 'probability': True}
        },
        'KNN': {
            'model': KNeighborsClassifier,
            'params': {'n_jobs': 1}
        },
        'Neural Net': {
            'model': MLPClassifier,
            'params': {'random_state': 42, 'max_iter': 300}
        },
        'Naive Bayes': {
            'model': GaussianNB,
            'params': {}
        }
    },
    'regression': {
        'Ridge Regression': {
            'model': Ridge,
            'params': {'random_state': 42}
        },
        'Lasso Regression': {
            'model': Lasso,
            'params': {'random_state': 42}
        },
        'Decision Tree': {
            'model': DecisionTreeRegressor,
            'params': {'random_state': 42, 'max_depth': 10}
        },
        'Random Forest': {
            'model': RandomForestRegressor,
            'params': {'random_state': 42, 'n_jobs': 1, 'n_estimators': 50}
        },
        'Gradient Boosting': {
            'model': GradientBoostingRegressor,
            'params': {'random_state': 42}
        },
        'XGBoost': {
            'model': xgb.XGBRegressor,
            'params': {'random_state': 42, 'n_jobs': 1, 'nthread': 1, 'verbosity': 0}
        },
        'LightGBM': {
            'model': lgb.LGBMRegressor,
            'params': {'random_state': 42, 'n_jobs': 1, 'num_threads': 1, 'verbose': -1}
        },
        'SVM': {
            'model': SVR,
            'params': {}
        },
        'KNN': {
            'model': KNeighborsRegressor,
            'params': {'n_jobs': 1}
        },
        'Neural Net': {
            'model': MLPRegressor,
            'params': {'random_state': 42, 'max_iter': 300}
        }
    }
}


def get_smart_models(data_profile):
    problem_type = data_profile.get('problem_type', 'classification')
    n_rows = data_profile.get('n_rows', 1000)
    n_features = data_profile.get('n_features', 10)
    n_classes = data_profile.get('n_classes', 2)
    available = MODEL_REGISTRY.get(problem_type, {})

    if problem_type == 'classification' and n_rows < 1000:
        priority = ['Logistic Regression', 'Decision Tree', 'Random Forest', 'Naive Bayes',
                    'KNN', 'SVM', 'Gradient Boosting', 'XGBoost', 'LightGBM', 'Neural Net', 'Ridge Classifier']
    elif problem_type == 'classification' and n_rows > 50000:
        priority = ['LightGBM', 'Logistic Regression', 'Random Forest', 'XGBoost', 'Ridge Classifier',
                    'Gradient Boosting', 'Decision Tree', 'Neural Net', 'KNN', 'SVM']
    elif problem_type == 'regression' and n_rows < 1000:
        priority = ['Ridge Regression', 'Decision Tree', 'KNN', 'Random Forest',
                    'Lasso Regression', 'Gradient Boosting', 'XGBoost', 'LightGBM', 'SVM', 'Neural Net']
    elif problem_type == 'regression' and n_rows > 50000:
        priority = ['LightGBM', 'Random Forest', 'XGBoost', 'Ridge Regression', 'Gradient Boosting',
                    'Lasso Regression', 'Decision Tree', 'Neural Net', 'KNN', 'SVM']
    else:
        priority = list(available.keys())

    # Limit to top 4 models for free-tier (512 MB RAM)
    MAX_MODELS = 4
    priority = priority[:MAX_MODELS]

    return {name: available[name] for name in priority if name in available}


def train_model(model_info, X_train, y_train, model_name):
    start = time.time()
    model = model_info['model'](**model_info['params'])
    model.fit(X_train, y_train)
    elapsed = round(time.time() - start, 3)
    return {'model': model, 'training_time': elapsed, 'name': model_name}
