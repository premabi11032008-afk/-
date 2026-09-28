import os
import asyncio
import json
import time
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import fitz  # PyMuPDF
from dotenv import load_dotenv
import docx
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel as LCBaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USERS_FILE = os.path.join(os.path.dirname(__file__), "users_db.json")
HISTORY_FILE = os.path.join(os.path.dirname(__file__), "history_db.json")

def load_users_db() -> dict:
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Initial default users
    return {
        "admin": {
            "password": "password123",
            "role": "Admin",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    }

def save_users_db(users: dict):
    try:
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print(f"Error saving users db: {e}")

def load_history_db() -> list:
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_history_db(history: list):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Error saving history db: {e}")

def record_generation_history(username: str, role: str, outputs: List[str], source_title: str = ""):
    history = load_history_db()
    record = {
        "id": f"hist_{int(time.time() * 1000)}",
        "username": username or "Anonymous",
        "role": role or "Public",
        "outputs": outputs,
        "output_count": len(outputs),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source_title": source_title[:80] if source_title else "Source Document / Context"
    }
    history.insert(0, record)  # Newest first
    save_history_db(history)

class OutputResponse(BaseModel):
    format: str
    content: str

class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "Public"

class ForgotPasswordRequest(BaseModel):
    username: str
    new_password: str

def extract_text_from_file(file: UploadFile) -> str:
    content = ""
    try:
        if file.filename.endswith(".pdf"):
            pdf_doc = fitz.open(stream=file.file.read(), filetype="pdf")
            for page in pdf_doc:
                content += page.get_text()
        elif file.filename.endswith(".docx"):
            doc = docx.Document(file.file)
            for para in doc.paragraphs:
                content += para.text + "\n"
        elif file.filename.endswith(".txt"):
            content = file.file.read().decode("utf-8")
    except Exception as e:
        print(f"Error extracting file: {e}")
    return content

async def extract_information_dna(text_content: str) -> Dict[str, Any]:
    candidate_models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite"
    ]
    
    prompt = PromptTemplate(
        template="""You are an AI Information Structuring Expert. Analyze the provided source content and extract its core 'Information DNA'.
Return your response ONLY as valid JSON with no extra commentary or markdown formatting.

JSON Schema:
{{
  "title": "A concise descriptive title summarizing the document",
  "summary": "A high-level executive summary (2-3 sentences)",
  "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
  "entities_and_topics": ["Entity/Topic 1", "Entity/Topic 2", "Entity/Topic 3"]
}}

Source Content:
{context}
""",
        input_variables=["context"]
    )
    
    for model_name in candidate_models:
        try:
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2, max_retries=1)
            chain = prompt | llm
            res = await chain.ainvoke({"context": text_content[:15000]})
            content = res.content
            if isinstance(content, list):
                parts = [p['text'] for p in content if isinstance(p, dict) and 'text' in p and p.get('type') != 'thinking']
                content = "\n".join(parts) if parts else str(content)
            
            cleaned = content.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            parsed = json.loads(cleaned)
            parsed["full_context"] = text_content
            return parsed
        except Exception as e:
            print(f"DNA extraction error on model '{model_name}': {e}")
            continue

    lines = [line.strip() for line in text_content.split("\n") if line.strip()]
    first_line = lines[0] if lines else "Uploaded Source Context"
    return {
        "title": first_line[:60],
        "summary": text_content[:250] + "...",
        "key_takeaways": [lines[i] for i in range(min(4, len(lines)))],
        "entities_and_topics": ["Source Content", "Document Context"],
        "full_context": text_content
    }

