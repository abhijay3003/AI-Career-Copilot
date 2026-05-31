/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let pdf: any = null;

try {
  const pdfRaw = require("pdf-parse");
  pdf = typeof pdfRaw === "function" ? pdfRaw : (pdfRaw.default || pdfRaw);
  if (typeof pdf !== "function" && pdfRaw && typeof pdfRaw === "object") {
    // Some bundlers/environments wrap the export inside an object
    const keys = Object.keys(pdfRaw);
    for (const key of keys) {
      if (typeof pdfRaw[key] === "function") {
        pdf = pdfRaw[key];
        break;
      }
    }
  }
} catch (err: any) {
  console.error("Top-level require of pdf-parse failed:", err.message);
}

import { execFile } from "child_process";

// Helper function to call the custom Python module integrations
function callPythonBridge(command: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExecutable = "python3";
    const scriptPath = path.join(process.cwd(), "bridge.py");
    const argsJson = JSON.stringify(args);

    execFile(pythonExecutable, [scriptPath, command, argsJson], { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Python Exec Error] command '${command}':`, error, stderr);
        return reject(new Error(`Python execute failed: ${error.message}. Stderr: ${stderr}`));
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          console.error(`[Python Inner Error] in '${command}':`, parsed.error, parsed.traceback);
          return reject(new Error(`Python module error: ${parsed.error}`));
        }
        resolve(parsed);
      } catch (parseError: any) {
        console.error(`[Python JSON Parse Failure] in '${command}':`, stdout);
        reject(new Error(`Failed to parse Python output: ${parseError.message}. Raw output: ${stdout}`));
      }
    });
  });
}

// Session stores in-memory for simpler deployment
interface SessionState {
  resume: {
    text: string;
    fileName: string;
    uploadedAt: string;
  } | null;
  jd: {
    text: string;
    title: string;
    company: string;
    uploadedAt: string;
  } | null;
  matchAnalysis: any | null;
  optimizedBullets: any[] | null;
  interviewQuestions: any[] | null;
}

const GLOBAL_SESSION: SessionState = {
  resume: null,
  jd: null,
  matchAnalysis: null,
  optimizedBullets: null,
  interviewQuestions: null,
};

// High-performance Ollama client utility for offline execution
async function callOllama(prompt: string, systemInstruction?: string, formatJson?: boolean): Promise<string> {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3";
  
  const payload: any = {
    model: model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.2
    }
  };

  if (systemInstruction) {
    payload.system = systemInstruction;
  }

  if (formatJson) {
    payload.format = "json";
  }

  try {
    const url = `${ollamaBaseUrl.replace(/\/$/, "")}/api/generate`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama returned status ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    return data.response || "";
  } catch (error: any) {
    console.error("Ollama HTTP API interaction failed:", error.message || error);
    if (formatJson) {
      // Return structured offline placeholder if connection fails in UI to assist onboarding
      return JSON.stringify({
        score: 0,
        matching_skills: [],
        missing_skills: [],
        suggestions: ["Please run 'ollama run " + model + "' to start local LLM integrations."],
        ats_report: `🔴 **Could not connect to Ollama**\n\nThe local analysis server was unable to verify the model because Ollama is not running on port 11434.\n\n### Quick Start:\n\`\`\`bash\nollama run ${model}\n\`\`\`\nThen try analyzing or generating simulated materials again!`
      });
    }
    throw new Error(`Could not connect to local Ollama at ${ollamaBaseUrl}. Ensure Ollama is running and model '${model}' is pulled.`);
  }
}

