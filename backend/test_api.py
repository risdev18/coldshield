import pandas as pd
import requests
import joblib
import json
import time
import os

model_path = '../ml/model.pkl'
metadata_path = '../ml/model_metadata.json'
csv_path = '../ml/ChillShield_training_W60.csv'

# Ensure API is running
time.sleep(2)

try:
    health = requests.get('http://127.0.0.1:8000/health').json()
    print(f"Health Check: {health}")
except Exception as e:
    print(f"API is not reachable: {e}")
    exit(1)

model = joblib.load(model_path)
with open(metadata_path, 'r') as f:
    metadata = json.load(f)
features = metadata['feature_names']

df = pd.read_csv(csv_path)
sample_rows = df.sample(n=3, random_state=42)

url = 'http://127.0.0.1:8000/predict'

print("\n--- API TESTING ---\n")
for idx, row in sample_rows.iterrows():
    shipment_id = row['shipment_id']
    X_input = pd.DataFrame([row[features]])
    
    direct_prob = model.predict_proba(X_input)[0][1]
    direct_score = round(direct_prob * 100, 2)
    
    payload = {
        "shipment_id": str(shipment_id),
        "features": {f: float(row[f]) for f in features}
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        api_data = response.json()
        api_score = api_data['risk_score']
        
        print(f"Row {idx} (Shipment: {shipment_id})")
        print(f"Direct Python score: {direct_score}")
        print(f"API response score:  {api_score}")
        print(f"Scores Match:        {abs(direct_score - api_score) < 0.01}")
        print(f"Full Response:\n{json.dumps(api_data, indent=2)}\n")
    except Exception as e:
        print(f"Error calling API for row {idx}: {e}")
