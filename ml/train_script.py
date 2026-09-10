import pandas as pd
import numpy as np
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, balanced_accuracy_score, average_precision_score
)
import json
import joblib

# Load dataset
df = pd.read_csv('ml/ChillShield_training_W60.csv')

features = [
    'W60_T_mean', 'W60_T_std', 'W60_T_range', 'W60_delta', 'W60_slope',
    'W60_hot_ratio_mean', 'W60_over_auc_mean', 'W60_over_dur_mean',
    'W60_spatial_range_mean', 'W60_spatial_std_mean', 'W60_active_ratio_mean'
]
target = 'y_next_120_R2'
group_col = 'shipment_id'

X = df[features]
y = df[target]
groups = df[group_col]

logo = LeaveOneGroupOut()

models = {
    'Logistic Regression': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42))
    ]),
    'Gradient Boosting': Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('classifier', GradientBoostingClassifier(random_state=42))
    ])
}

results = {name: {m: [] for m in ['Accuracy', 'Precision', 'Recall', 'F1', 'ROC-AUC', 'Balanced Accuracy', 'PR-AUC']} for name in models}

for train_idx, test_idx in logo.split(X, y, groups):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]
        
        results[name]['Accuracy'].append(accuracy_score(y_test, y_pred))
        results[name]['Precision'].append(precision_score(y_test, y_pred, zero_division=0))
        results[name]['Recall'].append(recall_score(y_test, y_pred, zero_division=0))
        results[name]['F1'].append(f1_score(y_test, y_pred, zero_division=0))
        
        if len(np.unique(y_test)) > 1:
            results[name]['ROC-AUC'].append(roc_auc_score(y_test, y_prob))
            results[name]['PR-AUC'].append(average_precision_score(y_test, y_prob))
        
        results[name]['Balanced Accuracy'].append(balanced_accuracy_score(y_test, y_pred))

mean_results = {}
for name in models:
    mean_results[name] = {m: np.mean(vals) if vals else 0 for m, vals in results[name].items()}

best_model_name = max(models.keys(), key=lambda name: mean_results[name]['Recall'] + mean_results[name]['F1'] + mean_results[name]['ROC-AUC'] + mean_results[name]['PR-AUC'])

print("--- TRAINING REPORT ---")
print(f"\n1. Selected model: {best_model_name}")
print(f"2. Features used: {', '.join(features)}")
print(f"3. Validation strategy: Leave-One-Shipment-Out Cross-Validation (LOSO)")
class_counts = y.value_counts()
print(f"4. Class distribution: Class 1 = {class_counts.get(1, 0)}, Class 0 = {class_counts.get(0, 0)}")

print(f"\nModel Performance (Mean CV):")
for name in models:
    if name == best_model_name:
        print(f"\n{name} (SELECTED):")
    else:
        print(f"\n{name}:")
    print(f"5. Accuracy: {mean_results[name]['Accuracy']:.4f}")
    print(f"6. Precision: {mean_results[name]['Precision']:.4f}")
    print(f"7. Recall: {mean_results[name]['Recall']:.4f}")
    print(f"8. F1: {mean_results[name]['F1']:.4f}")
    print(f"9. ROC-AUC: {mean_results[name]['ROC-AUC']:.4f}")
    print(f"10. PR-AUC: {mean_results[name]['PR-AUC']:.4f}")
    print(f"11. Balanced Accuracy: {mean_results[name]['Balanced Accuracy']:.4f}")

# Train final model on all data
final_model = models[best_model_name]
final_model.fit(X, y)

# Get feature importance
if best_model_name == 'Logistic Regression':
    importance = final_model.named_steps['classifier'].coef_[0]
else:
    importance = final_model.named_steps['classifier'].feature_importances_

feature_importance = sorted(zip(features, importance), key=lambda x: abs(x[1]), reverse=True)

print(f"\n12. Top 5 important features ({best_model_name}):")
for feat, imp in feature_importance[:5]:
    print(f"   {feat}: {imp:.4f}")

print("\n13. Warnings & Limitations:")
print("   - There are only 6 unique shipments in the dataset.")
print("   - The model has NOT been validated across thousands of independent shipments.")
print("   - Do not claim production accuracy, industry validation, guaranteed spoilage prevention, or clinically validated performance.")
print("   - This is a prototype research/hackathon model.")
print("   - IMPORTANT INTERPRETATION: The model is predicting 'Probability that the shipment will enter severe-risk state R2 within the next 120 minutes'. It is NOT directly predicting physical spoilage.")

# Save artifacts
joblib.dump(final_model, 'ml/model.pkl')

# Save metrics (ensure float types are standard python floats)
metrics_out = {k: float(v) for k, v in mean_results[best_model_name].items()}
with open('ml/metrics.json', 'w') as f:
    json.dump(metrics_out, f, indent=2)

class_dist = {str(k): int(v) for k, v in class_counts.items()}

metadata = {
    "dataset_name": "Cold-Chain-Transportation-Strawberry",
    "dataset_file": "ChillShield_training_W60.csv",
    "target": "y_next_120_R2",
    "model_type": best_model_name,
    "feature_names": features,
    "training_rows": int(len(df)),
    "unique_shipments": int(len(groups.unique())),
    "validation_strategy": "Leave-One-Shipment-Out",
    "metrics": metrics_out,
    "class_distribution": class_dist,
    "limitations": [
        "There are only 6 unique shipments in the dataset.",
        "Do not claim the model has been validated across thousands of independent shipments.",
        "Do not claim production accuracy, industry validation, guaranteed spoilage prevention, or clinically validated performance.",
        "This is a prototype research/hackathon model."
    ]
}

with open('ml/model_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("\nModel training and artifact generation complete.")
