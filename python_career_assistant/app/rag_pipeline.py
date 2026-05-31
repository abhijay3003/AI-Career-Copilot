import requests
import json
import logging
import os

def query_gemini_api(prompt: str, system_instruction: str = None, response_mime_type: str = None) -> str:
    """Queries Ollama locally/remotely instead of Gemini, requiring no API keys."""
    # Find active Ollama settings
    ollama_host = os.environ.get("OLLAMA_BASE_URL") or os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
    if not ollama_host.endswith("/"):
        ollama_host = ollama_host + "/"
    
    url = f"{ollama_host}api/generate"
    model = os.environ.get("OLLAMA_MODEL") or "llama3"

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }

    if system_instruction:
        payload["system"] = system_instruction

    if response_mime_type == "application/json":
        payload["format"] = "json"

    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
        if response.status_code == 200:
            res_json = response.json()
            return res_json.get("response", "")
        else:
            logging.error(f"Ollama API returned HTTP {response.status_code}: {response.text}")
            return f"Error: Ollama returned HTTP {response.status_code}. Make sure Ollama is running and model '{model}' is pulled."
    except Exception as e:
        logging.error(f"HTTP request to Ollama failed: {e}")
        # Standard warning instruction on how to resolve the failure locally
        if response_mime_type == "application/json":
            return json.dumps({
                "error": f"Failed to connect to Ollama at {ollama_host}. Make sure Ollama is installed and running with command: 'ollama run {model}'",
                "score": 0,
                "matching_skills": [],
                "missing_skills": [],
                "suggestions": ["Ensure Ollama is running on port 11434 before launching analyses."],
                "ats_report": f"🔴 **Could not connect to local Ollama server**\n\nPlease launch Ollama with:\n`ollama run {model}`\non your local machine. Ensure base port `11434` is reachable."
            })
        return f"Failed to connect to local Ollama instance at {ollama_host}. Please start it using 'ollama run {model}' on your machine."

class RAGPipeline:
    """RAG pipeline combining document parsing and direct remote Gemini processing with active context injection."""
    
    def __init__(self):
        self.doc_text = ""

    def index_document(self, doc_text: str):
        """Stores the text index for context retrieval."""
        self.doc_text = doc_text
        logging.info(f"Indexed document text of length {len(doc_text)} in Python RAG engine.")
        return True

    def retrieve_context(self, query: str, k: int = 3) -> str:
        """Retrieves matching context sections. Under Gemini's large context limit, we return the entire text."""
        return self.doc_text

    def query_ollama(self, system_prompt: str, user_prompt: str) -> str:
        """Delegates query directly to the high-performance Gemini API to ensure instant, stable results."""
        return query_gemini_api(prompt=user_prompt, system_instruction=system_prompt)

    def search_and_chat(self, user_query: str, system_override: str = None) -> str:
        """Retrieves context and chats with Gemini."""
        context = self.retrieve_context(user_query)
        
        system_prompt = system_override or (
            "You are an elegant AI Career Advisor. Answer the candidate's query "
            "strictly using the retrieved context sections from their resume or target job description. "
            "If the answer is not present in the context, do your best using candidate goals or ask for more facts."
        )
        
        user_prompt = f"Retrieved Context:\n{context}\n\nUser Question:\n{user_query}"
        return self.query_ollama(system_prompt, user_prompt)

