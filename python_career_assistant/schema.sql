-- Create Database
CREATE DATABASE IF NOT EXISTS `career_assistant` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `career_assistant`;

-- User Profiles Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Uploaded Resumes/Job Descriptions Data
CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `doc_type` ENUM('resume', 'jd') NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `raw_text` LONGTEXT NOT NULL,
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Matches & Optimization History Table
CREATE TABLE IF NOT EXISTS `match_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `resume_id` INT NOT NULL,
  `jd_id` INT NOT NULL,
  `score` INT NOT NULL CHECK (`score` BETWEEN 0 AND 100),
  `matching_skills` TEXT NOT NULL,  -- JSON list of matches
  `missing_skills` TEXT NOT NULL,   -- JSON list of missing
  `suggestions` TEXT NOT NULL,      -- Suggested improvements
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`resume_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`jd_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Interview Coaching Log
CREATE TABLE IF NOT EXISTS `interview_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `question_type` VARCHAR(50) NOT NULL, -- technical, hr, project
  `question_text` TEXT NOT NULL,
  `model_answer` TEXT NOT NULL,
  `user_answer` TEXT NULL,
  `critique` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed dummy user profiles
INSERT INTO `users` (`email`, `full_name`) VALUES ('assistant_demo@gmail.com', 'Demo Candidate');
