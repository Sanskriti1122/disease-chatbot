from ultralytics import YOLO

# Load trained model
model = YOLO("/Users/sanskriti/Downloads/BrainTumor/BrainTumorYolov8/runs/detect/train/weights/best.pt")

# Run detection on test images
results = model("/Users/sanskriti/Downloads/BrainTumor/BrainTumorYolov8/test/images", save=True)

print("Tumor detection completed")