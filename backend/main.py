import os
import asyncio
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

class OutputResponse(BaseModel):
    format: str
    content: str

class GenerationRequest(BaseModel):
    source_text: str = ""
    outputs: List[str]
    audience: str
    tone: str
    language: str

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

async def generate_output(context: str, output_format: str, audience: str, tone: str, language: str) -> OutputResponse:
    llm = ChatGoogleGenerativeAI(model="gemma-4-31b-it", temperature=0.7)
    
    # Specific rules
    format_rules = ""
    if "video" in output_format.lower():
        format_rules = "Format the output with columns or sections for Visual/Scene, Audio/Narration, and Timestamps."
    elif "linkedin" in output_format.lower():
        format_rules = "Keep it engaging, use relevant emojis, and add appropriate hashtags."
    elif "twitter" in output_format.lower() or "x post" in output_format.lower():
        format_rules = "Keep it under 280 characters per tweet, or format as a structured thread."
    elif "presentation" in output_format.lower():
        format_rules = "Format as slides with titles, bullet points, and speaker notes."
    
    prompt = PromptTemplate(
        template="""You are an expert content creator. Using the provided source context, generate a {output_format} tailored for a {audience} audience using a {tone} tone in {language} language. 
        
Specific instructions for this format: {format_rules}
        
Source Context:
{context}

Respond only with the actual generated content, well-formatted.
""",
        input_variables=["output_format", "audience", "tone", "language", "format_rules", "context"]
    )
    
    chain = prompt | llm
    
    try:
        response = await chain.ainvoke({
            "output_format": output_format,
            "audience": audience,
            "tone": tone,
            "language": language,
            "format_rules": format_rules,
            "context": context
        })
        content_val = response.content
        if isinstance(content_val, list):
            parts = []
            for part in content_val:
                if isinstance(part, dict) and 'text' in part:
                    # Ignore 'thinking' blocks to keep output clean
                    if part.get('type') != 'thinking':
                        parts.append(part['text'])
            if not parts:
                parts = [str(p) for p in content_val]
            content_val = "\n".join(parts)
        elif not isinstance(content_val, str):
            content_val = str(content_val)
            
        return OutputResponse(format=output_format, content=content_val)
    except Exception as e:
        return OutputResponse(format=output_format, content=f"Generation failed: {str(e)}")

async def process_with_rag(text: str, outputs: List[str], audience: str, tone: str, language: str):
    # Simplistic RAG for large documents
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(text)
    
    # Use Chroma with local HuggingFace embeddings to avoid Gemini API issues
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vectorstore = Chroma.from_texts(chunks, embeddings)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    
    tasks = []
    for out_format in outputs:
        # Retrieve relevant chunks based on the requested format and audience
        query = f"Information relevant for a {out_format} targeting {audience}"
        docs = retriever.invoke(query)
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Add to async tasks
        tasks.append(generate_output(context, out_format, audience, tone, language))
    
    results = await asyncio.gather(*tasks)
    return results

@app.post("/api/generate")
async def generate_endpoint(
    source_text: str = Form(""),
    outputs: str = Form(...), # Comma separated
    audience: str = Form(...),
    tone: str = Form(...),
    language: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    text_content = source_text
    if file and file.filename:
        file_text = extract_text_from_file(file)
        text_content += "\n\n" + file_text
        
    if not text_content.strip():
        raise HTTPException(status_code=400, detail="No source content provided")

    output_list = [o.strip() for o in outputs.split(",") if o.strip()]
    
    # Simple token counting approximation (1 token ~= 4 chars)
    approx_tokens = len(text_content) / 4
    
    if approx_tokens > 5000:
        # Path B: Large Documents (RAG)
        results = await process_with_rag(text_content, output_list, audience, tone, language)
    else:
        # Path A: Short Text
        tasks = [generate_output(text_content, out_format, audience, tone, language) for out_format in output_list]
        results = await asyncio.gather(*tasks)
        
    return {"results": [r.dict() for r in results]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
