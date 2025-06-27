from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import os
import shutil
from typing import List, Dict, Any, AsyncGenerator
import json
import asyncio
import sqlite3
import threading
from datetime import datetime
import subprocess
import tempfile

# Actual imports for your redaction and entity logic
from email_processor import EmailProcessor
from redactor import redact_text, unredact_text, clean_text, apply_stored_redactions, deanonymize_using_db
from utils import find_entities
from email_extractor import EmailExtractor
import re

app = FastAPI()

def detect_language(text):
    """Simple language detection based on common Portuguese patterns"""
    # Common Portuguese words and patterns
    portuguese_patterns = [
        r'\b(de|da|do|para|com|por|em|uma|um|que|não|sim|mais|muito|bem|bom|boa|olá|obrigad[oa]|senhor[a]?|você|está|são|foi|ser|ter|fazer|pode|assim|também|já|ainda|quando|onde|como|porque|porquê)\b',
        r'[áàâãéêíóôõúüç]',  # Portuguese accented characters
        r'\b(ção|ções|ão|ões|mente|dade|ismo)\b',  # Common Portuguese suffixes
    ]
    
    # Count Portuguese pattern matches
    portuguese_count = 0
    for pattern in portuguese_patterns:
        portuguese_count += len(re.findall(pattern, text.lower()))
    
    # If more than 5% of words appear to be Portuguese, consider it Portuguese
    word_count = len(text.split())
    if word_count > 0 and portuguese_count / word_count > 0.05:
        return 'pt'
    return 'en'

# Allow CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RedactRequest(BaseModel):
    text: str
    entities: dict
    custom_entities: list = []  # For manual selection redaction

class SummarizeRequest(BaseModel):
    text: str
    model: str = None  # Optional model name from AVAILABLE_MODELS
    email_id: str = None  # Optional email ID for caching
    subject: str = None
    sender: str = None
    email_date: str = None
    api_keys: dict = None  # API keys from frontend

class DeanonymizeRequest(BaseModel):
    text: str

class TTSRequest(BaseModel):
    text: str
    voice: str = "Samantha (English (US))"  # Default voice

# New model for follow-up requests
class FollowUpRequest(BaseModel):
    history: List[Dict[str, str]]  # List of {"role": "user"/"assistant", "content": ...}
    question: str
    model: str = "gpt-4o" # Default model if not specified
    api_keys: dict = None  # API keys from frontend

class ExtractEmailsRequest(BaseModel):
    count: int = 10
    hours_back: int = 24

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Save uploaded file temporarily
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Extract text from .eml or .txt file
    extracted_text = ""
    try:
        if file.filename.lower().endswith('.eml'):
            # First extract with English, then detect language
            processor = EmailProcessor(language='en')
            extracted_text = processor.process_eml_file(temp_path)
            # Detect actual language
            detected_lang = detect_language(extracted_text)
            if detected_lang == 'pt':
                # Re-process with Portuguese if detected
                processor = EmailProcessor(language='pt')
                extracted_text = processor.process_eml_file(temp_path)
        elif file.filename.lower().endswith('.txt'):
            with open(temp_path, 'r', encoding='utf-8') as f:
                extracted_text = clean_text(f.read())
        else:
            return JSONResponse(status_code=400, content={"error": "Unsupported file type."})

        # Apply stored redactions BEFORE sending back to frontend
        processed_text = apply_stored_redactions(extracted_text)

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Ensure temp file is removed even if apply_stored_redactions fails
        if os.path.exists(temp_path):
             os.remove(temp_path)
    return {"filename": file.filename, "text": processed_text}

@app.post("/entities")
async def extract_entities(data: SummarizeRequest):
    try:
        # Detect language
        language = detect_language(data.text)
        entities = find_entities(data.text, language=language)
        # Convert sets to lists for JSON serialization
        entities = {k: list(v) for k, v in entities.items()}
        return {"entities": entities, "detected_language": language}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/redact")
