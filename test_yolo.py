import sys
from pathlib import Path

# Add the project root to sys.path so we can import things if needed
sys.path.append('.')

yolo_path = Path("BrainTumor/BrainTumorYolov8/runs/detect/train3/weights/best.pt")
try:
    from ultralytics import YOLO
    model = YOLO(str(yolo_path))
    print("YOLO names:", model.names)
except Exception as e:
    print("Error loading YOLO model:", e)
