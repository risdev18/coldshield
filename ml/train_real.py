import pandas as pd
import numpy as np
import json
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, balanced_accuracy_score, average_precision_score
from sklearn.model_selection import LeaveOneGroupOut
import warnings
warnings.filterwarnings('ignore')

def main():
    # 1. Load data
    df = pd.read_csv('ChillShield_training_W60.csv', engine='python')
    
    features = [
        'W60_T_mean', 'W60_T_std', 'W60_T_range', 'W60_delta', 'W60_slope',
        'W60_hot_ratio_mean', 'W60_over_auc_mean', 'W60_over_dur_mean',
        'W60_spatial_range_mean', 'W60_spatial_std_mean', 'W60_active_ratio_mean'
    ]
    target = 'y_next_120_R2'
    group_col = 'shipment_id'
    
    X = df[features].astype(np.float32).values
    y = df[target].astype(np.float32).values
    groups = df[group_col].values
    
    import gc
    del df
    gc.collect()
    
    # Models
    models = {
        'Logistic Regression': Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
            ('clf', LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42))
        ]),
        'Gradient Boosting': Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('clf', GradientBoostingClassifier(random_state=42))
        ])
    }
    
    # CV
    logo = LeaveOneGroupOut()
    
    results = {m: {'acc': [], 'prec': [], 'rec': [], 'f1': [], 'roc_auc': [], 'pr_auc': [], 'bal_acc': []} for m in models}
    
    for train_idx, test_idx in logo.split(X, y, groups):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        
        for name, model in models.items():
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            y_prob = model.predict_proba(X_test)[:, 1]
            
            results[name]['acc'].append(accuracy_score(y_test, y_pred))
            if len(np.unique(y_test)) > 1:
                results[name]['roc_auc'].append(roc_auc_score(y_test, y_prob))
            
            results[name]['prec'].append(precision_score(y_test, y_pred, zero_division=0))
            results[name]['rec'].append(recall_score(y_test, y_pred, zero_division=0))
            results[name]['f1'].append(f1_score(y_test, y_pred, zero_division=0))
            results[name]['pr_auc'].append(average_precision_score(y_test, y_prob))
            results[name]['bal_acc'].append(balanced_accuracy_score(y_test, y_pred))
    
    # Aggregate results
    agg_results = {}
    for name in models:
        agg_results[name] = {k: np.mean(v) for k, v in results[name].items() if len(v) > 0}
    
    # Select best model based on Recall, F1, ROC-AUC, PR-AUC
    best_model_name = None
    best_score = -1
    for name, res in agg_results.items():
        score = res.get('rec', 0) + res.get('f1', 0) + res.get('roc_auc', 0) + res.get('pr_auc', 0)
        if score > best_score:
            best_score = score
            best_model_name = name
            
    # Final model training on ALL data
    final_model = models[best_model_name]
    final_model.fit(X, y)
    
    # Feature Importance
    if best_model_name == 'Logistic Regression':
        importances = final_model.named_steps['clf'].coef_[0]
        imp_dict = {f: float(i) for f, i in zip(features, importances)}
    else:
        importances = final_model.named_steps['clf'].feature_importances_
        imp_dict = {f: float(i) for f, i in zip(features, importances)}
    
    sorted_imp = sorted(imp_dict.items(), key=lambda x: abs(x[1]), reverse=True)
    
    # Save artifacts
    with open('model.pkl', 'wb') as f:
        pickle.dump(final_model, f)
    
    metrics_to_save = {k: float(v) for k, v in agg_results[best_model_name].items()}
    with open('metrics.json', 'w') as f:
        json.dump(metrics_to_save, f, indent=2)
    
    class_dist = df[target].value_counts().to_dict()
    
    metadata = {
      "dataset_name": "Cold-Chain-Transportation-Strawberry",
      "dataset_file": "ChillShield_training_W60.csv",
      "target": target,
      "model_type": best_model_name,
      "feature_names": features,
      "training_rows": len(df),
      "unique_shipments": df[group_col].nunique(),
      "validation_strategy": "Leave-One-Shipment-Out",
      "metrics": metrics_to_save,
      "class_distribution": {str(k): int(v) for k, v in class_dist.items()},
      "limitations": [
          "Only 6 unique shipments in the dataset.",
          "Not validated across thousands of independent shipments.",
          "Not production accuracy or industry validated.",
          "Does not guarantee spoilage prevention.",
          "Not clinically validated performance.",
          "Prototype research/hackathon model.",
          "Model predicts probability of severe-risk state R2 within 120 minutes, not direct physical spoilage."
      ],
      "top_features": sorted_imp[:5]
    }
    
    with open('model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Print Report
    print("--- CHILLSHIELD MODEL TRAINING COMPLETE ---")
    print(f"1. Selected model: {best_model_name}")
    print(f"2. Features used: {len(features)} ({', '.join(features)})")
    print("3. Validation strategy: Leave-One-Shipment-Out")
    print(f"4. Class distribution: {class_dist}")
    print(f"5. Accuracy: {metrics_to_save['acc']:.4f}")
    print(f"6. Precision: {metrics_to_save['prec']:.4f}")
    print(f"7. Recall: {metrics_to_save['rec']:.4f}")
    print(f"8. F1: {metrics_to_save['f1']:.4f}")
    print(f"9. ROC-AUC: {metrics_to_save['roc_auc']:.4f}")
    print(f"10. PR-AUC: {metrics_to_save['pr_auc']:.4f}")
    print(f"11. Balanced Accuracy: {metrics_to_save['bal_acc']:.4f}")
    print("12. Top 5 important features:")
    for feat, imp in sorted_imp[:5]:
        print(f"   - {feat}: {imp:.4f}")
    print("13. Warnings/Limitations:")
    for lim in metadata['limitations']:
        print(f"   - {lim}")

if __name__ == '__main__':
    main()
