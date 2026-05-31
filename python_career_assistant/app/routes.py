from flask import Blueprint, request, jsonify, current_app
import os
import logging
from werkzeug.utils import secure_filename
from .database import save_document, save_match_result, save_interview_log
from .match_module import analyze_resume_matching
from .optimize_module import optimize_bullet_points
from .interview_module import generate_interview_questions, evaluate_mock_response
from .rag_pipeline import RAGPipeline

main_bp = Blueprint('main', __name__)

# Temporary in-memory global cache for simplicity if DB is down
SESSION_STORE = {
    "resume_text": "",
    "jd_text": "",
    "resume_name": "No file uploaded",
    "jd_name": "No description loaded"
}

@main_bp.route('/api/status', methods=['GET'])
def get_status():
    """System health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "AI Career Assistant Backend",
        "has_resume": bool(SESSION_STORE["resume_text"]),
        "has_jd": bool(SESSION_STORE["jd_text"])
    })

@main_bp.route('/api/upload-resume', methods=['POST'])
def upload_resume():
    """Endpoints interface to upload PDF or text resumes."""
    # Text input fallback
    data = request.get_json() or {}
    if 'text' in data:
        SESSION_STORE["resume_text"] = data['text']
        SESSION_STORE["resume_name"] = "copied_resume.txt"
        save_document(user_id=1, doc_type='resume', file_name="copied_resume.txt", raw_text=data['text'])
        return jsonify({"message": "Text resume registered successfully.", "text_length": len(data['text'])})

    # PDF File uploads
    if 'file' not in request.files:
        return jsonify({"error": "No file content submitted"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Filename is empty"}), 400

    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # PDF extraction using pyPDF
        from pypdf import PdfReader
        try:
            reader = PdfReader(filepath)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            
            SESSION_STORE["resume_text"] = text
            SESSION_STORE["resume_name"] = filename
            
            # Persist upload event
            save_document(user_id=1, doc_type='resume', file_name=filename, raw_text=text)
            
            return jsonify({
                "message": f"Successfully parsed {filename}",
                "text_length": len(text)
            })
        except Exception as e:
            logging.error(f"Failed to read PDF payload: {e}")
            return jsonify({"error": f"Failed to extract document contents: {str(e)}"}), 500

    return jsonify({"error": "Invalid file type. Please upload a PDF resume."}), 400

@main_bp.route('/api/upload-jd', methods=['POST'])
def upload_jd():
    """Upload or paste a target Job Description."""
    data = request.get_json() or {}
    if 'text' not in data:
        return jsonify({"error": "No text content submitted"}), 400

    SESSION_STORE["jd_text"] = data['text']
    SESSION_STORE["jd_name"] = data.get('title', 'Target Role Description')
    save_document(user_id=1, doc_type='jd', file_name=SESSION_STORE["jd_name"], raw_text=data['text'])

    return jsonify({
        "message": "Job description loaded successfully.",
        "text_length": len(data['text'])
    })

@main_bp.route('/api/match', methods=['POST'])
def match_resume():
    """Prepares and retrieves match score calculations."""
    resume_text = SESSION_STORE["resume_text"]
    jd_text = SESSION_STORE["jd_text"]

    if not resume_text or not jd_text:
        return jsonify({"error": "Please configure both resume and job description first!"}), 400

    result = analyze_resume_matching(resume_text, jd_text)
    
    # Save statistics history
    save_match_result(
        user_id=1,
        resume_id=1,
        jd_id=2,
        score=result.get("score", 70),
        matching_skills=result.get("matching_skills", []),
        missing_skills=result.get("missing_skills", []),
        suggestions="\n".join(result.get("suggestions", []))
    )

    return jsonify(result)

@main_bp.route('/api/optimize', methods=['POST'])
def optimize_resume_bullets():
    """Optimizes bullet statements targeting keyword-match parameters."""
    data = request.get_json() or {}
    bullets = data.get("bullets", [])
    jd_text = SESSION_STORE["jd_text"] or "Software engineer with metrics accountability."

    if not bullets:
        return jsonify({"error": "Provide a list of bullets under 'bullets'."}), 400

    result = optimize_bullet_points(bullets, jd_text)
    return jsonify({"optimized_bullets": result})

@main_bp.route('/api/interview-questions', methods=['POST'])
def get_interview_prep():
    """Fetches custom tailored questions with answers."""
    resume_text = SESSION_STORE["resume_text"]
    jd_text = SESSION_STORE["jd_text"]

    if not resume_text or not jd_text:
        return jsonify({"error": "Please upload a resume and job description first"}), 400

    questions = generate_interview_questions(resume_text, jd_text)
    return jsonify({"questions": questions})

@main_bp.route('/api/interview-evaluate', methods=['POST'])
def post_evaluate_answer():
    """Evaluates mock response submissions and critiques candidates."""
    data = request.get_json() or {}
    question_text = data.get("question")
    model_answer = data.get("model_answer")
    user_answer = data.get("user_answer")

    if not question_text or not user_answer:
        return jsonify({"error": "Query parameters 'question' and 'user_answer' are required."}), 400

    critique = evaluate_mock_response(question_text, model_answer or "", user_answer)
    save_interview_log(user_id=1, question_type="evaluation", question_text=question_text, model_answer=model_answer or "", user_answer=user_answer, critique=critique)

    return jsonify({"critique": critique})

@main_bp.route('/api/chat', methods=['POST'])
def chat_document():
    """Executes RAG Q&A chat loop."""
    data = request.get_json() or {}
    query = data.get("query")
    scope = data.get("scope", "resume") # resume, jd, or joint

    if not query:
        return jsonify({"error": "User 'query' parameter is required."}), 400

    resume_text = SESSION_STORE["resume_text"]
    jd_text = SESSION_STORE["jd_text"]

    context_source = ""
    if scope == "resume":
        context_source = resume_text
    elif scope == "jd":
        context_source = jd_text
    else:
        context_source = resume_text + "\n" + jd_text

    if not context_source.strip():
        return jsonify({"error": "Select a scope that has been uploaded first!"}), 400

    pipeline = RAGPipeline()
    pipeline.index_document(context_source)
    
    response_text = pipeline.search_and_chat(query)
    return jsonify({"response": response_text})
