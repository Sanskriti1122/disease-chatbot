"""
Brain Tumor Detection – Inference / Prediction Module
Handles image preprocessing, model loading, and prediction.
"""

import json
import io
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
import cv2

# Optional heavy imports – guarded so the module can be imported without TF
try:
    import tensorflow as tf
    from tensorflow import keras
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("WARNING: TensorFlow not installed. Image prediction will be disabled.")

# ─── Constants ───────────────────────────────────────────────────────────────

IMG_SIZE    = (224, 224)
MODEL_DIR = Path(__file__).resolve().parent
MODEL_DIR = Path(str(MODEL_DIR).strip()) / "models"
MODEL_PATH  = MODEL_DIR / "brain_tumor_model.h5"
print("Looking for model at:", MODEL_PATH)
print("Exists:", MODEL_PATH.exists())
CLASS_IDX_PATH = MODEL_DIR / "class_indices.json"

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

# ─── Model Loader ─────────────────────────────────────────────────────────────

class BrainTumorPredictor:
    """Singleton-style predictor that loads the model once."""

    _instance = None
    _model = None
    _class_indices = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self):
        if self._model is not None:
            return  # Already loaded

        if not TF_AVAILABLE:
            raise RuntimeError("TensorFlow is not installed.")

        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. "
                "Please run train_model.py first or place the .h5 file in the models/ folder."
            )

        print(f"Loading model from {MODEL_PATH}…")
        self._model = keras.models.load_model(str(MODEL_PATH))

        if CLASS_IDX_PATH.exists():
            with open(CLASS_IDX_PATH) as f:
                raw = json.load(f)
            # Invert: index → class name
            self._class_indices = {v: k for k, v in raw.items()}
        else:
            # Fallback alphabetical order (Keras default)
            self._class_indices = {0: "glioma", 1: "meningioma", 2: "no_tumor", 3: "pituitary"}

        print("Model loaded successfully.")

    @property
    def model(self):
        return self._model

    @property
    def class_indices(self):
        return self._class_indices


predictor = BrainTumorPredictor()


import base64

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

# ─── Image Preprocessing ─────────────────────────────────────────────────────

def preprocess_image(image_input) -> np.ndarray:
    """
    Accept a file-like object, bytes, PIL Image, or numpy array.
    Returns a normalized numpy array of shape (1, 224, 224, 3).
    """
    if isinstance(image_input, np.ndarray):
        img = Image.fromarray(image_input)
    elif isinstance(image_input, bytes):
        img = Image.open(io.BytesIO(image_input))
    elif isinstance(image_input, (str, Path)):
        img = Image.open(image_input)
    else:
        img = Image.open(image_input)  # file-like object

    img = img.convert("RGB")

    # Optional: mild CLAHE-style contrast enhancement for medical images
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    img_yuv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2YUV)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    img_yuv[:, :, 0] = clahe.apply(img_yuv[:, :, 0])
    img_cv = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2BGR)
    img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))

    img = img.resize(IMG_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


# ─── Prediction ──────────────────────────────────────────────────────────────

def predict_tumor(image_input) -> dict:
    """
    Run inference and return a structured result dict.

    Returns:
        {
          "class": "glioma",
          "display": "Glioma Tumor",
          "confidence": 0.91,
          "confidence_pct": "91.0%",
          "all_scores": {"glioma": 0.91, ...},
          "description": "...",
          "severity": "HIGH",
          "recommendation": "...",
          "color": "#ef4444",
          "body_part": "Brain (MRI/CT Scan)",
          "annotated_image": "data:image/jpeg;base64,..."
        }
    """
    predictor.load()

    arr = preprocess_image(image_input)
    raw_preds = predictor.model.predict(arr, verbose=0)[0]  # shape: (4,)

    idx = int(np.argmax(raw_preds))
    class_name = predictor.class_indices[idx]
    confidence = float(raw_preds[idx])

    all_scores = {
        predictor.class_indices[i]: float(raw_preds[i])
        for i in range(len(raw_preds))
    }

    info = CLASS_INFO.get(class_name, {})
    
    # ── YOLOv8 Bounding Box Generation and Override ──
    annotated_image_b64 = None
    try:
        yolo_predictor.load()
        if yolo_predictor._model is not None:
            if isinstance(image_input, bytes):
                pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
            else:
                pil_img = Image.open(image_input).convert("RGB")
                
            yolo_results = yolo_predictor._model(pil_img, verbose=False)
            
            if len(yolo_results) > 0:
                result_obj = yolo_results[0]
                
                # If YOLO detected a bounding box, OVERRIDE the Keras prediction!
                if len(result_obj.boxes) > 0:
                    box = result_obj.boxes[0]
                    yolo_cls_idx = int(box.cls[0].item())
                    yolo_conf = float(box.conf[0].item())
                    yolo_class_name = yolo_predictor._model.names[yolo_cls_idx]
                    
                    # Update variables for final JSON result to match the image
                    class_name = yolo_class_name
                    confidence = yolo_conf
                    info = CLASS_INFO.get(class_name, {})
                
                # Plot returns a BGR numpy array
                bgr_img = result_obj.plot()
                # Convert BGR to RGB
                rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
                
                # Convert to JPEG base64
                pil_annotated = Image.fromarray(rgb_img)
                buf = io.BytesIO()
                pil_annotated.save(buf, format="JPEG", quality=90)
                img_bytes = buf.getvalue()
                annotated_image_b64 = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode('utf-8')
    except Exception as e:
        print("WARNING: YOLO prediction failed -", e)

    return {
        "class": class_name,
        "display": info.get("display", class_name.title()),
        "confidence": confidence,
        "confidence_pct": f"{confidence * 100:.1f}%",
        "all_scores": all_scores,
        "description": info.get("description", ""),
        "severity": info.get("severity", "UNKNOWN"),
        "recommendation": info.get("recommendation", "Please consult a doctor."),
        "color": info.get("color", "#64748b"),
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


# ─── Standalone test ──────────────────────────────────────────────────────────

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
