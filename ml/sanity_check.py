import pandas as pd
import numpy as np
from sklearn.model_selection import LeaveOneGroupOut
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    confusion_matrix, recall_score, roc_auc_score, average_precision_score,
    roc_curve, precision_recall_curve
)

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
model = Pipeline([
    ('imputer', SimpleImputer(strategy='median')),
    ('classifier', GradientBoostingClassifier(random_state=42))
])

all_y_true = []
all_y_pred = []
all_y_prob = []

per_shipment = {}

for train_idx, test_idx in logo.split(X, y, groups):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    shipment_id = groups.iloc[test_idx].unique()[0]
    
    # Verify no overlap
    assert len(set(train_idx).intersection(set(test_idx))) == 0
    # Verify no future target in features
    assert target not in features
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    all_y_true.extend(y_test)
    all_y_pred.extend(y_pred)
    all_y_prob.extend(y_prob)
    
    recall_1 = recall_score(y_test, y_pred, pos_label=1, zero_division=np.nan)
    recall_0 = recall_score(y_test, y_pred, pos_label=0, zero_division=np.nan)
    
    if len(np.unique(y_test)) > 1:
        roc_auc = roc_auc_score(y_test, y_prob)
        pr_auc = average_precision_score(y_test, y_prob)
    else:
        roc_auc = np.nan
        pr_auc = np.nan
        
    per_shipment[shipment_id] = {
        'Recall_Class1': recall_1,
        'Recall_Class0': recall_0,
        'ROC_AUC': roc_auc,
        'PR_AUC': pr_auc
    }

cm = confusion_matrix(all_y_true, all_y_pred)
tn, fp, fn, tp = cm.ravel()

fpr, tpr, roc_thresholds = roc_curve(all_y_true, all_y_prob)
prec, rec, pr_thresholds = precision_recall_curve(all_y_true, all_y_prob)

print("--- FINAL ML SANITY CHECK REPORT ---\n")
print("1. Confusion matrix aggregated across LOSO folds:")
print(f"   TN: {tn}  FP: {fp}")
print(f"   FN: {fn}  TP: {tp}\n")

print("2. Per-shipment metrics for all 6 shipments:")
for s_id, metrics in per_shipment.items():
    print(f"   Shipment: {s_id}")
    print(f"     3. Recall Class 1: {metrics['Recall_Class1']:.4f}" if not np.isnan(metrics['Recall_Class1']) else "     3. Recall Class 1: N/A (no positive samples)")
    print(f"     4. Recall Class 0: {metrics['Recall_Class0']:.4f}" if not np.isnan(metrics['Recall_Class0']) else "     4. Recall Class 0: N/A (no negative samples)")
    print(f"     5. ROC-AUC: {metrics['ROC_AUC']:.4f}" if not np.isnan(metrics['ROC_AUC']) else "     5. ROC-AUC: N/A (only one class present)")
    print(f"     6. PR-AUC: {metrics['PR_AUC']:.4f}" if not np.isnan(metrics['PR_AUC']) else "     6. PR-AUC: N/A (only one class present)")
    
print(f"\n7. Number of false positives: {fp}")
print(f"8. Number of false negatives: {fn}\n")

print("9. ROC curve data (sampled down for brevity):")
print(f"   FPR array length: {len(fpr)}, Sample: {[round(float(x), 4) for x in fpr[::max(1, len(fpr)//10)]]}")
print(f"   TPR array length: {len(tpr)}, Sample: {[round(float(x), 4) for x in tpr[::max(1, len(tpr)//10)]]}")

print("\n10. Precision-Recall curve data (sampled down for brevity):")
print(f"   Precision array length: {len(prec)}, Sample: {[round(float(x), 4) for x in prec[::max(1, len(prec)//10)]]}")
print(f"   Recall array length: {len(rec)}, Sample: {[round(float(x), 4) for x in rec[::max(1, len(rec)//10)]]}")

print("\nVerifications:")
print("- VERIFIED: No future target columns entered the features.")
print("- VERIFIED: Preprocessing was fitted only on training folds.")
print("- VERIFIED: No rows from the held-out shipment entered training.")

print("\nThe reported overall metrics are cross-validation results, not production performance.")
