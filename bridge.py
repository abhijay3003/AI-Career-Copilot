import sys
import json
import os

# Put the python_career_assistant and its app folder in the search directories
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(base_dir, "python_career_assistant"))

def get_match_module():
    try:
        from app.match_module import analyze_resume_matching
        return analyze_resume_matching
    except ImportError:
        sys.path.insert(0, base_dir)
        from python_career_assistant.app.match_module import analyze_resume_matching
        return analyze_resume_matching

def get_optimize_module():
    try:
        from app.optimize_module import optimize_bullet_points
        return optimize_bullet_points
    except ImportError:
        sys.path.insert(0, base_dir)
        from python_career_assistant.app.optimize_module import optimize_bullet_points
        return optimize_bullet_points

def get_interview_module():
    try:
        from app.interview_module import generate_interview_questions, evaluate_mock_response
        return generate_interview_questions, evaluate_mock_response
    except ImportError:
        sys.path.insert(0, base_dir)
        from python_career_assistant.app.interview_module import generate_interview_questions, evaluate_mock_response
        return generate_interview_questions, evaluate_mock_response

def get_rag_pipeline():
    try:
        from app.rag_pipeline import RAGPipeline
        return RAGPipeline
    except ImportError:
        sys.path.insert(0, base_dir)
        from python_career_assistant.app.rag_pipeline import RAGPipeline
        return RAGPipeline

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command argument passed to Python bridge."}))
        return

    command = sys.argv[1]
    
    try:
        if command == "match":
            analyze_resume_matching = get_match_module()
            args = json.loads(sys.argv[2])
            res = analyze_resume_matching(args["resume"], args["jd"])
            print(json.dumps(res))
            
        elif command == "optimize":
            optimize_bullet_points = get_optimize_module()
            args = json.loads(sys.argv[2])
            res = optimize_bullet_points(args["bullets"], args["jd"])
            print(json.dumps(res))
            
        elif command == "interview":
            generate_interview_questions, _ = get_interview_module()
            args = json.loads(sys.argv[2])
            res = generate_interview_questions(args["resume"], args["jd"])
            print(json.dumps(res))
            
        elif command == "evaluate":
            _, evaluate_mock_response = get_interview_module()
            args = json.loads(sys.argv[2])
            res = evaluate_mock_response(args["question"], args.get("model_answer", ""), args["user_answer"])
            print(json.dumps({"critique": res}))
            
        elif command == "chat":
            RAGPipeline = get_rag_pipeline()
            args = json.loads(sys.argv[2])
            pipeline = RAGPipeline()
            pipeline.index_document(args["context"])
            res = pipeline.search_and_chat(args["query"])
            print(json.dumps({"text": res}))
            
        elif command == "parse_pdf":
            import base64
            import tempfile
            from pypdf import PdfReader
            args = json.loads(sys.argv[2])
            b64_data = args["fileBase64"]
            
            pdf_data = base64.b64decode(b64_data)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(pdf_data)
                tmp_path = tmp.name
                
            try:
                reader = PdfReader(tmp_path)
                text = ""
                for page in reader.pages:
                    text_content = page.extract_text()
                    if text_content:
                        text += text_content + "\n"
                print(json.dumps({"text": text.strip()}))
            finally:
                if os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass
            
        else:
            print(json.dumps({"error": f"Command '{command}' is not supported by Python bridge application."}))
            
    except Exception as e:
        import traceback
        print(json.dumps({
            "error": str(e), 
            "traceback": traceback.format_exc()
        }))

if __name__ == "__main__":
    main()
