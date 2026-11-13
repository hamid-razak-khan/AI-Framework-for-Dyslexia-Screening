"""
Quick diagnostic test for the model
"""
import numpy as np
from model_utils import load_keras_model, preprocess_image
import os

print("=" * 70)
print("MODEL DIAGNOSTIC TEST")
print("=" * 70)

# Load model
print("\n1. Loading model...")
model = load_keras_model()

if model is None:
    print("❌ Model failed to load!")
    exit(1)

print(f"✅ Model loaded: {type(model)}")
print(f"   Model input shape: {model.input_shape}")
print(f"   Model output shape: {model.output_shape}")

# Test with a sample image
print("\n2. Testing with sample image...")
sample_images = [
    "user_samples/letter_1_1763888354536.png",
    "user_samples/letter_1_1763888448224.png",
]

for img_path in sample_images:
    if os.path.exists(img_path):
        print(f"\n   Testing: {img_path}")
        try:
            # Preprocess
            img = preprocess_image(img_path)
            print(f"   ✅ Preprocessed shape: {img.shape}")
            print(f"   ✅ Value range: [{img.min():.3f}, {img.max():.3f}]")
            
            # Predict
            pred = model.predict(img, verbose=0)
            print(f"   ✅ Prediction shape: {pred.shape}")
            print(f"   ✅ Prediction value: {pred[0][0]:.6f}")
            
            if pred[0][0] == 0.5:
                print("   ⚠️ WARNING: Model returns exactly 0.5 (might not be trained properly)")
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   ❌ File not found: {img_path}")

print("\n" + "=" * 70)
print("DIAGNOSTIC COMPLETE")
print("=" * 70)
