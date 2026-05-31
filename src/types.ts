/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ResumeState {
  text: string;
  fileName: string;
  uploadedAt: string;
}

export interface JobDescriptionState {
  text: string;
  title: string;
  company: string;
  uploadedAt: string;
}

export interface MatchAnalysis {
  score: number; // 0 - 100
  matchingSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  atsReport: string; // Markdown summary of comparison
}

export interface OptimizedBullet {
  original: string;
  optimized: string;
  impactScoreBefore: number;
  impactScoreAfter: number;
  explanation: string;
}

export interface InterviewQuestion {
  id: string;
  type: 'technical' | 'hr' | 'project';
  question: string;
  modelAnswer: string;
  userAnswer?: string;
  critique?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface PythonCodeFile {
  path: string;
  description: string;
  content: string;
}
