# Nexus Transform - AI Content Transformation Engine

Nexus Transform is an AI-powered content transformation engine that converts source information (documents, text) into specific deliverables like LinkedIn posts, video scripts, infographics, and more.

## Architecture

The system is built in two main phases:
1. **Frontend (Phase 1 & 4):** A React (Vite) application providing a sleek, glassmorphic dashboard where operators can upload files, paste text, select desired outputs, and configure parameters (audience, tone, language).
2. **Backend (Phase 2 & 3):** A FastAPI (Python) backend handling file ingestion, text extraction (PyMuPDF, docx), routing based on size, and AI generation using LangChain and Google Gemini.
    - **Short text:** Direct parallel calls via asyncio to LangChain prompt templates.
    - **Long text (RAG):** Documents are chunked and embedded in a local ChromaDB. Relevant context is retrieved for each specific output request.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- A Google Gemini API Key

### 1. Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   .\venv\Scripts\activate
   # On Mac/Linux
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set your API Key (in `backend/main.py` or via environment variable):
   ```bash
   export GOOGLE_API_KEY="your-gemini-api-key"
   ```
5. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will run at `http://localhost:8000`.

### 2. Frontend Setup
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the provided local URL (usually `http://localhost:5173`) in your browser to access the dashboard.

## Features
- **Multi-format Generation:** Generate Video Scripts, Social Media Posts, Advisories, etc.
- **Dynamic Routing:** Automatically uses RAG (ChromaDB) for large documents to stay within context limits.
- **Parallel Processing:** Generates multiple selected outputs simultaneously via asyncio to reduce wait time.
- **Premium UI:** Glassmorphism design, responsive layouts, and interactive components.
