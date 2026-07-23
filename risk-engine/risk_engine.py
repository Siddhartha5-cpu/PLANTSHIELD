import config

def calculate_risk(
    disease_label: str,
    disease_confidence: float,
    temperature: float,
    humidity: float,
    soil_moisture: float,
    recent_trends: dict = None
) -> dict:
    """
    Computes a crop health risk score (0-100) and risk category level (Low-Critical)
    using rule-based logic combining leaf diagnostics and environmental parameters.
    
    Args:
        disease_label (str): Name of the predicted disease (e.g. 'brown_spot')
        disease_confidence (float): Probability score from AI model (0.0 to 1.0)
        temperature (float): Ambient air temperature in °C
        humidity (float): Relative air humidity percentage
        soil_moisture (float): Soil moisture percentage
        recent_trends (dict, optional): Historical indicators (e.g., {'humidity_trend': 'rising'})
        
    Returns:
        dict: Structured risk report containing score, level, and analytical reasonings.
    """
    reasons = []
    
    # -------------------------------------------------------------------------
    # 1. Disease Risk Component (D)
    # -------------------------------------------------------------------------
    base_severity = config.DISEASE_SEVERITY.get(disease_label.lower(), 50)
    
    if disease_label.lower() == "normal":
        disease_score = 0.0
    else:
        # Scale severity based on model classification confidence
        disease_score = base_severity * disease_confidence
        reasons.append(
            f"Visual analysis identified '{disease_label}' disease with "
            f"{disease_confidence * 100:.1f}% confidence (Base Severity: {base_severity}/100)."
        )

    # -------------------------------------------------------------------------
    # 2. Environmental Stress Component (E)
    # -------------------------------------------------------------------------
    humidity_stress = 0.0
    temp_stress = 0.0
    moisture_stress = 0.0

    # A. Humidity Stress rules
    if humidity >= config.THRESHOLDS["extreme_humidity"]:
        humidity_stress = 100.0
        reasons.append(
            f"Critical relative humidity detected ({humidity:.1f}%), creating "
            f"an extreme spore-germination acceleration environment."
        )
    elif humidity >= config.THRESHOLDS["high_humidity"]:
        humidity_stress = 75.0
        reasons.append(
            f"High humidity level detected ({humidity:.1f}%), promoting bacterial/fungal breeding."
        )
    
    # B. Temperature Stress rules
    if temperature >= config.THRESHOLDS["extreme_temp_high"]:
        temp_stress = 100.0
        reasons.append(
            f"Extreme high temperature ({temperature:.1f}°C) is causing physiological plant shock."
        )
    elif temperature <= config.THRESHOLDS["extreme_temp_low"]:
        temp_stress = 100.0
        reasons.append(
            f"Extreme low temperature ({temperature:.1f}°C) is causing thermal crop stress."
        )
    elif config.THRESHOLDS["incubation_temp_min"] <= temperature <= config.THRESHOLDS["incubation_temp_max"]:
        temp_stress = 80.0
        reasons.append(
            f"Temperature ({temperature:.1f}°C) is within the optimal pathogens "
            f"incubation window ({config.THRESHOLDS['incubation_temp_min']}°C - {config.THRESHOLDS['incubation_temp_max']}°C)."
        )
        
    # C. Soil Moisture Stress rules
    if soil_moisture <= config.THRESHOLDS["dry_soil_threshold"]:
        moisture_stress = 80.0
        reasons.append(
            f"Dry soil detected ({soil_moisture:.1f}%), triggering drought stress "
            f"and raising general vulnerability to infections."
        )
    elif soil_moisture >= config.THRESHOLDS["flooded_soil_threshold"]:
        moisture_stress = 50.0
        reasons.append(
            f"Oversaturated soil detected ({soil_moisture:.1f}%), raising risks of "
            f"root hypoxia (suffocation) and crown rot."
        )

    # Average the active environment stress parameters to establish environmental stress component (E)
    env_score = (humidity_stress + temp_stress + moisture_stress) / 3.0
    
    if env_score > 0:
        reasons.append(
            f"Aggregated environmental stress score calculated at {env_score:.1f}/100."
        )

    # -------------------------------------------------------------------------
    # 3. Trend Adjustments (T)
    # -------------------------------------------------------------------------
    trend_offset = 0.0
    if recent_trends:
        # Check if humidity is rising and already damp
        if recent_trends.get("humidity_trend") == "rising" and humidity >= config.THRESHOLDS["high_humidity"]:
            offset = config.TREND_ADJUSTMENTS["humidity_rising_offset"]
            trend_offset += offset
            reasons.append(
                f"Recent sensor telemetry logs show escalating relative humidity, adding a +{offset} risk penalty."
            )
            
        # Check if soil moisture is falling and already dry
        if recent_trends.get("moisture_trend") == "falling" and soil_moisture <= config.THRESHOLDS["dry_soil_threshold"]:
            offset = config.TREND_ADJUSTMENTS["soil_moisture_dropping_offset"]
            trend_offset += offset
            reasons.append(
                f"Recent telemetry indicates accelerating soil moisture drop in dry ground, adding a +{offset} risk penalty."
            )

    # -------------------------------------------------------------------------
    # 4. Final Aggregation and Clamping
    # -------------------------------------------------------------------------
    disease_weighted = disease_score * config.WEIGHTS["disease"]
    env_weighted = env_score * config.WEIGHTS["environment"]
    
    cumulative_score = disease_weighted + env_weighted + trend_offset
    
    # Clamp score strictly between 0 and 100
    final_score = max(0.0, min(100.0, cumulative_score))

    # -------------------------------------------------------------------------
    # 5. Risk Category Level Classification
    # -------------------------------------------------------------------------
    risk_level = "Critical"
    if final_score < config.RISK_LEVEL_BOUNDARIES["Low"]:
        risk_level = "Low"
    elif final_score < config.RISK_LEVEL_BOUNDARIES["Medium"]:
        risk_level = "Medium"
    elif final_score < config.RISK_LEVEL_BOUNDARIES["High"]:
        risk_level = "High"

    if final_score >= 50.0 and disease_label.lower() == "normal":
        reasons.append(
            "Note: Although the leaf sample appears healthy, severe environmental stress "
            "attributes have escalated the overall crop risk rating."
        )

    return {
        "risk_score": round(final_score, 2),
        "risk_level": risk_level,
        "risk_reasons": reasons,
        "details": {
            "disease_raw_score": round(disease_score, 2),
            "disease_weighted_contribution": round(disease_weighted, 2),
            "environmental_raw_score": round(env_score, 2),
            "environmental_weighted_contribution": round(env_weighted, 2),
            "trend_adjustment_applied": round(trend_offset, 2)
        }
    }
