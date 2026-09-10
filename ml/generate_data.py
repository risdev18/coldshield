"""
ChillShield AI — Synthetic Cold-Chain Dataset Generator
=======================================================
Generates ~2,000 synthetic records for prototype ML training.

Dataset: SYNTHETIC — generated for hackathon demonstration purposes.
Production deployment would require validated historical shipment,
temperature logger, telematics, route and spoilage records.

Features:
    temperature             : Current cargo compartment temperature (°C)
    temp_excursion_magnitude: How far above safe range (°C above safe max)
    excursion_duration_min  : Minutes the cargo has been outside safe range
    humidity                : Relative humidity (%)
    delay_minutes           : Current transit delay (min)
    remaining_transit_min   : Minutes left to destination
    cargo_sensitivity       : 1=low, 2=medium, 3=high (encoded from cargo type)
    route_risk              : 0.0–1.0 normalized route risk score
    traffic_level           : 1=low, 2=medium, 3=high
    handling_events         : Count of abnormal handling events
    refrigeration_condition : 1=good, 2=degraded, 3=failed
    distance_km             : Total route distance
    cargo_type_encoded      : Ordinal encoded cargo type

Target:
    spoilage_event          : 1 = spoilage/loss risk materialized, 0 = safe
"""

import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(42)

N = 2000

CARGO_PROFILES = {
    # (safe_temp_min, safe_temp_max, sensitivity, base_name)
    0: (-20, -15, 3, "frozen_food"),      # Frozen food — very sensitive
    1: (2, 8, 3, "biologics"),            # Biologics/pharma — very sensitive
    2: (2, 8, 3, "vaccines"),             # Vaccines — very sensitive
    3: (1, 4, 2, "dairy"),                # Dairy — medium-high
    4: (0, 10, 2, "fresh_produce"),       # Fresh produce — medium
}

cargo_types = rng.integers(0, 5, N)
cargo_sensitivity = np.array([CARGO_PROFILES[c][2] for c in cargo_types])
safe_temp_min = np.array([CARGO_PROFILES[c][0] for c in cargo_types], dtype=float)
safe_temp_max = np.array([CARGO_PROFILES[c][1] for c in cargo_types], dtype=float)

# Temperature: mostly within safe range with realistic excursions
temp_base = (safe_temp_min + safe_temp_max) / 2
temp_noise = rng.normal(0, 2.5, N)
temperature = np.clip(temp_base + temp_noise, safe_temp_min - 8, safe_temp_max + 12)

# Excursion magnitude: how far above safe max (clamp to 0 if within range)
temp_excursion_magnitude = np.maximum(0, temperature - safe_temp_max)
# Add a few below-min excursions (freezer burn) for frozen cargo
below_min = np.maximum(0, safe_temp_min - temperature)
temp_excursion_magnitude = np.maximum(temp_excursion_magnitude, below_min * 0.6)

# Excursion duration (minutes): correlated with excursion magnitude
excursion_duration_base = temp_excursion_magnitude * rng.uniform(3, 8, N)
excursion_duration_min = np.clip(excursion_duration_base + rng.exponential(10, N), 0, 180)
# Zero duration if no excursion
excursion_duration_min = np.where(temp_excursion_magnitude < 0.1, 0, excursion_duration_min)

# Humidity
humidity = np.clip(rng.normal(65, 15, N), 30, 98)

# Delay in minutes
delay_prob = rng.random(N)
delay_minutes = np.where(
    delay_prob < 0.3,
    rng.uniform(0, 15, N),           # short delay
    np.where(
        delay_prob < 0.7,
        rng.uniform(15, 60, N),      # moderate delay
        rng.uniform(60, 180, N)      # long delay
    )
)
delay_minutes = np.clip(delay_minutes, 0, 240)

# Remaining transit time
remaining_transit_min = rng.uniform(15, 240, N)

# Route risk (0–1)
route_risk = np.clip(rng.beta(2, 4, N), 0.05, 0.95)

# Traffic level (1=low, 2=medium, 3=high)
traffic_level = rng.choice([1, 2, 3], N, p=[0.4, 0.35, 0.25])

# Handling events (0–5)
handling_events = rng.choice([0, 1, 2, 3, 4, 5], N, p=[0.5, 0.25, 0.12, 0.07, 0.04, 0.02])

# Refrigeration condition (1=good, 2=degraded, 3=failed)
refrigeration_condition = rng.choice([1, 2, 3], N, p=[0.70, 0.22, 0.08])

# Distance
distance_km = rng.uniform(50, 600, N)

# -----------------------------------------------
# TARGET: spoilage_event = 1 if conditions are bad
# -----------------------------------------------
# Each risk factor contributes to a latent risk score
# Calibrated so that spoilage rate is ~40-50% in the dataset
latent_risk = (
    1.5 * temp_excursion_magnitude                  # strongest predictor
    + 0.018 * excursion_duration_min                # cumulative exposure
    + 0.5 * (cargo_sensitivity - 1)                 # sensitive cargo
    + 0.7 * (refrigeration_condition - 1)           # fridge degradation
    + 0.25 * np.log1p(delay_minutes) * (1 + 0.2 * (cargo_sensitivity - 1))
    + 0.25 * route_risk * 3
    + 0.12 * (traffic_level - 1)
    + 0.15 * handling_events
    + 0.002 * remaining_transit_min                 # longer remaining -> more risk
    + 0.001 * humidity                              # humidity matters
    - 1.8                                           # base offset (calibrates to ~45% positive)
    + rng.normal(0, 0.4, N)                        # irreducible noise
)

# Convert to probability via sigmoid
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

spoilage_prob = sigmoid(latent_risk)
spoilage_event = (rng.random(N) < spoilage_prob).astype(int)

df = pd.DataFrame({
    "temperature": np.round(temperature, 2),
    "temp_excursion_magnitude": np.round(temp_excursion_magnitude, 2),
    "excursion_duration_min": np.round(excursion_duration_min, 1),
    "humidity": np.round(humidity, 1),
    "delay_minutes": np.round(delay_minutes, 1),
    "remaining_transit_min": np.round(remaining_transit_min, 1),
    "cargo_sensitivity": cargo_sensitivity,
    "route_risk": np.round(route_risk, 3),
    "traffic_level": traffic_level,
    "handling_events": handling_events,
    "refrigeration_condition": refrigeration_condition,
    "distance_km": np.round(distance_km, 1),
    "cargo_type_encoded": cargo_types,
    "spoilage_event": spoilage_event,
})

output_path = Path(__file__).parent / "cold_chain_dataset.csv"
df.to_csv(output_path, index=False)

print(f"Dataset generated: {len(df)} records")
print(f"Spoilage rate: {df['spoilage_event'].mean():.1%}")
print(f"Saved to: {output_path}")
print("\nFeature summary:")
print(df.describe().round(2).to_string())
