# AI Career Assistant: End-to-End Production Stack

This directory contains the production-grade Python (Flask), LangChain, Ollama (Llama 3), FAISS, MySQL, and Docker codebase for the **AI Career Assistant**. 

## 1. Project Architecture

The application is structured as a full-stack containerized service. 

```
                                      +--------------------------+
                                      |    Client (Web UI)       |
                                      +-------------+------------+
                                                    | (REST API)
                                                    v
                                      +-------------+------------+
                                      |    Flask Backend App     |
                                      |      (Port 5000)         |
                                      +------+--------+-------+--+
                                             |        |       |
                 +---------------------------+        |       +-------------------------+
                 | (SQL Queries)                      | (LangChain Embeddings)          | (Llama 3 API)
                 v                                    v                                 v
    +------------+-----------+          +-------------+------------+       +------------+-----------+
    |     MySQL Database     |          |  FAISS Vector Database   |       |   Ollama LLM Instance  |
    |      (Port 3306)       |          |      (In-Memory/Disk)    |       |      (Port 11434)      |
    +------------------------+          +--------------------------+       +------------------------+
```

### Components:
- **Flask (Backend)**: Serving modular REST APIs for resume matching, ATS scoring, document optimization, and Q&A chat.
- **MySQL (Database)**: Relational database to persist users, upload records, and optimization histories.
- **LangChain / FAISS (RAG Pipeline)**: Chunking documents (resumes/job descriptions) with `RecursiveCharacterTextSplitter`, computing local HuggingFace embeddings (`all-MiniLM-L6-v2`), and indexing items in FAISS for near-instant semantic retrievals.
- **Ollama Llama 3 (LLM)**: Handles zero-cost offline text analysis, ATS checks, mock interview critiques, and document chat.

---

## 2. Folder Structure

```
career-assistant/
│
├── app/
│   ├── __init__.py           # Package initialization & app setup
│   ├── config.py             # Database and server configs
│   ├── database.py           # MySQL schemas and active DB session managers
│   ├── rag_pipeline.py       # LangChain + FAISS + Ollama embedding pipeline
│   ├── match_module.py       # ATS matching engine & scoring algorithm
│   ├── optimize_module.py    # Resume bullets optimization models & XYZ template
│   ├── interview_module.py   # Interview question generator & AI coaches
│   └── routes.py             # HTTP endpoint controllers
│
├── Dockerfile                # Multi-stage python container definitions
├── docker-compose.yml        # Orchestration configurations
├── requirements.txt          # Absolute dependency locks
├── schema.sql                # Initial database migrations
└── README.md                 # Configuration instructions
```

---

## 3. Database Schema

The system uses three core tables in MySQL (`career_assistant` database):
1. **users**: Tracks system profiles.
2. **documents**: Tracks file uploads, holding raw metadata and parsed text pointers.
3. **match_history**: Records historical ATS scores, missing skills, matching skills, and coaching recommendations.
4. **interview_history**: Saves interview preps, mock answers, and model suggestions.

---

## 4. API Documentation

### Resumes & Documents
* **`POST /api/upload-resume`**
  - Accepts a `.pdf` file.
  - Extracts text, saves record to MySQL database, and writes vector embedding keys to FAISS index.
  
* **`POST /api/upload-jd`**
  - Text body or PDF file of job description.
  - Saves description configuration.

### Processing Engines
* **`POST /api/match`**
  - Synthesizes user resume against current Job Description.
  - Returns `score` (0-100), `matching_skills[]`, `missing_skills[]`, and markdown recommendations.

* **`POST /api/optimize`**
  - Takes raw bullet point statements.
  - Returns ATS-optimized alternatives based on the **XYZ formula** (Accomplished [Action] as measured by [Metric] by doing [Method]).

* **`POST /api/interview-coach`**
  - Triggers technical, behavioral/HR, and project-specific questions custom-tailored to the resume and target JD.

* **`POST /api/chat-rag`**
  - Chat interface that searches the FAISS index for relevant resume/JD sections before asking Llama 3 for answers.

---

## 5. Setup & Local Deployment

### Prerequisites
- Docker & Docker Compose
- Ollama installed locally (and Llama 3 model downloaded: `ollama run llama3`)

### Execution
1. Verify Ollama is running and accessible from Docker container (on your host machine: `ollama run llama3`).
2. Run docker-compose command:
   ```bash
   docker-compose up --build
   ```
3. The database migrations will apply automatically, and Flask will boot up on `http://localhost:5000`.