async def redact(data: RedactRequest):
    try:
        print("=== DEBUG: Redact Request ===")
        print(f"Text length: {len(data.text)}")
        print(f"Entities: {data.entities}")
        print(f"Custom entities: {data.custom_entities}")
        
        for ce in data.custom_entities:
            print(f"Selected text: '{ce}'")
            print(f"Selected text repr: {repr(ce)}")
            # Check if the selected text exists in the original text
            if ce in data.text:
                print(f"✓ Found '{ce}' in text")
            else:
                print(f"✗ NOT FOUND '{ce}' in text")
                # Try to find similar text
                import difflib
                close_matches = difflib.get_close_matches(ce, data.text.split(), n=3, cutoff=0.6)
                if close_matches:
                    print(f"Similar text found: {close_matches}")
        
        print("=== DEBUG: text excerpt ===")
        print(repr(data.text[:500]))  # print first 500 chars for context
        
        # Merge selected entities and custom_entities into a single redaction target
        merged_entities = dict(data.entities)
        if data.custom_entities:
            # Add a special label for manual selections
            merged_entities.setdefault('MANUAL', [])
            merged_entities['MANUAL'].extend(data.custom_entities)
        
        print(f"Merged entities: {merged_entities}")
        
        # Redact entities in text
        redacted, redaction_map = redact_text(data.text, merged_entities)
        
        print(f"Redaction complete. Map: {redaction_map}")
        
        return {"redacted_text": redacted, "redaction_map": redaction_map}
    except Exception as e:
        print(f"ERROR in redact endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

import openai
import google.generativeai as genai

AVAILABLE_MODELS = {
    "GPT-4o": "gpt-4o",
    "GPT-4.1 Mini (2025-04-14)": "gpt-4.1-mini-2025-04-14",
    "GPT-4.5 Preview": "gpt-4.5-preview-2025-02-27",
    "GPT-4.1 (2025-04-14)": "gpt-4.1-2025-04-14",
    "GPT-4.1 Nano (2025-04-14)": "gpt-4.1-nano-2025-04-14",
    "Gemini 2.5 Pro": "gemini-2.5-pro-preview-03-25",
    "Gemini 2.5 Flash": "gemini-2.5-flash-preview-04-17"
}

# API keys are now provided by the frontend

# Create global email extractor instance
email_extractor = EmailExtractor()

# Database setup for summaries
SUMMARY_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'email_summaries.db')
DB_LOCK = threading.Lock()

