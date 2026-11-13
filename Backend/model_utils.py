"""
Model Utilities for Dyslexia Detection
Handles loading and preprocessing using TensorFlow/Keras only
"""

from tensorflow.keras.models import load_model, Model
from tensorflow.keras.layers import Concatenate, Add, GlobalAveragePooling2D, Dense
import numpy as np
import cv2
import os
import warnings
import tensorflow as tf

warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Try the fixed .keras model first, fallback to .h5
MODEL_PATH = os.path.join(BASE_DIR, "trained models", "simple_dyslexia_model_fixed.keras")
MODEL_PATH_H5 = os.path.join(BASE_DIR, "trained models", "simple_dyslexia_model.h5")


def load_keras_model():
    """
    Load the Keras model - SIMPLIFIED & CLEAN VERSION
    Loads the MobileNetV2 dyslexia detection model.
    
    Returns:
        Loaded Keras model or None if loading fails
    """
    try:
        # Try multiple possible paths
        possible_paths = [
            MODEL_PATH,  # .keras version first
            MODEL_PATH_H5,  # .h5 version as fallback
            os.path.join(BASE_DIR, "trained_models", "simple_dyslexia_model_fixed.keras"),
            os.path.join(BASE_DIR, "trained_models", "simple_dyslexia_model.h5"),
            os.path.join(os.path.dirname(BASE_DIR), "Backend", "trained models", "simple_dyslexia_model_fixed.keras"),
            os.path.join(os.path.dirname(BASE_DIR), "Backend", "trained models", "simple_dyslexia_model.h5"),
        ]
        
        model_path = None
        for path in possible_paths:
            if os.path.exists(path):
                model_path = path
                break
        
        if not model_path:
            print(f"❌ Model file not found. Searched in: {possible_paths}")
            return None
        
        print(f"📂 Loading model from: {model_path}")
        
        # Load model using TensorFlow
        model = tf.keras.models.load_model(model_path, compile=False)
        print("✅ Model loaded successfully.")
        return model
        
    except Exception as e:
        print(f"❌ Error loading Keras model: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def preprocess_image(img_path):
    """
    Preprocess an image for prediction.
    
    IMPORTANT: This matches the training pipeline exactly!
    
    STEPS:
    1. Load image in BGR (OpenCV default)
    2. Convert BGR → RGB (Training was RGB)
    3. Resize to 224×224
    4. Normalize using MobileNetV2 preprocessing: (x / 127.5) - 1.0
    5. Add batch dimension → (1, 224, 224, 3)
    
    Args:
        img_path: Path to image file
    
    Returns:
        Preprocessed image array ready for prediction (shape: (1, 224, 224, 3))
    """
    # 1. Load image in BGR (OpenCV default)
    img = cv2.imread(img_path)
    
    if img is None:
        raise ValueError(f"❌ Failed to load image: {img_path}")
    
    # 2. BGR → RGB (Training was done on RGB images)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # 3. Resize to 224×224
    img = cv2.resize(img, (224, 224))
    
    # 4. Convert to float32 and normalize to [-1, 1] (MobileNetV2 standard)
    # Formula: (x / 127.5) - 1.0 converts [0, 255] to [-1, 1]
    img = img.astype("float32")
    img = (img / 127.5) - 1.0
    
    # 5. Add batch dimension: (224, 224, 3) → (1, 224, 224, 3)
    img = np.expand_dims(img, axis=0)
    
    return img
