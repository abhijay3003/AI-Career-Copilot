# AI-Career-Copilot

An end-to-end Generative AI application that helps job seekers optimize resumes, analyze job descriptions, identify skill gaps, prepare for interviews, and interact with documents using Retrieval-Augmented Generation (RAG).

---

## Overview

AI-Career-Copilot is a locally hosted GenAI platform built using LangChain, Ollama, FAISS, Flask, and MySQL.

The system allows users to:

* Upload resumes and job descriptions
* Compare resumes against job requirements
* Identify missing skills
* Generate ATS-friendly resume suggestions
* Generate interview questions
* Chat with uploaded documents using RAG

Unlike traditional keyword-based systems, AI-Career-Copilot uses semantic search and Large Language Models to understand context and provide intelligent recommendations.

---

## Problem Statement

Most job seekers struggle to:

* Tailor resumes for specific jobs
* Understand skill gaps
* Prepare for technical interviews
* Extract insights from lengthy job descriptions

Traditional ATS tools rely heavily on keyword matching and often fail to understand semantic meaning.

This project solves these issues using Retrieval-Augmented Generation (RAG) and local LLMs.

---

## Key Features

### Resume Analysis

* Resume parsing
* Skill extraction
* Experience analysis

### Job Description Analysis

* Requirement extraction
* Keyword analysis
* Skill matching

### Resume Match Scoring

* Match score generation
* Missing skill identification
* Improvement suggestions

### Interview Preparation

* Technical questions
* HR questions
* Project-based questions

### RAG Chat Assistant

* Chat with resumes
* Chat with job descriptions
* Context-aware responses

---

## System Architecture

User Uploads Resume / Job Description

↓

Document Processing

↓

Text Chunking

↓

Embedding Generation

↓

FAISS Vector Database

↓

LangChain Retriever

↓

Ollama (Llama 3)

↓

Generated Response

---

## Technology Stack

### Programming Language

* Python

### Generative AI

* LangChain
* Ollama
* Llama 3

### Vector Database

* FAISS

### Backend

* Flask

### Database

* MySQL

### Containerization

* Docker

### Document Processing

* PyPDF

---

## Why RAG?

Large Language Models often hallucinate when answering questions.

RAG solves this problem by retrieving relevant information from uploaded documents before generating responses.

Benefits:

* Improved accuracy
* Reduced hallucinations
* Context-aware answers
* Better explainability

---

## Why FAISS?

FAISS was selected because:

* Fast vector similarity search
* Efficient memory usage
* Easy integration with LangChain
* Suitable for semantic retrieval

---

## Why Ollama?

Ollama enables local LLM execution without paid APIs.

Benefits:

* Zero API cost
* Data privacy
* Offline capability
* Faster experimentation

---

## Challenges Faced

### Challenge 1

Handling large PDF documents.

Solution:
Implemented document chunking to improve retrieval quality.

### Challenge 2

Reducing irrelevant retrievals.

Solution:
Optimized chunk size and retrieval parameters.

### Challenge 3

Generating accurate job recommendations.

Solution:
Used contextual prompting and semantic search.

---

## Future Improvements

* Multi-document RAG
* Conversation memory
* User authentication
* Cloud deployment
* Resume ranking system
* Learning roadmap generation

---

## Skills Demonstrated

* Machine Learning
* Natural Language Processing
* Generative AI
* Retrieval-Augmented Generation
* Prompt Engineering
* Vector Databases
* REST API Development
* Docker
* Database Design
* Software Engineering

---

## Interview Questions

### Why did you use RAG instead of fine-tuning?

RAG is cheaper, easier to maintain, and allows real-time access to updated documents without retraining the model.

### Why did you choose FAISS?

FAISS provides efficient vector similarity search and integrates well with LangChain.

### Why use Ollama instead of OpenAI APIs?

Ollama eliminates API costs and enables local execution while maintaining privacy.

### What is the difference between TF-IDF and Embeddings?

TF-IDF relies on keyword frequency, whereas embeddings capture semantic meaning and context.

### How does semantic search work?

Documents and queries are converted into vectors. Similar vectors are retrieved using similarity search.

---

## Author

Abhinay Chowdary

B.Tech (AI & ML)

Presidency University
