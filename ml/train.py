import pandas as pd
import numpy as np
import json
import pickle
import warnings
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, balanced_accuracy_score,
                             average_precision_score)
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings('ignore')

dataset_file = 'ChillShield_training_W60.csv'
df = pd.read_csv(dataset_file)

features = [
    'W60_T_mean', 'W60_T_std', 'W60_T_range', 'W60_delta', 'W60_slope',
    'W60_hot_ratio_mean', 'W60_over_auc_mean', 'W60_over_dur_mean',
    'W60_spatial_range_mean', 'W60_spatial_std_mean', 'W60_active_ratio_mean'
]
target = 'y_next_120_R2'

X = df[features]
y = df[target]
groups = df['shipment_id']

for col in features:
    X[col] = pd.to_numeric(X[col], errors='coerce')

logo = LeaveOneGroupOut()

models = {
    'Logistic Regression': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced'))
    ]),
    'Gradient Boosting': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('classifier', GradientBoostingClassifier(random_state=42))
    ])
}

results = {}

for name, model in models.items():
    metrics = {
        'accuracy': [], 'precision': [], 'recall': [], 'f1': [],
        'roc_auc': [], 'pr_auc': [], 'balanced_accuracy': []
    }
    
    for train_idx, test_idx in logo.split(X, y, groups):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        if hasattr(model, 'predict_proba'):
            y_prob = model.predict_proba(X_test)[:, 1]
        else:
            y_prob = model.decision_function(X_test)
            
        metrics['accuracy'].append(accuracy_score(y_test, y_pred))
        metrics['precision'].append(precision_score(y_test, y_pred, zero_division=0))
        metrics['recall'].append(recall_score(y_test, y_pred, zero_division=0))
        metrics['f1'].append(f1_score(y_test, y_pred, zero_division=0))
        
        if len(np.unique(y_test)) > 1:
            metrics['roc_auc'].append(roc_auc_score(y_test, y_prob))
        metrics['pr_auc'].append(average_precision_score(y_test, y_prob))
        metrics['balanced_accuracy'].append(balanced_accuracy_score(y_test, y_pred))
        
    agg_metrics = {k: {'mean': np.mean(v), 'std': np.std(v)} for k, v in metrics.items()}
    results[name] = agg_metrics

def model_score(metrics):
    return (metrics['recall']['mean'] + metrics['f1']['mean'] + 
            metrics['roc_auc']['mean'] + metrics['pr_auc']['mean'])

best_model_name = max(results.keys(), key=lambda k: model_score(results[k]))
best_model_pipeline = models[best_model_name]

best_model_pipeline.fit(X, y)

with open('model.pkl', 'wb') as f:
    pickle.dump(best_model_pipeline, f)

with open('metrics.json', 'w') as f:
    json.dump(results, f, indent=4)

importance_dict = {}
if best_model_name == 'Logistic Regression':
    coef = best_model_pipeline.named_steps['classifier'].coef_[0]
    for feat, c in zip(features, coef):
        importance_dict[feat] = float(c)
elif best_model_name == 'Gradient Boosting':
    imp = best_model_pipeline.named_steps['classifier'].feature_importances_
    for feat, i in zip(features, imp):
        importance_dict[feat] = float(i)

top_5 = sorted(importance_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
top_5_list = [{"feature": k, "importance": v} for k, v in top_5]

class_dist = y.value_counts().to_dict()

metadata = {
  "dataset_name": "Cold-Chain-Transportation-Strawberry",
  "dataset_file": "ChillShield_training_W60.csv",
  "target": "y_next_120_R2",
  "model_type": best_model_name,
  "feature_names": features,
  "training_rows": len(df),
  "unique_shipments": int(df['shipment_id'].nunique()),
  "validation_strategy": "Leave-One-Shipment-Out",
  "metrics": results[best_model_name],
  "class_distribution": {str(k): int(v) for k, v in class_dist.items()},
  "limitations": [
      "There are only 6 unique shipments in the dataset. Do not claim the model has been validated across thousands of independent shipments.",
      "Do not claim production accuracy, industry validation, guaranteed spoilage prevention, or clinically validated performance.",
      "This is a prototype research/hackathon model.",
      "The model is predicting the probability that the shipment will enter severe-risk state R2 within the next 120 minutes. It is NOT directly predicting physical spoilage."
  ]
}

with open('model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=4)

print("BEST_MODEL:", best_model_name)
print("CLASS_DISTRIBUTION:", json.dumps({str(k): int(v) for k, v in class_dist.items()}))
print("METRICS:", json.dumps(results[best_model_name], indent=2))
print("TOP_FEATURES:", json.dumps(top_5_list, indent=2))
