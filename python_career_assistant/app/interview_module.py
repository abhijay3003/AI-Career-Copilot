import json
import logging
from .rag_pipeline import query_gemini_api

def generate_interview_questions(resume_text: str, jd_text: str) -> list:
    """Generates technical, behavioral/HR, and project-based questions complete with answers."""
    system_prompt = (
        "You are a Senior Corporate Interviewer. Your task is to extract exactly 3 practice interview "
        "questions based on the overlap between the resume and the target Role Job Description: "
        "- Level 1: Standard technical skills question based on requirements\n"
        "- Level 2: HR/Behavioral question using the STAR method\n"
        "- Level 3: Project-based scenario tailored to experiences listed in the resume\n"
        "Provide a detailed, high-scoring model answer for each question. "
        "Format the result strictly as a valid parseable JSON list of objects matching this exact schema: "
        '[{"id": "q1", "type": "technical", "question": "Question 1", "model_answer": "Model Answer 1"}, '
        '{"id": "q2", "type": "hr", "question": "Question 2", "model_answer": "Model Answer 2"}, '
        '{"id": "q3", "type": "project", "question": "Question 3", "model_answer": "Model Answer 3"}]'
    )

    user_prompt = f"Resume:\n{resume_text}\n\nJob Description:\n{jd_text}"
    raw_response = query_gemini_api(user_prompt, system_instruction=system_prompt, response_mime_type="application/json")

    try:
        start_idx = raw_response.find('[')
        end_idx = raw_response.rfind(']')
        if start_idx != -1 and end_idx != -1:
            clean_json = raw_response[start_idx:end_idx+1]
            return json.loads(clean_json)
        return json.loads(raw_response)
    except Exception as e:
        logging.warning(f"Could not convert Gemini answers to structured interview JSON, doing fallbacks: {e}")

    # Solid Fallbacks matching expected schema
    return [
        {
            "id": "q1",
            "type": "technical",
            "question": "Can you elaborate on your experience with system architecture and modular service designs?",
            "model_answer": "Explain the exact lifecycle, microservices constraints, database selection (PostgreSQL/MySQL), and caching layers like Redis."
        },
        {
            "id": "q2",
            "type": "hr",
            "question": "Describe a scenario where you resolved a priority conflict with a product stakeholder.",
            "model_answer": "Use STAR: Situation (describe project), Task (goals alignment), Action (collaborative consensus), and Result (delivery on schedule)."
        },
        {
            "id": "q3",
            "type": "project",
            "question": "Based on your project experience, how would you design a scalable data ingestion queue?",
            "model_answer": "Specify message queues (Kafka/RabbitMQ), partitioning, backpressure strategies, and eventual persistence states."
        }
    ]

def evaluate_mock_response(question_text: str, model_answer: str, user_answer: str) -> str:
    """Critiques mock answers and gives optimization instructions based on the STAR approach."""
    system_prompt = (
        "You are an empathetic, insightful executive career coach. "
        "Review the candidate's answer against the interview question and the model answer. "
        "Point out: 1) Strengths in their phrasing, 2) Missing crucial keywords or metrics, "
        "3) Direct rewrite ideas. Keep suggestions brief, constructive, and actionable in markdown format."
    )
    
    user_prompt = (
        f"Question: {question_text}\n"
        f"Model Expected: {model_answer}\n"
        f"Candidate Submission: {user_answer}"
    )
    
    return query_gemini_api(user_prompt, system_instruction=system_prompt)