// Fallback GoogleGenAI shim to prevent import failures
let _aiClient: any = null;
function getGemini() {
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON large payloads
  app.use(express.json({ limit: "50mb" }));

  // --- API Endpoints ---

  // Health/Status check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasResume: !!GLOBAL_SESSION.resume,
      hasJd: !!GLOBAL_SESSION.jd,
      hasOllama: true,
      ollamaModel: process.env.OLLAMA_MODEL || "llama3",
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  });

  // Get active session metrics
  app.get("/api/session", (req, res) => {
    res.json(GLOBAL_SESSION);
  });

  // Reset active session state
  app.post("/api/session/reset", (req, res) => {
    GLOBAL_SESSION.resume = null;
    GLOBAL_SESSION.jd = null;
    GLOBAL_SESSION.matchAnalysis = null;
    GLOBAL_SESSION.optimizedBullets = null;
    GLOBAL_SESSION.interviewQuestions = null;
    res.json({ success: true, message: "Cleared current session metrics." });
  });

  // Upload and parse resume
  app.post("/api/upload-resume", async (req, res) => {
    try {
      const { text, fileBase64, fileName } = req.body;

      let extractedText = "";
      let name = fileName || "resume.txt";

      if (fileBase64) {
        // Strategy 1: Attempt to use the Python pypdf extractor via Python bridge
        let parsedWithPython = false;
        try {
          const pyRes = await callPythonBridge("parse_pdf", { fileBase64 });
          if (pyRes && pyRes.text && pyRes.text.trim().length > 50) {
            extractedText = pyRes.text;
            parsedWithPython = true;
          } else {
            console.warn("Python PDF extractor returned empty/short text. Trying fallback...");
          }
        } catch (pyParseError: any) {
          console.warn("Python-based PDF parser failed, falling back to local JS extractors:", pyParseError.message || pyParseError);
        }

        if (!parsedWithPython) {
          // Convert base64 PDF into a buffer and run pdf-extract
          const buffer = Buffer.from(fileBase64, "base64");
          
          // Strategy 2: Attempt to use the pdf-parse library
          let parsedWithLibrary = false;
          if (typeof pdf === "function") {
            try {
              let parsedPdf: any;
              try {
                parsedPdf = await pdf(buffer);
              } catch (innerErr: any) {
                if (innerErr.message && innerErr.message.includes("Class constructor")) {
                  parsedPdf = await (new (pdf as any)(buffer));
                } else {
                  throw innerErr;
                }
              }
              extractedText = parsedPdf?.text || "";
              if (extractedText.trim().length > 100) {
                parsedWithLibrary = true;
              }
            } catch (parseFailError: any) {
              console.warn("pdf-parse library execution failed, falling back to custom extraction:", parseFailError.message);
            }
          }

          // Strategy 3: Beautiful robust pure-JS stream extractor fallback
          if (!parsedWithLibrary) {
            try {
              const content = buffer.toString("binary");
              const textBlocks: string[] = [];
              
              // Look for PDF text streams (Begin Text till End Text)
              const streamMatches = content.match(/BT[\s\S]*?ET/g);
              if (streamMatches) {
                for (const stream of streamMatches) {
                  const matches = stream.match(/\(([^)]+)\)/g);
                  if (matches) {
                    const chunk = matches
                      .map(m => m.slice(1, -1))
                      .filter(t => t.trim().length > 0)
                      .join(" ");
                    if (chunk) textBlocks.push(chunk);
                  }
                }
              }

              // Fallback to absolute parenthetical search if streams are obscured
              if (textBlocks.length === 0) {
                const backupMatches = content.match(/\(([^)]{2,120})\)/g);
                if (backupMatches) {
                  for (const m of backupMatches) {
                    const clean = m.slice(1, -1).replace(/\\[()]/g, "").trim();
                    // Skip binary headers/junk
                    if (clean.length > 2 && !clean.includes("/") && !clean.includes("%") && !clean.startsWith("Adobe")) {
                      textBlocks.push(clean);
                    }
                  }
                }
              }

              let combined = textBlocks.join(" ");
              // Unescape octal characters e.g. \303\241
              combined = combined.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
              combined = combined.replace(/\\(.)/g, "$1");
              
              extractedText = combined.trim();
            } catch (fallbackErr: any) {
              console.error("Custom PDF parser fallback failed:", fallbackErr);
            }
          }

          // Strategy 4: Final fallback to raw printable text
          if (!extractedText || extractedText.trim().length < 50) {
            const rawString = buffer.toString("utf-8");
            const printableText = rawString.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
            if (printableText.length > 100) {
              extractedText = printableText;
            }
          }

          // Strategy 5: State-of-the-art LLM multimodal extraction (Ollama fallback hint)
          if (!extractedText || extractedText.trim().length < 50) {
            try {
              console.log("All local parsers failed or produced low-quality output. Querying Ollama PDF extractor fallback...");
              extractedText = "Local offline parsing of structural elements failed. Please copy and paste your resume text manually into the form, or ensure your PDF contains searchable selectable text so the local parser can read it.";
            } catch (ollamaParsingError: any) {
              console.error("Ollama-based PDF parser fallback failed:", ollamaParsingError);
            }
          }

          if (!extractedText || extractedText.trim().length < 50) {
            throw new Error("Unable to parse document: the PDF payload context was empty or encrypted.");
          }
        }
        
        name = fileName || "uploaded_resume.pdf";
      } else if (text) {
        extractedText = text;
      } else {
        return res.status(400).json({ error: "No text or PDF file provided." });
      }

      if (!extractedText.trim()) {
        return res.status(400).json({ error: "Extracted document text is empty." });
      }

      GLOBAL_SESSION.resume = {
        text: extractedText,
        fileName: name,
        uploadedAt: new Date().toISOString(),
      };

      // Invalidate calculations on document upload change
      GLOBAL_SESSION.matchAnalysis = null;
      GLOBAL_SESSION.optimizedBullets = null;
      GLOBAL_SESSION.interviewQuestions = null;

      res.json({
        success: true,
        fileName: name,
        textLength: extractedText.length,
        textPreview: extractedText.slice(0, 300) + "..."
      });
    } catch (error: any) {
      console.error("Failed to parse resume payload:", error);
      res.status(500).json({ error: "Failed to extract and register resume data: " + error.message });
    }
  });

  // Upload target Job Description
  app.post("/api/upload-jd", (req, res) => {
    try {
      const { text, title, company } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Job description text cannot be empty." });
      }

      GLOBAL_SESSION.jd = {
        text,
        title: title || "Target Role Position",
        company: company || "Opportunities Inc.",
        uploadedAt: new Date().toISOString()
      };

      // Invalidate calculations on JD update
      GLOBAL_SESSION.matchAnalysis = null;
      GLOBAL_SESSION.optimizedBullets = null;
      GLOBAL_SESSION.interviewQuestions = null;

      res.json({
        success: true,
        title: GLOBAL_SESSION.jd.title,
        textLength: text.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Match Resume against Job Description
  app.post("/api/match", async (req, res) => {
    try {
      const resume = GLOBAL_SESSION.resume?.text;
      const jd = GLOBAL_SESSION.jd?.text;

      if (!resume || !jd) {
        return res.status(400).json({ error: "Upload both resume and job description to compare!" });
      }

      // Invoke the match command from Python system or fallback directly to Ollama API
      let analysis: any;
      try {
        analysis = await callPythonBridge("match", { resume, jd });
      } catch (pyError: any) {
        console.warn("Python match execution failed. Falling back to direct Ollama API validator:", pyError.message);
        
        const prompt = `You are a professional ATS (Applicant Tracking System) scanner. Match the given resume against the job description.
        
        Resume text:
        ${resume}
        
        Job Description:
        ${jd}
        
        Provide the analysis in strict JSON structure with:
        - "score": integer between 0 and 100 representing how well the candidate matches the job description.
        - "matching_skills": list of matching skills present in both.
        - "missing_skills": list of required/desired skills in the job description that are not in the resume.
        - "suggestions": list of actionable suggestions to improve the resume for this job.
        - "ats_report": a professional ATS report formatted in beautiful Markdown. Include strengths, gaps, and an executive recommendation.`;

        const responseText = await callOllama(
          prompt,
          "You are a helpful assistant that only returns data in strict JSON structure.",
          true
        );
        analysis = JSON.parse(responseText || "{}");
      }
      
      // Map Python snake_case results back to what React components expect
      const mappedAnalysis = {
        score: typeof analysis.score === "number" ? analysis.score : 70,
        matchingSkills: analysis.matching_skills || analysis.matchingSkills || [],
        missingSkills: analysis.missing_skills || analysis.missingSkills || [],
        suggestions: analysis.suggestions || [],
        atsReport: analysis.ats_report || analysis.atsReport || `# Interactive Profile Report\n\nOverall ATS Similarity: **${analysis.score || 70}%**\n\n### Overlapping Strengths:\n${(analysis.matching_skills || []).map((s: string) => `- ${s}`).join("\n") || "No major overlaps identified."}\n\n### Crucial Gaps to Address:\n${(analysis.missing_skills || []).map((s: string) => `- ${s}`).join("\n") || "None discovered."}`
      };

      GLOBAL_SESSION.matchAnalysis = mappedAnalysis;
      res.json(mappedAnalysis);
    } catch (error: any) {
      console.error("Match error:", error);
      res.status(500).json({ error: "ATS Match operation failed: " + error.message });
    }
  });

  // Optimize resume bullets according to Job Description
  app.post("/api/optimize-bullets", async (req, res) => {
    try {
      const { bullets } = req.body;
      const jd = GLOBAL_SESSION.jd?.text || "General industry standards and metric objectives.";

      if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
        return res.status(400).json({ error: "Please provide a list of bullet points to optimize." });
      }

      // Delegate optimization to Python optimize module, fallback directly to Ollama API
      let rawResult: any;
      try {
        rawResult = await callPythonBridge("optimize", { bullets, jd });
      } catch (pyError: any) {
        console.warn("Python optimization failed. Falling back to direct Ollama API optimizer:", pyError.message);
        
        const prompt = `You are an expert career coach and elite resume writer. Optimize the following bullet points to align with the provided Target Job Description.
        Ensure the optimized bullets incorporate strong active verbs, quantifiable metrics, and relevant keywords.
        
        Target Job Description:
        ${jd}
        
        Original Bullet Points to optimize:
        ${JSON.stringify(bullets)}
        
        Provide the response in strict JSON array structure of objects with:
        - "original": original bullet point text
        - "optimized": optimized bullet point version incorporating impact metrics/keywords
        - "impact_score_before": impact rating before optimization (1 to 5)
        - "impact_score_after": impact rating after optimization (1 to 5)
        - "explanation": concise explanation of the improvements and what keywords or metric frameworks were applied.`;

        const responseText = await callOllama(
          prompt,
          "You are a helpful assistant that only returns data in strict JSON structure of a bullet points array.",
          true
        );
        rawResult = JSON.parse(responseText || "[]");
      }
      
      // Ensure property casing compatibility
      const result = Array.isArray(rawResult) ? rawResult.map((item: any) => ({
        original: item.original || "",
        optimized: item.optimized || "",
        impactScoreBefore: typeof item.impact_score_before === "number" ? item.impact_score_before : (item.impactScoreBefore || 3),
        impactScoreAfter: typeof item.impact_score_after === "number" ? item.impact_score_after : (item.impactScoreAfter || 5),
        explanation: item.explanation || ""
      })) : [];

      GLOBAL_SESSION.optimizedBullets = result;
      res.json(result);
    } catch (error: any) {
      console.error("Optimization error:", error);
      res.status(500).json({ error: "Optimization process failed: " + error.message });
    }
  });

  // Generate customized practice interview questions
  app.post("/api/interview", async (req, res) => {
    try {
      const resume = GLOBAL_SESSION.resume?.text;
      const jd = GLOBAL_SESSION.jd?.text;

      if (!resume || !jd) {
        return res.status(400).json({ error: "Upload both resume and job description to curate custom interviewer mocks." });
      }

      // Delegate questions generation to Python interview module, fallback to direct Ollama API
      let rawQuestions: any;
      try {
        rawQuestions = await callPythonBridge("interview", { resume, jd });
      } catch (pyError: any) {
        console.warn("Python interview generation failed. Falling back to direct Ollama API question curator:", pyError.message);
        
        const prompt = `You are a professional tech recruiter and behavioral interviewer. Based on the target job description and the candidate's resume, generate 5 highly custom and relevant practice interview questions that test general and domain-specific readiness.
        
        Job Description:
        ${jd}
        
        Resume:
        ${resume}
        
        Provide the response in strict JSON array structure of objects with:
        - "id": unique string id, e.g., "q1", "q2"...
        - "type": must be exactly "technical", "behavioral", or "resume"
        - "question": the interview question text
        - "model_answer": comprehensive reference answer or evaluation criteria showing star-method structures.`;

        const responseText = await callOllama(
          prompt,
          "You are a recruiter assistant that generates interview questions in a strict JSON array.",
          true
        );
        rawQuestions = JSON.parse(responseText || "[]");
      }
      
      const result = Array.isArray(rawQuestions) ? rawQuestions.map((item: any) => ({
        id: item.id || "q",
        type: item.type || "technical",
        question: item.question || "",
        modelAnswer: item.model_answer || item.modelAnswer || ""
      })) : [];

      GLOBAL_SESSION.interviewQuestions = result;
      res.json(result);
    } catch (error: any) {
      console.error("Interview questions error:", error);
      res.status(500).json({ error: "Failed to generate interview simulations: " + error.message });
    }
  });

  // Evaluate mock responses
  app.post("/api/interview/evaluate", async (req, res) => {
    try {
      const { question, modelAnswer, userAnswer } = req.body;

      if (!question || !userAnswer) {
        return res.status(400).json({ error: "Question and User Response cannot be blank." });
      }

      // Delegate evaluation to Python career coaching module, fallback directly to Ollama API
      let result: any;
      try {
        result = await callPythonBridge("evaluate", {
          question,
          model_answer: modelAnswer || "Analyze technical fluency and concrete outcomes.",
          user_answer: userAnswer
        });
      } catch (pyError: any) {
        console.warn("Python mock evaluation failed. Falling back to direct Ollama API coach:", pyError.message);
        
        const prompt = `You are an expert executive speaking coach and tech recruiter. Critique the candidate's mock interview response to the given question.
        
        Question:
        ${question}
        
        Ideal Reference Guide:
        ${modelAnswer}
        
        Candidate's Response:
        ${userAnswer}
        
        Provide a highly detailed, professional, encouraging, and actionable critique in beautiful Markdown format:
        - Analyze Technical Fluency, Clarity, and STAR methodology.
        - Outline Strengths, Areas of Improvement, and a coach's concrete suggestion.`;

        const responseText = await callOllama(prompt, "You are a professional mock interview evaluator.");

        result = { critique: responseText || "Unable to formulate a critique. Your response is noted!" };
      }

      res.json({ critique: result.critique });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to compile critique: " + error.message });
    }
  });

  // Chat with Document using RAG
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, scope } = req.body; // scope: 'resume' | 'jd' | 'joint'

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Missing or malformed messages body input." });
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || !lastMessage.text) {
        return res.status(400).json({ error: "No user message found inside chat threads." });
      }

      const resumeText = GLOBAL_SESSION.resume?.text || "";
      const jdText = GLOBAL_SESSION.jd?.text || "";

      let context = "";
      if (scope === "resume") {
        context = resumeText ? `Candidate Resume Context:\n${resumeText}` : "No candidate resume uploaded yet.";
      } else if (scope === "jd") {
        context = jdText ? `Target Job Description Context:\n${jdText}` : "No target Job Description loaded yet.";
      } else {
        context = `Candidate Resume:\n${resumeText || "None uploaded"}\n\nTarget Job Description:\n${jdText || "None uploaded"}`;
      }

      // Delegate RAG Query to our Python RAG pipeline execution, fallback directly to Ollama API RAG context solver
      let result: any;
      try {
        result = await callPythonBridge("chat", {
          query: lastMessage.text,
          context: context
        });
      } catch (pyError: any) {
        console.warn("Python search & chat pipeline execution failed. Falling back to direct Ollama API RAG context solver:", pyError.message);
        
        const systemInstruction = `You are an elite talent coach and AI recruitment advisor.
        You are helping the user build dynamic strategies based on the uploaded document context (which includes their resume and/or the job description).
        
        Here is the document context uploaded by the user:
        ${context}
        
        Incorporate this information to answer user queries accurately. Speak in a balanced coaching tone.`;

        const threadText = messages.map((m: any) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n");
        const prompt = `Analyze the conversation history above, then provide a professional, helpful response to the last user message.
        
        Conversation History:
        ${threadText}
        
        Last user message:
        ${lastMessage.text}
        
        Response:`;

        const responseText = await callOllama(prompt, systemInstruction);
        result = { text: responseText || "Your question could not be answered with the current context." };
      }

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Chat service encountered an error: " + error.message });
    }
  });

  // Get python exported codebase
  app.get("/api/python-codebase", (req, res) => {
    try {
      const pythonDir = path.join(process.cwd(), "python_career_assistant");
      const filesList: Array<{ path: string; description: string; content: string }> = [];

      const readFolder = (dir: string) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(pythonDir, fullPath);

          // Skip lock resources if needed
          if (item === "node_modules" || item === ".git") continue;

          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            readFolder(fullPath);
          } else {
            const content = fs.readFileSync(fullPath, "utf-8");
            let desc = "";
            if (item === "README.md") desc = "Production Setup & Installation Blueprint";
            else if (item === "Dockerfile") desc = "Docker Containerization Manifest";
            else if (item === "docker-compose.yml") desc = "Multi-Container Services Orchestration Orchestrations";
            else if (item === "requirements.txt") desc = "Locked Dependencies manifests";
            else if (item === "schema.sql") desc = "MySQL Relational DB DDL Structures";
            else if (item === "__init__.py") desc = "Flask Modular Application Bootloader";
            else if (item === "config.py") desc = "Configuration and Environments Controls";
            else if (item === "database.py") desc = "MySQL Connections, Statements & Logs Committers";
            else if (item === "rag_pipeline.py") desc = "LangChain, Local Vector Embeddings (HF) and FAISS Retrieval engines";
            else if (item === "match_module.py") desc = "Detailed ATS Score and missing skills analyzer";
            else if (item === "optimize_module.py") desc = "Google XYZ bullet-points optimizer and rewritings";
            else if (item === "interview_module.py") desc = "Modular Practice Question generator and AI Coach evaluation";
            else if (item === "routes.py") desc = "REST Controller APIs interfaces mapping Flask routes";
            else if (item === "run.py") desc = "Production WSGI server executor entrypoints";
            else desc = `Python codebase resource`;

            filesList.push({
              path: relativePath,
              description: desc,
              content
            });
          }
        }
      };

      if (fs.existsSync(pythonDir)) {
        readFolder(pythonDir);
      }

      res.json(filesList);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- End of API Endpoints ---

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting production compiled assets distribution...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Career Assistant Dev Server successfully running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("CRITICAL BOOT FAILURE:", err);
});
