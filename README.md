# 🧠 NeuraScan AI — Multimodal Brain Tumor Detection Chatbot

> **Disclaimer:** This system is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.

---

## 📋 Overview

NeuraScan AI is a full-stack multimodal medical AI application that combines:

- **Brain Tumor Detection** — Upload MRI/CT scans to detect glioma, meningioma, pituitary tumors, or no tumor using a MobileNetV2 transfer learning model
- **Symptom Chatbot** — Describe neurological symptoms in natural language and get AI-powered educational explanations via Claude
- **Multimodal Fusion** — The chatbot automatically incorporates image analysis results when discussing symptoms

---

## 🗂️ Project Structure

```
brain_tumor_ai/
├── backend/
│   └── app.py              # FastAPI backend (REST API)
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React UI
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Tailwind CSS
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── models/                  # Saved .h5 model (after training)
├── dataset/
│   ├── train/
│   │   ├── glioma/
│   │   ├── meningioma/
│   │   ├── pituitary/
│   │   └── no_tumor/
│   └── test/
│       ├── glioma/
│       ├── meningioma/
│       ├── pituitary/
│       └── no_tumor/
├── train_model.py           # Full training pipeline
├── predict.py               # Inference utilities
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) NVIDIA GPU with CUDA for faster training

---

### 1. Clone & Configure

```bash
git clone <your-repo-url>
cd brain_tumor_ai

# Set up environment variables
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Python Virtual Environment

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Download Dataset

Download the Brain Tumor MRI Dataset from Kaggle:
- https://www.kaggle.com/datasets/masoudnickparvar/brain-tumor-mri-dataset

Extract and place the folders so your structure looks like:
```
dataset/
  train/
    glioma/         # ~1321 images
    meningioma/     # ~1339 images
    pituitary/      # ~1457 images
    no_tumor/       # ~1595 images
  test/
    glioma/         # ~300 images
    meningioma/     # ~306 images
    pituitary/      # ~300 images
    no_tumor/       # ~405 images
```

---

## 🏋️ Train the Model

```bash
# Make sure your virtual environment is active
python train_model.py
```

Training will:
1. Load and augment the dataset
2. Phase 1: Train the classification head (frozen MobileNetV2 backbone)
3. Phase 2: Fine-tune the top 30 layers
4. Save the best model to `models/brain_tumor_model.h5`
5. Generate `models/confusion_matrix.png` and `models/training_history.png`
6. Print a full classification report

**Expected accuracy:** ~95%+ on the test set with default settings.

Training time: ~10–20 minutes on GPU, ~1–2 hours on CPU.

---

## 🖥️ Run the Backend

```bash
# From project root
cd backend
source ../venv/bin/activate

# Set your API key (if not using .env)
export ANTHROPIC_API_KEY=your_key_here

python app.py
# OR
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: http://localhost:8000/docs

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/predict-image` | Upload image → tumor prediction |
| POST | `/chat-symptoms` | Send symptoms → AI response |
| GET | `/class-info` | Metadata on all tumor classes |

### Example: Predict Image

```bash
curl -X POST http://localhost:8000/predict-image \
  -F "file=@/path/to/brain_mri.jpg"
```

### Example: Chat

```bash
curl -X POST http://localhost:8000/chat-symptoms \
  -H "Content-Type: application/json" \
  -d '{"message": "I have severe headaches and vision problems", "history": []}'
```

---

## 🌐 Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

---

## 🧪 Testing the Chatbot

Once both backend and frontend are running:

1. **Symptom Chat** — Type symptoms like:
   - "I have persistent headaches and nausea"
   - "I'm experiencing memory loss and blurred vision"
   - "What's the difference between glioma and meningioma?"

2. **Image Upload** — Drop a brain MRI image onto the upload zone:
   - Results appear in the left panel
   - The chatbot automatically incorporates the scan result

3. **Standalone Prediction** — Test from command line:
   ```bash
   python predict.py path/to/brain_scan.jpg
   ```

---

## 🔬 Model Architecture

```
Input (224×224×3)
    ↓
MobileNetV2 (ImageNet weights, frozen initially)
    ↓
GlobalAveragePooling2D
    ↓
BatchNormalization
    ↓
Dense(256, ReLU) → Dropout(0.5)
    ↓
Dense(128, ReLU) → Dropout(0.3)
    ↓
Dense(4, Softmax)  ← [glioma, meningioma, no_tumor, pituitary]
```

**Training strategy:**
- Phase 1: Train head only (LR=1e-3, up to 30 epochs)
- Phase 2: Fine-tune top 30 layers of MobileNetV2 (LR=1e-5, 10 epochs)
- Early stopping + ReduceLROnPlateau + ModelCheckpoint

---

## 🔒 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key for Claude |

---

## 📊 Expected Model Output

```
Detected Condition : Glioma Tumor
Confidence         : 91.3%
Severity           : HIGH

Explanation:
   Glioma is a type of tumor that occurs in the brain and spinal cord...

Recommendation:
   Consult a neurologist immediately for proper diagnosis.

Score Breakdown:
  glioma       ████████████████░░░░ 91.3%
  meningioma   ██░░░░░░░░░░░░░░░░░░  5.1%
  pituitary    █░░░░░░░░░░░░░░░░░░░  2.4%
  no_tumor     ░░░░░░░░░░░░░░░░░░░░  1.2%
```

---

## ⚕️ Medical Disclaimer

**This system is for educational purposes only.**

NeuraScan AI does not provide medical diagnoses. Results from this tool should never be used as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare professionals with any questions you may have regarding a medical condition.

---

## 📄 License

MIT License — Free for educational and research use.
