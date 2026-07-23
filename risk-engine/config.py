# Risk Calculation Configuration Rules
# Modifying these values updates the risk analysis thresholds and severity ratings.

# 1. Base Severity Ratings for Paddy Doctor dataset categories (out of 100)
# High ratings imply fast-spreading or destructive pathogens.
DISEASE_SEVERITY = {
    "normal": 0,
    "bacterial_leaf_blight": 85,
    "bacterial_leaf_streak": 60,
    "bacterial_panicle_blight": 90,
    "blast": 80,
    "brown_spot": 70,
    "dead_heart": 75,
    "downy_mildew": 65,
    "hispa": 45,
    "tungro": 95
}

# 2. Risk Component Weight Mappings
# Mapped weights must sum to exactly 1.0 (100%)
WEIGHTS = {
    "disease": 0.60,       # Importance weight for visual leaf diagnostic results
    "environment": 0.40    # Importance weight for active ambient environmental sensors
}

# 3. Environmental Sensor Threshold Definitions
THRESHOLDS = {
    # Humidity (%)
    "high_humidity": 80.0,            # Favorable for fungal spore germination
    "extreme_humidity": 90.0,         # Critical wetness levels
    
    # Temperature (°C)
    "incubation_temp_min": 25.0,      # Ideal growth acceleration floor
    "incubation_temp_max": 32.0,      # Ideal growth acceleration ceiling
    "extreme_temp_low": 15.0,         # Cold stress to paddy plant
    "extreme_temp_high": 38.0,        # Heat stress to paddy plant
    
    # Soil Moisture (%)
    "dry_soil_threshold": 35.0,       # Drought stress boundary
    "flooded_soil_threshold": 80.0    # Oversaturation/root-rot hazard boundary
}

# 4. Score Adjustments based on Telemetry History Trends
# Offset value added/subtracted directly from the cumulative risk score (max offset +/- 10)
TREND_ADJUSTMENTS = {
    "humidity_rising_offset": 5.0,       # Humidity rising implies increasing dampness
    "soil_moisture_dropping_offset": 5.0  # Rapid dryout stresses the root systems
}

# 5. Risk Category Classification Boundaries (out of 100)
# score < boundary => assigned to that category
RISK_LEVEL_BOUNDARIES = {
    "Low": 25.0,        # Under 25
    "Medium": 55.0,     # 25 to 54.9
    "High": 80.0        # 55 to 79.9
    # Critical          # 80 and above
}