def init_summary_db():
    """Initialize SQLite database for summaries"""
    conn = sqlite3.connect(SUMMARY_DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")  # Enable WAL mode for better concurrency
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email_id TEXT UNIQUE,
            subject TEXT,
            sender TEXT,
            email_date TEXT,
            body TEXT,
            summary TEXT,
            model_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_summary_db()

def get_summary_db():
    """Get database connection"""
    conn = sqlite3.connect(SUMMARY_DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

@app.post("/extract-emails")
async def extract_emails(data: ExtractEmailsRequest):
    try:
        # Extract emails from Apple Mail
        emails = email_extractor.extract_emails(count=data.count, hours_back=data.hours_back)
        
        # Format emails for frontend
        formatted_emails = []
        for email in emails:
            # Handle both 'sender' and 'from' fields
            sender = email.get('sender') or email.get('from', 'Unknown')
            
            # Combine email content into single text
            email_text = f"From: {sender}\n"
            email_text += f"Date: {email.get('date', '')}\n"
            email_text += f"Subject: {email.get('subject', '')}\n\n"
            email_text += email.get('body', '')
            
            # Apply stored redactions to the email text
            processed_text = apply_stored_redactions(email_text)
            
            formatted_emails.append({
                "id": email.get('id', ''),
                "sender": sender,
                "date": email.get('date', ''),
                "subject": email.get('subject', ''),
                "text": processed_text,
                "original_text": email_text  # Keep original for reference
            })
        
        return {"emails": formatted_emails}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/emails/count")
async def get_email_count():
    try:
        # Get a quick count of available emails
        emails = email_extractor.extract_emails(count=1, hours_back=168)  # Check last week
        return {"available": len(emails) > 0}
    except Exception as e:
        return {"available": False, "error": str(e)}

@app.post("/summarize")
async def summarize(data: SummarizeRequest):
    # For backward compatibility, keep non-streaming endpoint
    return await summarize_non_streaming(data)

@app.post("/summarize-stream")
async def summarize_stream(data: SummarizeRequest):
    async def generate():
        try:
            api_keys = data.api_keys or {}
            model_key = data.model or "GPT-4o"
            model_id = AVAILABLE_MODELS.get(model_key, model_key)
            
            prompt = get_summarize_prompt(data.text)
            
            if "gpt" in model_id.lower():
                openai_api_key = api_keys.get('openai')
                if not openai_api_key:
                    yield f"data: {json.dumps({'error': 'OpenAI API key not provided'})}\n\n"
                    return
                    
                client = openai.OpenAI(api_key=openai_api_key)
                stream = client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=512,
                    temperature=0.2,
                    stream=True
                )
                
                full_response = ""
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                        
                yield f"data: {json.dumps({'done': True, 'summary': full_response, 'model': model_id})}\n\n"
                
                # Save summary after streaming completes
                if hasattr(data, 'email_id') and data.email_id:
                    try:
                        print(f"Saving summary for email_id: {data.email_id}")
                        print(f"Subject: {getattr(data, 'subject', 'No subject')}")
                        conn = get_summary_db()
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT OR REPLACE INTO summaries 
                            (email_id, subject, sender, email_date, body, summary, model_used)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            data.email_id,
                            getattr(data, 'subject', ''),
                            getattr(data, 'sender', ''),
                            getattr(data, 'email_date', ''),
                            data.text,
                            full_response,
                            model_id
                        ))
                        conn.commit()
                        print(f"Summary saved successfully for {data.email_id}")
                        conn.close()
                    except Exception as e:
                        print(f"Failed to save summary: {e}")
                else:
                    print(f"No email_id provided, not saving summary")
                
            elif "gemini" in model_id.lower():
                gemini_api_key = api_keys.get('gemini')
                if not gemini_api_key:
                    yield f"data: {json.dumps({'error': 'Gemini API key not provided'})}\n\n"
                    return
                    
                genai.configure(api_key=gemini_api_key)
                gemini_model = genai.GenerativeModel(model_id)
                
                # Gemini supports streaming!
                response = gemini_model.generate_content(prompt, stream=True)
                full_response = ""
                
                for chunk in response:
                    if chunk.text:
                        full_response += chunk.text
                        yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
                        await asyncio.sleep(0)  # Allow other async operations
                        
                yield f"data: {json.dumps({'done': True, 'summary': full_response, 'model': model_id})}\n\n"
                
                # Save summary after streaming completes
                if hasattr(data, 'email_id') and data.email_id:
                    try:
                        print(f"Saving summary for email_id: {data.email_id}")
                        print(f"Subject: {getattr(data, 'subject', 'No subject')}")
                        conn = get_summary_db()
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT OR REPLACE INTO summaries 
                            (email_id, subject, sender, email_date, body, summary, model_used)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            data.email_id,
                            getattr(data, 'subject', ''),
                            getattr(data, 'sender', ''),
                            getattr(data, 'email_date', ''),
                            data.text,
                            full_response,
                            model_id
                        ))
                        conn.commit()
                        print(f"Summary saved successfully for {data.email_id}")
                        conn.close()
                    except Exception as e:
                        print(f"Failed to save summary: {e}")
                else:
                    print(f"No email_id provided, not saving summary")
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

