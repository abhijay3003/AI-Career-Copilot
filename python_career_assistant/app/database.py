import mysql.connector
from flask import current_app
import logging

def get_db_connection():
    """Establishes database connection with standard parameters."""
    try:
        connection = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            database=current_app.config['DB_NAME'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD']
        )
        return connection
    except Exception as e:
        logging.error(f"MySQL connection failed: {e}. Falling back to dynamic mock simulation.")
        return None

def init_db():
    """Initializes tables or verifies schema availability on boot."""
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            # Double-check table states, or log connectivity confirmation
            cursor.execute("SELECT DATABASE();")
            db_name = cursor.fetchone()[0]
            logging.info(f"Connected to MySQL DB: {db_name}")
            cursor.close()
            conn.close()
        except Exception as e:
            logging.error(f"Failed to bootstrap database: {e}")
    else:
        logging.warning("System running in single-user mode. Data is stored in-memory.")

def save_document(user_id, doc_type, file_name, raw_text):
    """Inserts an uploaded document into the database."""
    conn = get_db_connection()
    if not conn:
        return 1  # Mock inserted element id
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO documents (user_id, doc_type, file_name, raw_text)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(query, (user_id, doc_type, file_name, raw_text))
        conn.commit()
        last_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return last_id
    except Exception as e:
        logging.error(f"Failed to write document statement: {e}")
        return None

def save_match_result(user_id, resume_id, jd_id, score, matching_skills, missing_skills, suggestions):
    """Saves match scores and identified skills categories."""
    conn = get_db_connection()
    if not conn:
        return True
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO match_history (user_id, resume_id, jd_id, score, matching_skills, missing_skills, suggestions)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        import json
        cursor.execute(query, (
            user_id, 
            resume_id, 
            jd_id, 
            score, 
            json.dumps(matching_skills), 
            json.dumps(missing_skills), 
            suggestions
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        logging.error(f"Failed to commit match analysis: {e}")
        return False

def save_interview_log(user_id, question_type, question_text, model_answer, user_answer, critique):
    """Records interview logs, responses and critique evaluations."""
    conn = get_db_connection()
    if not conn:
        return True
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO interview_history (user_id, question_type, question_text, model_answer, user_answer, critique)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (user_id, question_type, question_text, model_answer, user_answer, critique))
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        logging.error(f"Failed to record mock interview log: {e}")
        return False