async def generate_output(
    context: str, 
    output_format: str, 
    audience: str, 
    tone: str, 
    language: str,
    custom_notes: str = "",
    dna_summary: str = "",
    dna_takeaways: str = ""
) -> OutputResponse:
    candidate_models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.8-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite"
    ]
    
    format_rules = ""
    if "video" in output_format.lower():
        format_rules = "Format the output with columns or sections for Visual/Scene, Audio/Narration, and Timestamps."
    elif "linkedin" in output_format.lower():
        format_rules = "Keep it engaging, use relevant emojis, and add appropriate hashtags."
    elif "twitter" in output_format.lower() or "x post" in output_format.lower():
        format_rules = "Keep it under 280 characters per tweet, or format as a structured thread."
    elif "presentation" in output_format.lower():
        format_rules = "Format as slides with titles, bullet points, and speaker notes."
    
    custom_block = f"\nAdditional User Custom Notes for this format: {custom_notes}" if custom_notes.strip() else ""
    dna_block = f"\nInformation DNA Context:\n- Summary: {dna_summary}\n- Key Takeaways: {dna_takeaways}" if dna_summary.strip() else ""

    prompt = PromptTemplate(
        template="""You are an expert content creator. Using the provided Information DNA and source context, generate a {output_format} tailored for a {audience} audience using a {tone} tone in {language} language. 
        
Specific instructions for this format: {format_rules}{custom_block}
{dna_block}

Source Context:
{context}

Respond only with the actual generated content, beautifully formatted in markdown.
""",
        input_variables=["output_format", "audience", "tone", "language", "format_rules", "custom_block", "dna_block", "context"]
    )
    
    last_error = None
    network_retry_count = 0
    max_network_retries = 3

    for model_name in candidate_models:
        try:
            llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.7, max_retries=1)
            chain = prompt | llm
            
            response = await chain.ainvoke({
                "output_format": output_format,
                "audience": audience,
                "tone": tone,
                "language": language,
                "format_rules": format_rules,
                "custom_block": custom_block,
                "dna_block": dna_block,
                "context": context
            })
            content_val = response.content
            if isinstance(content_val, list):
                parts = []
                for part in content_val:
                    if isinstance(part, dict) and 'text' in part:
                        if part.get('type') != 'thinking':
                            parts.append(part['text'])
                if not parts:
                    parts = [str(p) for p in content_val]
                content_val = "\n".join(parts)
            elif not isinstance(content_val, str):
                content_val = str(content_val)
                
            return OutputResponse(format=output_format, content=content_val)
        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            
            net_keywords = ["getaddrinfo failed", "cannot connect to host", "ssl.sslcontext", "connecterror", "clientconnectorerror", "socket.gaierror", "winerror"]
            if any(kw in err_msg for kw in net_keywords):
                if network_retry_count < max_network_retries:
                    network_retry_count += 1
                    print(f"Transient network glitch on model '{model_name}'. Retrying connection in 1.5s ({network_retry_count}/{max_network_retries})...")
                    await asyncio.sleep(1.5)
                    try:
                        llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.7, max_retries=2)
                        chain = prompt | llm
                        response = await chain.ainvoke({
                            "output_format": output_format,
                            "audience": audience,
                            "tone": tone,
                            "language": language,
                            "format_rules": format_rules,
                            "custom_block": custom_block,
                            "dna_block": dna_block,
                            "context": context
                        })
                        content_val = response.content
                        if isinstance(content_val, list):
                            parts = [p['text'] for p in content_val if isinstance(p, dict) and 'text' in p and p.get('type') != 'thinking']
                            content_val = "\n".join(parts) if parts else str(content_val)
                        elif not isinstance(content_val, str):
                            content_val = str(content_val)
                        return OutputResponse(format=output_format, content=content_val)
                    except Exception as retry_err:
                        last_error = retry_err
                        print(f"Retry failed: {retry_err}")
                continue

            elif "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                print(f"Quota limit hit for model '{model_name}'. Automatically falling back to next available model...")
                continue
            else:
                print(f"Model '{model_name}' failed with error: {e}. Trying next model...")
                continue

    err_str = str(last_error)
    if any(kw in err_str.lower() for kw in ["getaddrinfo failed", "cannot connect to host", "ssl.sslcontext", "connecterror", "clientconnectorerror", "socket.gaierror"]):
        user_msg = "⚠️ Network Connection Error: Unable to reach Google AI servers. Please check your internet connection and click Retry."
    else:
        user_msg = f"⚠️ Generation Error: {err_str}"

    return OutputResponse(format=output_format, content=user_msg)


@app.post("/api/login")
async def login_endpoint(credentials: LoginRequest):
    username = credentials.username.strip()
    password = credentials.password.strip()
    role = credentials.role.strip() if credentials.role else "Public"

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    users_db = load_users_db()

    if username in users_db:
        # Check password for existing user!
        user_data = users_db[username]
        if user_data["password"] != password:
            raise HTTPException(status_code=401, detail="Incorrect password. Access denied.")
        
        # Optionally update role if provided
        if role and role != user_data.get("role"):
            user_data["role"] = role
            save_users_db(users_db)
            
        return {
            "status": "success",
            "username": username,
            "role": user_data.get("role", role),
            "token": f"nexus_session_{username}_token"
        }
    else:
        # Register new user with entered username, password, and role!
        users_db[username] = {
            "password": password,
            "role": role,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        save_users_db(users_db)
        return {
            "status": "success",
            "username": username,
            "role": role,
            "token": f"nexus_session_{username}_token"
        }

@app.post("/api/forgot-password")
async def forgot_password_endpoint(req: ForgotPasswordRequest):
    username = req.username.strip()
    new_password = req.new_password.strip()

    if not username or not new_password:
        raise HTTPException(status_code=400, detail="Username and new password are required")

    users_db = load_users_db()
    if username not in users_db:
        raise HTTPException(status_code=404, detail=f"Username '{username}' does not exist.")

    users_db[username]["password"] = new_password
    save_users_db(users_db)

    return {
        "status": "success",
        "message": f"Password for '{username}' has been updated successfully!"
    }

@app.get("/api/history")
async def get_history_endpoint(role: str = Query("Public")):
    if role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Generation history is restricted to Admin only.")
    history = load_history_db()
    return {"status": "success", "history": history}

@app.post("/api/extract-dna")
async def extract_dna_endpoint(
    source_text: str = Form(""),
    file: Optional[UploadFile] = File(None)
):
    text_content = source_text
    if file and file.filename:
        file_text = extract_text_from_file(file)
        text_content += "\n\n" + file_text

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="No source content provided")

    dna_data = await extract_information_dna(text_content)
    return {"status": "success", "dna": dna_data}

