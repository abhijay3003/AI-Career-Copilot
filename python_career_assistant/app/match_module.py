import json
import logging
from .rag_pipeline import query_gemini_api

def analyze_resume_matching(resume_text: str, jd_text: str) -> dict:
    """Uses the Gemini API and smart scoring template to analyze fit and retrieve JSON match results."""
    system_prompt = (
        "You are an expert HR Executive and ATS (Applicant Tracking System) parser. "
        "Your task is to thoroughly analyze the candidate resume against the Job Description (JD). "
        "Determine the overall ATS match percentage from 0 to 100 based on exact skills requirements, "
        "extract matching skills, identify missing crucial skills, and provide specific bullet-point improvement advice. "
        "You MUST return your output strictly as a JSON object matching this exact schema: "
        '{"score": <integer 0-100>, "matching_skills": ["Skill1", "Skill2"], "missing_skills": ["Skill3"], '
        '"suggestions": ["Suggestion 1", "Suggestion 2"]}'
    )

    user_prompt = f"Target Job Description:\n{jd_text}\n\nCandidate Resume details:\n{resume_text}"
    
    # Query Gemini in JSON mode
    raw_response = query_gemini_api(user_prompt, system_instruction=system_prompt, response_mime_type="application/json")
    
    try:
        # Secure JSON loading
        start_idx = raw_response.find('{')
        end_idx = raw_response.rfind('}')
        if start_idx != -1 and end_idx != -1:
            clean_json = raw_response[start_idx:end_idx+1]
            return json.loads(clean_json)
        return json.loads(raw_response)
    except Exception as e:
        logging.warning(f"Failed to parse strict JSON from Gemini: {e}")
    
    # Static algorithmic score calculations if model parsing fails
    score = calculate_keyword_match_score(resume_text, jd_text)
    return {
        "score": score,
        "matching_skills": ["Technical Skillset", "Analyzed Keywords"],
        "missing_skills": ["Review JD description for specific requirements"],
        "suggestions": ["Align resume formatting", "Integrate metrics with standard bullet templates (XYZ)."]
    }

def calculate_keyword_match_score(resume: str, jd: str) -> int:
    """Fallback Jaccard similarity word counter for ATS scoring."""
    r_words = set(resume.lower().split())
    j_words = set(jd.lower().split())
    intersection = r_words.intersection(j_words)
    if not j_words:
        return 0
    return int((len(intersection) / len(j_words)) * 100)