def get_summarize_prompt(text):
    return f"""
    You are an AI assistant specialized in summarizing email conversations.
    Your primary goal is to extract **all critical information** from the substantive parts of the messages, while ignoring noise.
    
    **IMPORTANT INPUT STRUCTURE:** The EMAIL CONTENT below has the **most recent message at the TOP**. Older messages from the thread follow below it
    
    **CORE TASK:** Summarize the following email content clearly, concisely, and **completely**.
    
    **EMAIL CONTENT:**
    {text}
    
    **IGNORE BOILERPLATE:**
    Completely **ignore** common email signature elements such as company logos/names/addresses, job titles, website/social media links (unless part of the core discussion), legal disclaimers, confidentiality notices, marketing taglines, environmental reminders, image placeholders, etc. Focus **only** on the actual conversation parts.
    
    **INSTRUCTIONS FOR EMAIL THREADS (Newest First):**
    Analyze the **entire** substantive content, starting from the **top (most recent message)**.
    1. Identify the key points, decisions, and questions from the **most recent message(s) at the top**.
    2. Refer to the older messages lower down **only** to understand the context for the most recent developments.
    3. Ensure **no critical details** from the latest part of the conversation are missed.
    4. Capture the final outcome or current status described in the most recent message(s).
    
    **REQUIRED SUMMARY OUTPUT:**
    Provide a summary containing ONLY the relevant and important information from the conversation, reflecting the latest status, structured as follows:
    
    1.  **TLDR:** A single sentence accurately summarizing the main point or outcome, based primarily on the most recent message(s).
    2.  **Key Information & Decisions (Latest):** Bullet points covering **all** significant topics, data points, agreements, or decisions discussed in the **most recent message(s)**.
    3.  **Relevant Older Context:** Briefly mention key points from older messages *only if necessary* to understand the latest information. If not needed, state "None".
    4.  **Open Questions / Next Steps (Latest):** List any unresolved questions or specific next steps mentioned in the **most recent message(s)**. If none, state "None".
    5.  **Action Items/Deadlines (Latest):** List any specific actions or deadlines mentioned in the **most recent message(s)**. If none, state "None".
    """

async def summarize_non_streaming(data: SummarizeRequest):
    api_keys = data.api_keys or {}
    
    model_key = data.model or "GPT-4o"
    model_id = AVAILABLE_MODELS.get(model_key, model_key)
    
    # Check if we have a cached summary
    if hasattr(data, 'email_id') and data.email_id:
        conn = get_summary_db()
        try:
            cursor = conn.cursor()
            cursor.execute('SELECT summary FROM summaries WHERE email_id = ?', (data.email_id,))
            existing = cursor.fetchone()
            if existing:
                return {"summary": existing['summary'], "model": model_id, "cached": True}
        finally:
            conn.close()
    
    prompt = get_summarize_prompt(data.text)
    try:
        summary = ""
        if "gpt" in model_id.lower():
            openai_api_key = api_keys.get('openai')
            if not openai_api_key:
                return JSONResponse(status_code=500, content={"error": "OpenAI API key not provided"})
            client = openai.OpenAI(api_key=openai_api_key)
            response = client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=512,
                temperature=0.2
            )
            summary = response.choices[0].message.content.strip()
        elif "gemini" in model_id.lower():
            gemini_api_key = api_keys.get('gemini')
            if not gemini_api_key:
                return JSONResponse(status_code=500, content={"error": "Gemini API key not provided"})
            genai.configure(api_key=gemini_api_key)
            gemini_model = genai.GenerativeModel(model_id)
            response = await gemini_model.generate_content_async(prompt) # Use async for FastAPI
            summary = response.text
        else:
            return JSONResponse(status_code=400, content={"error": f"Unsupported model: {model_id}"})
        
        # Save summary to database if email_id provided
        if hasattr(data, 'email_id') and data.email_id:
            conn = get_summary_db()
            try:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO summaries 
                    (email_id, subject, sender, email_date, body, summary, model_used)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    data.email_id,
                    getattr(data, 'subject', ''),
                    getattr(data, 'sender', ''),
                    getattr(data, 'email_date', ''),
                    data.text,
                    summary,
                    model_id
                ))
                conn.commit()
            finally:
                conn.close()
        
        return {"summary": summary, "model": model_id, "cached": False}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# New endpoint for follow-up questions