@app.post("/api/generate-stream")
async def generate_stream_endpoint(
    source_text: str = Form(""),
    outputs: str = Form(...), # Comma separated
    per_format_params: str = Form("{}"), # JSON string
    dna_json: str = Form("{}"), # JSON string of Information DNA
    username: str = Form("Anonymous"),
    user_role: str = Form("Public"),
    file: Optional[UploadFile] = File(None)
):
    text_content = source_text
    if file and file.filename:
        file_text = extract_text_from_file(file)
        text_content += "\n\n" + file_text

    output_list = [o.strip() for o in outputs.split(",") if o.strip()]
    total_items = len(output_list)

    format_params_map = {}
    try:
        format_params_map = json.loads(per_format_params)
    except Exception:
        pass

    dna_obj = {}
    try:
        dna_obj = json.loads(dna_json)
    except Exception:
        pass

    if not text_content.strip() and dna_obj.get("full_context"):
        text_content = dna_obj.get("full_context", "")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="No source content or Information DNA provided")

    dna_summary = dna_obj.get("summary", "")
    dna_takeaways = ", ".join(dna_obj.get("key_takeaways", []))

    source_title = dna_obj.get("title", "") or (text_content.split("\n")[0][:60] if text_content else "Source Context")
    # Record history for this generation run
    record_generation_history(username, user_role, output_list, source_title)

    async def event_generator():
        yield json.dumps({
            "status": "progress",
            "progress": 5,
            "message": "Analyzing Information DNA & per-format parameters...",
            "completed_items": 0,
            "total_items": total_items
        }) + "\n"
        await asyncio.sleep(0.05)

        completed_results = []
        start_prog = 10
        remaining_range = 85

        for idx, out_format in enumerate(output_list):
            item_num = idx + 1
            curr_prog = int(start_prog + (idx / total_items) * remaining_range)
            
            yield json.dumps({
                "status": "progress",
                "progress": curr_prog,
                "message": f"Generating {out_format} ({item_num}/{total_items})...",
                "current_format": out_format,
                "completed_items": idx,
                "total_items": total_items
            }) + "\n"

            fp = format_params_map.get(out_format, {})
            audience = fp.get("audience", "General")
            tone = fp.get("tone", "Professional")
            language = fp.get("language", "English")
            custom_notes = fp.get("custom_notes", "")

            res = await generate_output(
                context=text_content,
                output_format=out_format,
                audience=audience,
                tone=tone,
                language=language,
                custom_notes=custom_notes,
                dna_summary=dna_summary,
                dna_takeaways=dna_takeaways
            )
            completed_results.append(res.dict())

            done_prog = int(start_prog + ((idx + 1) / total_items) * remaining_range)
            yield json.dumps({
                "status": "item_complete",
                "progress": done_prog,
                "message": f"Completed {out_format} ({item_num}/{total_items})",
                "result": res.dict(),
                "completed_items": idx + 1,
                "total_items": total_items
            }) + "\n"

        yield json.dumps({
            "status": "finished",
            "progress": 100,
            "message": "All deliverables generated successfully from Information DNA!",
            "results": completed_results,
            "completed_items": total_items,
            "total_items": total_items
        }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.post("/api/generate-single")
async def generate_single_endpoint(
    source_text: str = Form(""),
    output_format: str = Form(...),
    audience: str = Form("General"),
    tone: str = Form("Professional"),
    language: str = Form("English"),
    custom_notes: str = Form(""),
    dna_json: str = Form("{}"),
    username: str = Form("Anonymous"),
    user_role: str = Form("Public"),
    file: Optional[UploadFile] = File(None)
):
    text_content = source_text
    if file and file.filename:
        file_text = extract_text_from_file(file)
        text_content += "\n\n" + file_text

    dna_obj = {}
    try:
        dna_obj = json.loads(dna_json)
    except Exception:
        pass

    if not text_content.strip() and dna_obj.get("full_context"):
        text_content = dna_obj.get("full_context", "")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="No source content or Information DNA provided")

    dna_summary = dna_obj.get("summary", "")
    dna_takeaways = ", ".join(dna_obj.get("key_takeaways", []))

    source_title = dna_obj.get("title", "") or (text_content.split("\n")[0][:60] if text_content else "Source Context")
    record_generation_history(username, user_role, [output_format], source_title)

    res = await generate_output(
        context=text_content,
        output_format=output_format,
        audience=audience,
        tone=tone,
        language=language,
        custom_notes=custom_notes,
        dna_summary=dna_summary,
        dna_takeaways=dna_takeaways
    )

    return res.dict()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
