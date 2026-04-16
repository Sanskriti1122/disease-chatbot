"""
Brain Tumor Detection – Inference / Prediction Module
Handles image preprocessing, model loading, and prediction using YOLOv8 natively.
"""

import json
import io
import base64
import numpy as np
from pathlib import Path
from PIL import Image
import cv2

# ─── Constants ───────────────────────────────────────────────────────────────

CLASS_INFO = {
    "glioma": {
        "display": "Glioma Tumor",
        "description": (
            "Glioma is a type of tumor that arises from glial cells in the brain or spinal cord. "
            "It is one of the most common primary brain tumors and can vary widely in aggressiveness."
        ),
        "severity": "HIGH",
        "recommendation": (
            "Consult a neurologist or neuro-oncologist immediately. "
            "Treatment typically involves surgery, radiation therapy, and chemotherapy."
        ),
        "color": "#ef4444",
    },
    "meningioma": {
        "display": "Meningioma Tumor",
        "description": (
            "Meningioma is a tumor that forms on the membranes covering the brain and spinal cord "
            "(meninges). Most meningiomas are benign (non-cancerous) and grow slowly."
        ),
        "severity": "MODERATE",
        "recommendation": (
            "Schedule an appointment with a neurosurgeon. "
            "Many meningiomas are monitored with regular MRIs; surgery may be required if symptomatic."
        ),
        "color": "#f59e0b",
    },
    "pituitary": {
        "display": "Pituitary Tumor",
        "description": (
            "A pituitary tumor (adenoma) is an abnormal growth in the pituitary gland. "
            "Most are benign and may affect hormone production and vision."
        ),
        "severity": "MODERATE",
        "recommendation": (
            "Consult an endocrinologist and/or neurosurgeon. "
            "Treatment options include medication, surgery, or radiation depending on tumor size."
        ),
        "color": "#8b5cf6",
    },
    "no_tumor": {
        "display": "No Tumor Detected",
        "description": (
            "No signs of a brain tumor were detected in this scan. "
            "The image appears to show normal brain tissue."
        ),
        "severity": "LOW",
        "recommendation": (
            "No immediate action required. Continue with regular health check-ups. "
            "If you have persistent symptoms, consult a physician."
        ),
        "color": "#22c55e",
    },
}

# ─── YOLOv8 Model Loader ──────────────────────────────────────────────────────

class YoloPredictor:
    """Singleton-style predictor for YOLO model."""
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self):
        if self._model is not None:
            return  # Already loaded
            
        try:
            from ultralytics import YOLO
            yolo_path = Path(__file__).resolve().parent.parent / "BrainTumor" / "BrainTumorYolov8" / "runs" / "detect" / "train3" / "weights" / "best.pt"
            if yolo_path.exists():
                print(f"Loading YOLO model from {yolo_path}…")
                self._model = YOLO(str(yolo_path))
            else:
                print(f"YOLO weights not found at {yolo_path}")
        except ImportError:
            print("WARNING: ultralytics not installed. YOLO bounding box feature disabled.")
        except Exception as e:
            print("WARNING: Could not load YOLO model:", e)

yolo_predictor = YoloPredictor()

# ─── Prediction ──────────────────────────────────────────────────────────────

def predict_tumor(image_input) -> dict:
    """
    Run inference using YOLOv8 and return a structured result dict.
    """
    yolo_predictor.load()
    if yolo_predictor._model is None:
        raise RuntimeError("YOLO weights not found or failed to load. Make sure ultralytics is installed.")

    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
    elif isinstance(image_input, np.ndarray):
        pil_img = Image.fromarray(image_input).convert("RGB")
    elif isinstance(image_input, (str, Path)):
        pil_img = Image.open(image_input).convert("RGB")
    else:
        pil_img = Image.open(image_input).convert("RGB")

    yolo_results = yolo_predictor._model(pil_img, verbose=False)
    
    # Defaults if no tumor is detected
    class_name = "no_tumor"
    confidence = 0.95
    all_scores = {"glioma": 0.0, "meningioma": 0.0, "pituitary": 0.0, "no_tumor": 0.95}
    annotated_image_b64 = None

    if len(yolo_results) > 0:
        result_obj = yolo_results[0]
        
        # If YOLO detected a bounding box (tumor found)
        if len(result_obj.boxes) > 0:
            # Find the box with highest confidence
            best_idx = int(result_obj.boxes.conf.argmax())
            box = result_obj.boxes[best_idx]
            
            yolo_cls_idx = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            class_name = yolo_predictor._model.names[yolo_cls_idx]
            
            # Update scores manually
            all_scores = {"glioma": 0.0, "meningioma": 0.0, "pituitary": 0.0, "no_tumor": 1.0 - confidence}
            all_scores[class_name] = confidence
            
            # Generate the annotated image
            bgr_img = result_obj.plot()
            rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
            pil_annotated = Image.fromarray(rgb_img)
            buf = io.BytesIO()
            pil_annotated.save(buf, format="JPEG", quality=90)
            img_bytes = buf.getvalue()
            annotated_image_b64 = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode('utf-8')

    info = CLASS_INFO.get(class_name, {})

    return {
        "class": class_name,
        "display": info.get("display", class_name.title()),
        "confidence": confidence,
        "confidence_pct": f"{confidence * 100:.1f}%",
        "all_scores": all_scores,
        "description": info.get("description", ""),
        "severity": info.get("severity", "UNKNOWN"),
        "recommendation": info.get("recommendation", "Please consult a doctor."),
        "color": info.get("color", "#22c55e" if class_name == "no_tumor" else info.get("color", "#64748b")),
        "body_part": "Brain (MRI/CT Scan)",
        "annotated_image": annotated_image_b64
    }

def format_prediction_report(result: dict) -> str:
    """Format a prediction result as a human-readable string."""
    lines = [
        f"🧠 Body Part Detected : {result['body_part']}",
        f"🔬 Detected Condition : {result['display']}",
        f"📊 Confidence         : {result['confidence_pct']}",
        f"⚠️  Severity           : {result['severity']}",
        "",
        f"📖 Explanation:",
        f"   {result['description']}",
        "",
        f"💊 Recommendation:",
        f"   {result['recommendation']}",
        "",
        "─" * 50,
        "Score Breakdown:",
    ]
    for cls, score in sorted(result["all_scores"].items(), key=lambda x: -x[1]):
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        lines.append(f"  {cls:<12} {bar} {score*100:.1f}%")

    return "\n".join(lines)

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python predict.py <path_to_image>")
        sys.exit(1)

    img_path = sys.argv[1]
    try:
        result = predict_tumor(img_path)
        print("\n" + format_prediction_report(result))
    except FileNotFoundError as e:
        print(f"Error: {e}")
