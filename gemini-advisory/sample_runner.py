from gemini_advisory import generate_advisory

def run_sample():
    # Scenario A: Fungal Blast Outbreak under Damp conditions (High Confidence)
    scenario_a = {
        "disease_label": "blast",
        "confidence": 0.94,
        "temperature": 28.5,
        "humidity": 88.0,
        "soil_moisture": 65.0,
        "risk_score": 85.0,
        "risk_level": "Critical",
        "risk_reasons": [
            "Visual analysis identified 'blast' disease with 94.0% confidence.",
            "High humidity levels detected (88.0%) creating ideal spore germination conditions."
        ]
    }

    # Scenario B: Weak Fungal Detection (Low Confidence)
    scenario_b = {
        "disease_label": "brown_spot",
        "confidence": 0.45,
        "temperature": 26.0,
        "humidity": 75.0,
        "soil_moisture": 30.0,
        "risk_score": 45.0,
        "risk_level": "Medium",
        "risk_reasons": [
            "Visual analysis identified 'brown_spot' symptoms with low 45.0% confidence.",
            "Dry soil moisture levels (30.0%) causing physical water stress."
        ]
    }

    print("==================================================")
    print("        RUNNING ADVISORY MODULE TEST CASES        ")
    print("==================================================")

    # 1. Execute Scenario A
    print("\nExecuting Scenario A: High-Confidence Blast Outbreak")
    res_a = generate_advisory(**scenario_a)
    print(f"Metadata Mode: {res_a['metadata']['mode']}")
    print("-" * 50)
    print(res_a["advisory_markdown"])
    print("==================================================")

    # 2. Execute Scenario B
    print("\nExecuting Scenario B: Low-Confidence Brown Spot")
    res_b = generate_advisory(**scenario_b)
    print(f"Metadata Mode: {res_b['metadata']['mode']}")
    print("-" * 50)
    print(res_b["advisory_markdown"])
    print("==================================================")

if __name__ == "__main__":
    run_sample()
