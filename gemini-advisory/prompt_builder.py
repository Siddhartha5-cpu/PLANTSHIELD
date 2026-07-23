def build_advisory_prompt(
    disease_label: str,
    confidence: float,
    temperature: float,
    humidity: float,
    soil_moisture: float,
    risk_score: float,
    risk_level: str,
    risk_reasons: list
) -> str:
    """
    Assembles a highly structured text prompt for Google Gemini, passing
    diagnostics parameters, sensors parameters, and risk logs.
    
    Ensures outputs are farmer-friendly, non-hallucinated, and highlight confidence levels.
    """
    
    # 1. Base details description
    context = (
        f"Diagnosed Leaf Symptom: '{disease_label}' (AI Confidence: {confidence * 100:.1f}%)\n"
        f"Active Crop Risk Level: {risk_level} (Calculated Risk Rating: {risk_score}/100)\n"
        f"Risk Engine Findings:\n"
    )
    
    for reason in risk_reasons:
        context += f"- {reason}\n"
        
    context += (
        f"\nCurrent Ambient Telemetry Sensors:\n"
        f"- Air Temperature: {temperature:.1f}°C\n"
        f"- Relative Air Humidity: {humidity:.1f}%\n"
        f"- Soil Moisture: {soil_moisture:.1f}%\n"
    )

    # 2. Add dynamic warnings for low classification confidence
    low_confidence_clause = ""
    if confidence < 0.60:
        low_confidence_clause = (
            "IMPORTANT: The image analysis confidence is very low. You MUST append an explicit warning "
            "note at the absolute beginning of your response telling the farmer to verify this disease physically "
            "with a local extension officer before buying treatments, because the computer model is uncertain.\n"
        )

    # 3. System guidelines and constraints
    system_instructions = (
        "You are an expert, empathetic agricultural agronomist and plant pathologist.\n"
        "Analyze the crop diagnostics and environmental sensors data above, and generate a brief, "
        "farmer-friendly advisory in clear English.\n\n"
        "Rules:\n"
        "1. Do NOT suggest specific chemical brands or invent/hallucinate pesticide formulas unless widely recommended.\n"
        "2. Do NOT claim absolute diagnostic certainty. Use terms like 'shows symptoms of' or 'likely risk'.\n"
        "3. Keep the output extremely structured, brief, and bulleted. Use simple words suitable for farmers.\n"
        "4. Output exactly 4 sections in Markdown format:\n"
        "   ### 🌾 Crop Condition Summary\n"
        "   (A plain-language summary of what is happening to the plant under these current sensor conditions)\n"
        "   ### ⚠️ Likely Concerns\n"
        "   (Explanation of how the current microclimate environment, like high humidity or dry soil, accelerates the disease)\n"
        "   ### 🛠️ Immediate Next Actions\n"
        "   (Immediate mechanical, watering, or crop isolation tasks the farmer should do today)\n"
        "   ### 🛡️ Preventive Recommendations\n"
        "   (Long-term precautions, like seed selections or soil aeration, to prevent future outbreaks)\n"
    )

    # Combine all parts
    prompt = f"{system_instructions}\n{low_confidence_clause}Input context:\n---\n{context}\n---"
    
    return prompt
