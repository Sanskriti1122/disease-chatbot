"""
Brain Tumor Detection - Model Training Pipeline
Uses Transfer Learning with MobileNetV2
Dataset: Kaggle Brain Tumor MRI Dataset
"""

import os
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import (
    ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard
)
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
import json

# ─── Config ──────────────────────────────────────────────────────────────────

IMG_SIZE    = (224, 224)
BATCH_SIZE  = 32
EPOCHS      = 50
FINE_TUNE_EPOCHS = 30
NUM_CLASSES = 4
CLASS_NAMES = ["glioma", "meningioma", "no_tumor", "pituitary"]

DATASET_DIR = Path("dataset")
TRAIN_DIR   = DATASET_DIR / "train"
TEST_DIR    = DATASET_DIR / "test"
MODEL_DIR   = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

MODEL_PATH  = MODEL_DIR / "brain_tumor_model.h5"
HISTORY_PATH = MODEL_DIR / "training_history.json"

# ─── Data Augmentation & Generators ─────────────────────────────────────────

def create_data_generators():
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=False,
        brightness_range=[0.8, 1.2],
        fill_mode="nearest",
        validation_split=0.15,
    )

    test_datagen = ImageDataGenerator(rescale=1.0 / 255)

    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="training",
        shuffle=True,
        seed=42,
    )

    val_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="validation",
        shuffle=False,
        seed=42,
    )

    test_gen = test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        shuffle=False,
    )

    print(f"Training samples  : {train_gen.samples}")
    print(f"Validation samples: {val_gen.samples}")
    print(f"Test samples      : {test_gen.samples}")
    print(f"Class indices     : {train_gen.class_indices}")

    # Save class index mapping
    with open(MODEL_DIR / "class_indices.json", "w") as f:
        json.dump(train_gen.class_indices, f, indent=2)

    return train_gen, val_gen, test_gen


# ─── Model Architecture ──────────────────────────────────────────────────────

def build_model(num_classes: int = NUM_CLASSES):
    """Transfer learning with MobileNetV2 backbone."""

    base_model = MobileNetV2(
        input_shape=(*IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False  # Freeze backbone initially

    inputs = keras.Input(shape=(*IMG_SIZE, 3))
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs, name="BrainTumorDetector")
    return model, base_model


# ─── Training ────────────────────────────────────────────────────────────────

def train(model, base_model, train_gen, val_gen, class_weights):
    # Phase 1: Train head only
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.AUC(name="auc")],
    )
    model.summary()

    callbacks = [
        ModelCheckpoint(
            str(MODEL_PATH),
            monitor="val_accuracy",
            save_best_only=True,
            verbose=1,
        ),
        EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7, verbose=1),
        TensorBoard(log_dir="models/logs"),
    ]

    print("\n=== Phase 1: Training Classification Head ===")
    history1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1,
    )

    # Phase 2: Fine-tune top layers of base model
    print("\n=== Phase 2: Fine-tuning Top Layers ===")
    base_model.trainable = True
    # Freeze all layers except the last 30
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy", keras.metrics.AUC(name="auc")],
    )

    history2 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=FINE_TUNE_EPOCHS,
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1,
    )
    # Merge histories
    combined = {}
    for key in history1.history:
        combined[key] = history1.history[key] + history2.history.get(key, [])

    with open(HISTORY_PATH, "w") as f:
        json.dump(combined, f, indent=2)

    return combined


# ─── Evaluation ──────────────────────────────────────────────────────────────

def evaluate(model, test_gen):
    print("\n=== Evaluating on Test Set ===")
    results = model.evaluate(test_gen, verbose=1)
    print(f"Test Loss    : {results[0]:.4f}")
    print(f"Test Accuracy: {results[1]:.4f}")

    # Predictions
    test_gen.reset()
    preds = model.predict(test_gen, verbose=1)
    pred_classes = np.argmax(preds, axis=1)
    true_classes = test_gen.classes

    idx_to_class = {v: k for k, v in test_gen.class_indices.items()}
    pred_labels  = [idx_to_class[i] for i in pred_classes]
    true_labels  = [idx_to_class[i] for i in true_classes]

    print("\nClassification Report:")
    print(classification_report(true_labels, pred_labels))

    # Confusion Matrix
    cm = confusion_matrix(true_labels, pred_labels, labels=CLASS_NAMES)
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES
    )
    plt.title("Confusion Matrix – Brain Tumor Detection")
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    plt.savefig(MODEL_DIR / "confusion_matrix.png", dpi=150)
    print(f"Confusion matrix saved to {MODEL_DIR / 'confusion_matrix.png'}")


# ─── Plot Training History ────────────────────────────────────────────────────

def plot_history(history: dict):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(history["accuracy"], label="Train Accuracy")
    axes[0].plot(history["val_accuracy"], label="Val Accuracy")
    axes[0].set_title("Accuracy over Epochs")
    axes[0].set_xlabel("Epoch")
    axes[0].legend()

    axes[1].plot(history["loss"], label="Train Loss")
    axes[1].plot(history["val_loss"], label="Val Loss")
    axes[1].set_title("Loss over Epochs")
    axes[1].set_xlabel("Epoch")
    axes[1].legend()

    plt.tight_layout()
    plt.savefig(MODEL_DIR / "training_history.png", dpi=150)
    print(f"Training plot saved to {MODEL_DIR / 'training_history.png'}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Brain Tumor Detection – Transfer Learning Pipeline")
    print("=" * 60)

    # Check GPU
    gpus = tf.config.list_physical_devices("GPU")
    print(f"GPUs available: {len(gpus)}")

    train_gen, val_gen, test_gen = create_data_generators()
    class_weights = {
        0: 3.0,  # glioma
        1: 3.0,  # meningioma
        2: 1.0,  # no_tumor
        3: 3.0   # pituitary
    }

    classes = train_gen.classes
    

    
    print("Class weights:", class_weights)
    model, base_model = build_model()
    history = train(model, base_model, train_gen, val_gen,class_weights)
    plot_history(history)

    # Load best model for evaluation
    best_model = keras.models.load_model(str(MODEL_PATH))
    evaluate(best_model, test_gen)

    print(f"\nModel saved to: {MODEL_PATH}")
    print("Training complete!")


if __name__ == "__main__":
    main()
