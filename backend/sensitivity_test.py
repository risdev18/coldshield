import requests

api_url = "http://localhost:8000/predict"

def predict(features):
    req = {
        "shipment_id": "TEST",
        "features": features
    }
    res = requests.post(api_url, json=req)
    if res.status_code == 200:
        return res.json().get('risk_score', 0.0)
    return 0.0

def build_features(temp, safeMax, delay, exc_dur, ref_cond="good"):
    currentTemp = temp
    W60_T_mean = currentTemp
    W60_active_ratio_mean = 0.0 if ref_cond == "failed" else (0.5 if ref_cond == "degraded" else 1.0)
    
    W60_hot_ratio_mean = 0.8 if currentTemp > safeMax else 0.0
    W60_over_dur_mean = exc_dur if exc_dur else (15 if currentTemp > safeMax else 0)
    W60_over_auc_mean = (currentTemp - safeMax) * W60_over_dur_mean if currentTemp > safeMax else 0
    
    W60_delta = 0.8 if delay > 0 else 0.1
    W60_slope = W60_delta / 60.0
    
    W60_T_std = 0.5
    W60_T_range = 1.2
    W60_spatial_range_mean = 1.5
    W60_spatial_std_mean = 0.4
    
    return {
        'W60_T_mean': W60_T_mean,
        'W60_T_std': W60_T_std,
        'W60_T_range': W60_T_range,
        'W60_delta': W60_delta,
        'W60_slope': W60_slope,
        'W60_hot_ratio_mean': W60_hot_ratio_mean,
        'W60_over_auc_mean': W60_over_auc_mean,
        'W60_over_dur_mean': W60_over_dur_mean,
        'W60_spatial_range_mean': W60_spatial_range_mean,
        'W60_spatial_std_mean': W60_spatial_std_mean,
        'W60_active_ratio_mean': W60_active_ratio_mean,
    }

shipments = {
    "CG-8821 (Critical)": build_features(temp=10.8, safeMax=8.0, delay=45, exc_dur=45, ref_cond="degraded"),
    "CG-3301 (High/Warning)": build_features(temp=8.7, safeMax=10.0, delay=15, exc_dur=0, ref_cond="good"),
    "CG-5502 (Low)": build_features(temp=4.0, safeMax=8.0, delay=0, exc_dur=0, ref_cond="good"),
}

target_features = [
    'W60_T_std',
    'W60_T_range',
    'W60_spatial_range_mean',
    'W60_spatial_std_mean'
]

ranges = {
    'W60_T_std': [0.1, 0.5, 1.0, 2.0],
    'W60_T_range': [0.2, 1.2, 3.0, 5.0],
    'W60_spatial_range_mean': [0.5, 1.5, 3.0, 6.0],
    'W60_spatial_std_mean': [0.1, 0.4, 1.0, 2.5]
}

print("--- SENSITIVITY ANALYSIS ---")
for s_name, feat_dict in shipments.items():
    base_score = predict(feat_dict)
    print(f"\n{s_name} Baseline Risk: {base_score:.2f}%")
    
    for tf in target_features:
        print(f"  Varying {tf}:")
        for val in ranges[tf]:
            test_feat = dict(feat_dict)
            test_feat[tf] = val
            score = predict(test_feat)
            diff = score - base_score
            print(f"    - {val:.1f} -> Risk: {score:.2f}% (Diff: {diff:+.2f}%)")