@app.post("/followup")
async def followup(data: FollowUpRequest):
    # For backward compatibility
    return await followup_non_streaming(data)

@app.post("/followup-stream")
async def followup_stream(data: FollowUpRequest):
    async def generate():
        try:
            api_keys = data.api_keys or {}
            model_id = AVAILABLE_MODELS.get(data.model, data.model)
            
            if "gpt" in model_id.lower():
                openai_api_key = api_keys.get('openai')
                if not openai_api_key:
                    yield f"data: {json.dumps({'error': 'OpenAI API key not provided'})}\n\n"
                    return
                    
                client = openai.OpenAI(api_key=openai_api_key)
                messages = data.history + [{"role": "user", "content": data.question}]
                
                stream = client.chat.completions.create(
                    model=model_id,
                    messages=messages,
                    max_tokens=4096,
                    temperature=0.2,
                    stream=True
                )
                
                full_response = ""
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
                        
                yield f"data: {json.dumps({'done': True, 'answer': full_response, 'model': model_id})}\n\n"
                
            elif "gemini" in model_id.lower():
                gemini_api_key = api_keys.get('gemini')
                if not gemini_api_key:
                    yield f"data: {json.dumps({'error': 'Gemini API key not provided'})}\n\n"
                    return
                    
                genai.configure(api_key=gemini_api_key)
                gemini_model = genai.GenerativeModel(model_id)
                
                # Construct prompt from history
                chat_prompt_parts = []
                if data.history:
                    for message in data.history:
                        if message['role'] == 'user':
                            chat_prompt_parts.append(f"User: {message['content']}")
                        elif message['role'] == 'assistant':
                            chat_prompt_parts.append(f"Assistant: {message['content']}")
                chat_prompt_parts.append(f"User: {data.question}")
                full_prompt = "\n".join(chat_prompt_parts)
                
                # Use streaming for Gemini
                response = gemini_model.generate_content(full_prompt, stream=True)
                full_response = ""
                
                for chunk in response:
                    if chunk.text:
                        full_response += chunk.text
                        yield f"data: {json.dumps({'chunk': chunk.text})}\n\n"
                        await asyncio.sleep(0)  # Allow other async operations
                        
                yield f"data: {json.dumps({'done': True, 'answer': full_response, 'model': model_id})}\n\n"
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

async def followup_non_streaming(data: FollowUpRequest):
    api_keys = data.api_keys or {}

    # Get the actual model name
    model_id = AVAILABLE_MODELS.get(data.model, data.model) # Use data.model which contains the friendly name from frontend

    try:
        assistant_response = ""
        if "gpt" in model_id.lower():
            openai_api_key = api_keys.get('openai')
            if not openai_api_key:
                return JSONResponse(status_code=500, content={"error": "OpenAI API key not provided"})
            client = openai.OpenAI(api_key=openai_api_key)
            # Add the new user question to the history for GPT
            messages = data.history + [{"role": "user", "content": data.question}]
            response = client.chat.completions.create(
                model=model_id,
                messages=messages,
                max_tokens=4096,
                temperature=0.2
            )
            assistant_response = response.choices[0].message.content.strip()
        elif "gemini" in model_id.lower():
            gemini_api_key = api_keys.get('gemini')
            if not gemini_api_key:
                return JSONResponse(status_code=500, content={"error": "Gemini API key not provided"})
            genai.configure(api_key=gemini_api_key)
            gemini_model = genai.GenerativeModel(model_id)
            
            # Construct prompt for Gemini from history
            # Gemini's `generate_content` often takes a flat string or specific Content parts.
            # For chat-like interactions, you might use `start_chat` and `send_message` if using the ChatSession.
            # Here, we'll adapt the OpenAI history to a flat string for `generate_content`.
            chat_prompt_parts = []
            if data.history:
                for message in data.history:
                    if message['role'] == 'user':
                        chat_prompt_parts.append(f"User: {message['content']}")
                    elif message['role'] == 'assistant':
                        chat_prompt_parts.append(f"Assistant: {message['content']}")
            chat_prompt_parts.append(f"User: {data.question}")
            full_prompt = "\n".join(chat_prompt_parts)

            response = await gemini_model.generate_content_async(full_prompt) # Use async
            assistant_response = response.text
        else:
            return JSONResponse(status_code=400, content={"error": f"Unsupported model: {model_id}"})

        return {"answer": assistant_response, "model": model_id}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/deanonymize")
