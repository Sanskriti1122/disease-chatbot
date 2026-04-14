"""
Brain Tumor AI – FastAPI Backend
Endpoints:
  POST /predict-image   → tumor detection from uploaded MRI/CT image
  POST /chat-symptoms   → LLM-powered symptom analysis chatbot
  GET  /health          → health check
"""

import os
import sys
import json
import base64
import io
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from groq import Groq
# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from predict import predict_tumor, CLASS_INFO

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Brain Tumor AI API",
    description="Multimodal Disease Prediction: Brain Tumor Detection + Symptom Chatbot",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ─── Groq Client ─────────────────────────────────────────────────────────

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a knowledgeable and compassionate medical AI assistant specializing in neurology and brain health. Your role is to:

1. Help users understand neurological symptoms and their possible causes
2. Provide educational information about brain conditions, including tumors
3. Give general health guidance and when to seek medical attention
4. Explain medical terminology in simple, understandable language

IMPORTANT RULES:
- Always include a disclaimer that you are an AI and not a substitute for professional medical advice
- Never diagnose definitively – use language like "may suggest", "could indicate", "consider consulting a doctor about"
- Be empathetic and reassuring without dismissing concerns
- Recommend seeking immediate medical attention for serious symptoms (sudden severe headache, seizures, vision loss, etc.)
- When an image prediction result is provided, incorporate it naturally into your response

DISCLAIMER TO ALWAYS INCLUDE AT THE END:
"⚕️ Medical Disclaimer: This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider with any questions you may have regarding a medical condition."
"""

# ─── Request / Response Models ───────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    image_prediction: Optional[dict] = None  # attach tumor result if available

class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[str]] = []

class PredictionResponse(BaseModel):
    success: bool
    class_name: str
    display_name: str
    confidence: float
    confidence_pct: str
    severity: str
    description: str
    recommendation: str
    color: str
    body_part: str
    all_scores: dict
    annotated_image: Optional[str] = None
    error: Optional[str] = None

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Brain Tumor AI API"}


@app.post("/predict-image", response_model=PredictionResponse)
async def predict_image(file: UploadFile = File(...)):
    """
    Upload a brain MRI/CT image and get tumor prediction.
    Supports: .jpg, .jpeg, .png, .bmp, .tiff
    """
    allowed = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {allowed}")

    try:
        contents = await file.read()
        if len(contents) > 20 * 1024 * 1024:  # 20MB limit
            raise HTTPException(413, "File too large. Maximum 20MB.")

        result = predict_tumor(contents)

        return PredictionResponse(
            success=True,
            class_name=result["class"],
            display_name=result["display"],
            confidence=result["confidence"],
            confidence_pct=result["confidence_pct"],
            severity=result["severity"],
            description=result["description"],
            recommendation=result["recommendation"],
            color=result["color"],
            body_part=result["body_part"],
            all_scores=result["all_scores"],
            annotated_image=result.get("annotated_image")
        )

    except FileNotFoundError as e:
        return PredictionResponse(
            success=False,
            class_name="error",
            display_name="Model Not Found",
            confidence=0,
            confidence_pct="0%",
            severity="UNKNOWN",
            description="",
            recommendation="",
            color="#64748b",
            body_part="",
            all_scores={},
            error=str(e),
        )
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {str(e)}")


@app.post("/chat-symptoms", response_model=ChatResponse)
async def chat_symptoms(request: ChatRequest):
    """
    Symptom-based chatbot powered by Claude.
    Optionally include image_prediction context.
    """
    

    # Build message history for Claude
    messages = []
    for msg in (request.history or []):
        messages.append({"role": msg.role, "content": msg.content})

    # Inject image prediction context if available
    user_content = request.message
    if request.image_prediction:
        pred = request.image_prediction
        ctx = (
            f"\n\n[SYSTEM NOTE: The user has uploaded a brain scan. "
            f"AI Image Analysis Result: {pred.get('display_name', 'Unknown')} "
            f"(Confidence: {pred.get('confidence_pct', 'N/A')}). "
            f"Please incorporate this finding into your response naturally.]"
        )
        user_content += ctx

    messages.append({"role": "user", "content": user_content})

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                *messages
            ]
        )

        reply = response.choices[0].message.content
        return ChatResponse(response=reply)

    except Exception as e:
        import traceback
        print("🔥 FULL ERROR:")
        traceback.print_exc()
    
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )


@app.get("/class-info")
async def get_class_info():
    """Return metadata about all tumor classes."""
    return CLASS_INFO

@app.get("/")
def home():
    return {"message": "Backend is running"}


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
