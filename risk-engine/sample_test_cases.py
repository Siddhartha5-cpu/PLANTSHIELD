import json
from risk_engine import calculate_risk

def run_tests():
    test_cases = [
        {
            "name": "Case 1: Healthy Crop under Optimal Conditions",
            "inputs": {
                "disease_label": "normal",
                "disease_confidence": 0.99,
                "temperature": 24.0,
                "humidity": 60.0,
                "soil_moisture": 55.0,
                "recent_trends": None
            }
        },
        {
            "name": "Case 2: Dry Drought Stress (Healthy Leaf, stressed soil)",
            "inputs": {
                "disease_label": "normal",
                "disease_confidence": 0.95,
                "temperature": 35.0,
                "humidity": 40.0,
                "soil_moisture": 25.0,
                "recent_trends": {"moisture_trend": "falling"}
            }
        },
        {
            "name": "Case 3: Emerging Blast Infection under Damp Conditions",
            "inputs": {
                "disease_label": "blast",
                "disease_confidence": 0.65,
                "temperature": 28.0,
                "humidity": 85.0,
                "soil_moisture": 45.0,
                "recent_trends": None
            }
        },
        {
            "name": "Case 4: Severe Tungro Fungal Outbreak (Critical environment)",
            "inputs": {
                "disease_label": "tungro",
                "disease_confidence": 0.92,
                "temperature": 29.5,
                "humidity": 92.0,
                "soil_moisture": 50.0,
                "recent_trends": {"humidity_trend": "rising"}
            }
        },
        {
            "name": "Case 5: Unclear Brown Spot detection under Safe Environment",
            "inputs": {
                "disease_label": "brown_spot",
                "disease_confidence": 0.40,
                "temperature": 20.0,
                "humidity": 55.0,
                "soil_moisture": 50.0,
                "recent_trends": None
            }
        }
    ]

    print("==================================================")
    print("        RUNNING RISK ENGINE TEST SCENARIOS        ")
    print("==================================================")

    for i, tc in enumerate(test_cases, 1):
        print(f"\n[Test Case {i}] {tc['name']}")
        print(f"Inputs: Disease={tc['inputs']['disease_label']} (Conf={tc['inputs']['disease_confidence']*100:.0f}%), "
              f"Temp={tc['inputs']['temperature']}°C, Humid={tc['inputs']['humidity']}%, "
              f"Moisture={tc['inputs']['soil_moisture']}%")
        
        result = calculate_risk(**tc["inputs"])
        
        print(f"Resulting Score: {result['risk_score']} / 100")
        print(f"Resulting Level: {result['risk_level']}")
        print("Reasons Listed:")
        for reason in result["risk_reasons"]:
            print(f"  - {reason}")
        print("Raw JSON Details:")
        print(json.dumps(result["details"], indent=4))
        print("-" * 50)

if __name__ == "__main__":
    run_tests()