async def deanonymize(data: DeanonymizeRequest):
    try:
        # Use the new function that queries the DB directly
        deanonymized = deanonymize_using_db(data.text)
        return {"text": deanonymized}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/summaries")
async def get_summaries():
    """Get all saved summaries"""
    try:
        conn = get_summary_db()
        try:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, email_id, subject, sender, email_date, 
                       summary, model_used, created_at
                FROM summaries
                ORDER BY created_at DESC
                LIMIT 100
            ''')
            
            summaries = []
            for row in cursor.fetchall():
                summaries.append({
                    'id': row['id'],
                    'email_id': row['email_id'],
                    'subject': row['subject'],
                    'sender': row['sender'],
                    'email_date': row['email_date'],
                    'summary': row['summary'],
                    'model_used': row['model_used'],
                    'created_at': row['created_at']
                })
        finally:
            conn.close()
        
        return {
            'success': True,
            'summaries': summaries,
            'count': len(summaries)
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.delete("/summaries/{email_id}")
async def delete_summary(email_id: str):
    """Delete a saved summary"""
    try:
        conn = get_summary_db()
        try:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM summaries WHERE email_id = ?', (email_id,))
            conn.commit()
            
            if cursor.rowcount == 0:
                return JSONResponse(status_code=404, content={"error": "Summary not found"})
        finally:
            conn.close()
        
        return {"success": True, "message": "Summary deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/tts/speak")
async def speak_text(data: TTSRequest):
    """Use macOS say command to speak text with enhanced voices"""
    try:
        # Create a temporary file for the text (handles special characters better)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(data.text)
            temp_file = f.name
        
        # Use say command with the specified voice
        process = await asyncio.create_subprocess_exec(
            'say',
            '-v', data.voice,
            '-f', temp_file,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        # Clean up temp file
        os.unlink(temp_file)
        
        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            return JSONResponse(status_code=500, content={"error": f"TTS failed: {error_msg}"})
        
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/tts/voices")
async def get_voices():
    """Get available macOS voices"""
    try:
        # Run 'say -v ?' to get list of voices
        process = await asyncio.create_subprocess_exec(
            'say', '-v', '?',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return JSONResponse(status_code=500, content={"error": "Failed to get voices"})
        
        # Parse the output
        voices = []
        for line in stdout.decode().split('\n'):
            if line.strip():
                # Format: "Name    Language  # Comment"
                parts = line.split('#')
                if parts:
                    voice_lang_part = parts[0].strip()
                    comment = parts[1].strip() if len(parts) > 1 else ''
                    
                    # Handle voices with parentheses like "Samantha (English (US))"
                    # Split by last occurrence of whitespace before language code
                    import re
                    match = re.match(r'^(.+?)\s+([a-z]{2}_[A-Z]{2})\s*$', voice_lang_part)
                    if match:
                        voice_name = match.group(1).strip()
                        lang = match.group(2)
                        
                        # Check if it's an enhanced voice
                        is_enhanced = any(word in line for word in ['Premium', 'Enhanced', 'Siri'])
                        
                        voices.append({
                            'name': voice_name,
                            'language': lang,
                            'comment': comment,
                            'enhanced': is_enhanced
                        })
        
        # Sort with enhanced voices first
        voices.sort(key=lambda x: (not x['enhanced'], x['name']))
        
        return {"voices": voices}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/tts/stop")
async def stop_speech():
    """Stop any ongoing speech"""
    try:
        # Kill all say processes
        process = await asyncio.create_subprocess_exec(
            'pkill', '-f', 'say',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
