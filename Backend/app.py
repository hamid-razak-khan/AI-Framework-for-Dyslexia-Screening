import os
# Suppress TensorFlow OneDNN warning
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import uuid
import base64
import numpy as np
import tensorflow as tf
import re
from difflib import SequenceMatcher
from PIL import Image, ImageOps
from flask import Flask, request, jsonify
from supabase import create_client, Client
from flask_cors import CORS
from dotenv import load_dotenv

import json
import time

# Thresholds for warnings (in seconds)
MODEL_LOAD_THRESHOLD = 5.0
API_LATENCY_THRESHOLD = 2.0
DB_QUERY_THRESHOLD = 0.5

# Tracking first request
first_request_start = None
is_first_request = True


IMG_SIZE = (224, 224)
UPLOAD_FOLDER = "user_samples"
model = None  # Global model variable
MODEL_PATH = None
SUPABASE_URL = None
SUPABASE_KEY = None
supabase = None

def get_key_role(token):
    try:
        # JWT is header.payload.signature
        # We need the payload (2nd part)
        parts = token.split(".")
        if len(parts) < 2:
            return "unknown (not a jwt)"
        
        payload_b64 = parts[1]
        # Fix padding if needed
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload_str = payload_bytes.decode('utf-8')
        payload = json.loads(payload_str)
        
        return payload.get("role", "unknown")
    except Exception as e:
        return f"error decoding: {str(e)}"

def init_app():
    global MODEL_PATH, SUPABASE_URL, SUPABASE_KEY, supabase, model
    
    start_total = time.perf_counter()
    
    # 1. Config Load
    start_config = time.perf_counter()
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path)
    config_time = (time.perf_counter() - start_config) * 1000
    print(f"[BOOT] Config loaded in {config_time:.2f} ms")

    # ----------------------------------
    # CONFIG
    # ----------------------------------
    start_resolve = time.perf_counter()
    MODEL_PATHS = [
        "trained models/simple_dyslexia_model_1.keras",
        "trained models/simple_dyslexia_model.h5"
    ]
    
    for path in MODEL_PATHS:
        if os.path.exists(path):
            MODEL_PATH = path
            break
    
    resolve_time = (time.perf_counter() - start_resolve) * 1000
    print(f"[BOOT] Model path resolved in {resolve_time:.2f} ms")

    if MODEL_PATH is None:
        raise FileNotFoundError("No model file found. Checked paths: " + ", ".join(MODEL_PATHS))

    SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not SUPABASE_URL:
        print("❌ CRITICAL ERROR: SUPABASE_URL is missing.")
        raise ValueError("SUPABASE_URL is required but not found.")

    if not SUPABASE_KEY:
        print("❌ CRITICAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing.")
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) is required but not found.")

    # 2. Supabase Init
    start_supabase = time.perf_counter()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase_time = (time.perf_counter() - start_supabase) * 1000
    print(f"[BOOT] Supabase client ready in {supabase_time:.2f} ms")

    # ----------------------------------
    # LOAD MODEL
    # ----------------------------------
    print(f"Attempting to load model from: {MODEL_PATH}")
    start_model = time.perf_counter()
    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        model_load_time = time.perf_counter() - start_model
        print(f"[BOOT] ML model loaded in {model_load_time*1000:.2f} ms")
        
        if model_load_time > MODEL_LOAD_THRESHOLD:
            print(f"⚠️ WARNING: Model cold start {model_load_time:.2f} seconds")

        # Warm up the model with a dummy prediction
        print("⏳ Warming up model...")
        start_warmup = time.perf_counter()
        dummy_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
        model.predict(dummy_input, verbose=0)
        warmup_time = (time.perf_counter() - start_warmup) * 1000
        print(f"[BOOT] Model warmed up and ready in {warmup_time:.2f} ms")
    except Exception as e:
        print("❌ Error loading model:", str(e))
        raise e
    
    boot_total = (time.perf_counter() - start_total)
    print(f"[BOOT] Cold start total time: {boot_total:.2f} seconds")



os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ----------------------------------
# FLASK SETUP
# ----------------------------------
app = Flask(__name__)
CORS(app)

@app.before_request
def start_timer():
    global first_request_start, is_first_request
    request.start_time = time.perf_counter()
    if is_first_request:
        first_request_start = request.start_time
    print(f"[API] {request.path} {request.method} start")

@app.after_request
def log_response(response):
    global is_first_request, first_request_start
    latency = (time.perf_counter() - request.start_time)
    print(f"[API] total latency {latency*1000:.2f} ms")
    
    if is_first_request:
        first_total = (time.perf_counter() - first_request_start)
        print(f"[API] First request served in {first_total*1000:.2f} ms")
        is_first_request = False
        
    if latency > API_LATENCY_THRESHOLD:
        print(f"⚠️ WARNING: API {request.path} total {latency:.2f} seconds")
        
    return response



# ----------------------------------
# PREPROCESSING FUNCTIONS
# ----------------------------------
def preprocess_image(path, is_canvas=False):
    """
    For dataset-like images → is_canvas=False
    For canvas-drawn black strokes on white    → is_canvas=True (invert)
    """

    img = Image.open(path).convert("L")  # convert to grayscale first

    if is_canvas:
        img = ImageOps.invert(img)      # match training data (white ink on black)

    # Resize to model input
    img = img.resize(IMG_SIZE)

    # Grayscale → RGB (MobileNetV2 requires 3 channels)
    arr = np.array(img).astype("float32")
    arr = np.stack([arr] * 3, axis=-1)

    # Same preprocessing as training
    arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)

    return np.expand_dims(arr, axis=0)


def sigmoid_to_label(prob):
    """
    Your model rule:
      prob > 0.5 → Normal
      prob < 0.5 → Dyslexia
    """
    if prob > 0.5:
        return "Normal", prob
    else:
        return "Dyslexia", 1 - prob


# ----------------------------------
# SPEECH ANALYSIS FUNCTIONS
# ----------------------------------
def normalize_text(text):
    """Normalize text for comparison"""
    if not text:
        return ""
    # Remove punctuation and normalize whitespace
    text = re.sub(r'[^\w\s]', '', text)
    text = ' '.join(text.split())  # Normalize whitespace
    return text.lower()


def calculate_word_accuracy(actual_words, transcribed_words):
    """Calculate word-level accuracy"""
    if not actual_words:
        return 0.0, 0.0
    
    # Use SequenceMatcher for fuzzy matching
    matcher = SequenceMatcher(None, actual_words, transcribed_words)
    similarity = matcher.ratio()
    
    # Count exact matches
    min_len = min(len(actual_words), len(transcribed_words))
    exact_matches = sum(1 for i in range(min_len) 
                       if actual_words[i] == transcribed_words[i])
    
    word_accuracy = (exact_matches / len(actual_words)) * 100 if len(actual_words) > 0 else 0.0
    return word_accuracy, similarity


def estimate_phoneme_errors(actual_words, transcribed_words):
    """Estimate phoneme-level errors"""
    errors = 0
    min_len = min(len(actual_words), len(transcribed_words))
    
    for i in range(min_len):
        # Compare individual words
        matcher = SequenceMatcher(None, actual_words[i], transcribed_words[i])
        similarity = matcher.ratio()
        
        # If words are significantly different, count character differences
        if similarity < 0.8:
            # Count character-level differences as phoneme errors
            char_matcher = SequenceMatcher(None, actual_words[i], transcribed_words[i])
            char_errors = 0
            for tag, i1, i2, j1, j2 in char_matcher.get_opcodes():
                if tag in ['delete', 'insert', 'replace']:
                    char_errors += (i2 - i1) + (j2 - j1)  # Count characters affected
            errors += char_errors
    
    # Penalty for missing/extra words
    word_diff = abs(len(actual_words) - len(transcribed_words))
    errors += word_diff * 3  # Higher penalty for word count differences
    
    return errors


def calculate_speech_metrics(transcribed_text, actual_text, recording_time):
    """Calculate all speech metrics"""
    # Normalize texts
    normalized_transcribed = normalize_text(transcribed_text)
    normalized_actual = normalize_text(actual_text)
    
    # Split into words
    transcribed_words = normalized_transcribed.split() if normalized_transcribed else []
    actual_words = normalized_actual.split() if normalized_actual else []
    
    # Handle case where no transcription is available
    if not transcribed_words:
        return {
            "accuracy_score": 0.0,
            "word_accuracy": 0.0,
            "phoneme_errors": 0,
            "total_mistakes": 0,
            "word_errors": 0,
            "mistake_rate": 0.0,
            "fluency_score": 0.0,
            "speech_rate": 0.0,
            "hesitations": 0,
            "pausing_pattern": "irregular",
            "word_transitions": "disrupted",
            "dyslexia_probability": 0.9,  # High probability when no speech detected
            "indicators": ["No speech detected - unable to assess pronunciation"],
            "recommendations": ["Ensure proper microphone setup and speak clearly during recording"],
            "actual_text": normalized_actual,
            "transcribed_text": normalized_transcribed
        }
    
    # Calculate metrics
    word_accuracy, similarity = calculate_word_accuracy(actual_words, transcribed_words)
    phoneme_errors = estimate_phoneme_errors(actual_words, transcribed_words)
    
    # Calculate speech rate (words per minute)
    speech_rate = 0.0
    if recording_time > 0:
        speech_rate = (len(transcribed_words) / recording_time) * 60
    
    # Estimate hesitations based on speech rate
    expected_rate = 150  # Typical reading rate (WPM)
    rate_ratio = speech_rate / expected_rate if expected_rate > 0 else 0
    hesitations = max(0, int((1 - rate_ratio) * 10)) if rate_ratio < 1 else 0
    
    # Determine pausing pattern
    pausing_pattern = "natural" if rate_ratio >= 0.8 else "irregular"
    
    # Determine word transitions
    word_transitions = "smooth" if rate_ratio >= 0.7 else "disrupted"
    
    # Calculate total mistakes
    word_errors = sum(1 for i in range(min(len(actual_words), len(transcribed_words))) 
                     if actual_words[i] != transcribed_words[i])
    total_mistakes = word_errors + phoneme_errors
    
    # Calculate mistake rate
    mistake_rate = total_mistakes / len(actual_words) if actual_words else 0
    
    # Calculate fluency score (0-10)
    # Components:
    accuracy_component = (similarity * 100 / 100) * 4      # Max 4 points
    rate_component = min(rate_ratio, 1.0) * 3              # Max 3 points
    error_component = max(0, 3 - (phoneme_errors / 10))    # Max 3 points
    
    fluency_score = min(10, accuracy_component + rate_component + error_component)
    
    # Calculate dyslexia probability (0-1)
    # PRIMARY FACTOR: Mistakes (60% weight)
    mistake_factor = min(1.0, mistake_rate * 2)
    
    # Secondary factors (40% combined)
    accuracy_factor = 1 - (similarity)          # 20%
    error_factor = min(1.0, phoneme_errors / 15)  # 10%
    rate_factor = max(0, (1 - rate_ratio) / 2)    # 5%
    hesitation_factor = min(1.0, hesitations / 8)  # 5%
    
    dyslexia_probability = (
        mistake_factor * 0.6 +      # PRIMARY: Mistakes
        accuracy_factor * 0.2 +      # Accuracy
        error_factor * 0.1 +         # Phoneme errors
        rate_factor * 0.05 +         # Speech rate
        hesitation_factor * 0.05     # Hesitations
    )
    
    # Generate indicators based on results
    indicators = []
    if total_mistakes > 10:
        indicators.append("High number of mistakes detected ({} total errors)".format(total_mistakes))
    elif total_mistakes > 5:
        indicators.append("Moderate number of mistakes detected ({} total errors)".format(total_mistakes))
    else:
        indicators.append("Few mistakes detected ({} total errors)".format(total_mistakes))
        
    if word_errors > 3:
        indicators.append("{} words mispronounced".format(word_errors))
        
    if phoneme_errors > 5:
        indicators.append("Significant phoneme-level errors detected")
        
    if speech_rate < 100:
        indicators.append("Slow speech rate ({:.1f} WPM)".format(speech_rate))
    elif speech_rate > 200:
        indicators.append("Fast speech rate ({:.1f} WPM)".format(speech_rate))
        
    if hesitations > 3:
        indicators.append("Frequent hesitations detected")
        
    if not indicators:
        indicators.append("No significant phonological processing concerns observed")
    
    # Generate recommendations
    recommendations = []
    if dyslexia_probability > 0.5:
        recommendations.append("Consider consulting with a specialist for comprehensive dyslexia assessment")
        
    if total_mistakes > 5:
        recommendations.append("Practice pronunciation of words that were mispronounced")
        
    if speech_rate < 120:
        recommendations.append("Practice reading aloud regularly to improve fluency")
        
    if hesitations > 3:
        recommendations.append("Work on smooth word transitions and rhythm")
        
    if not recommendations:
        recommendations.append("Continue reading aloud regularly to maintain fluency")
        recommendations.append("Practice pronunciation of challenging words")
    
    return {
        "accuracy_score": round(similarity * 100, 2),
        "word_accuracy": round(word_accuracy, 2),
        "phoneme_errors": phoneme_errors,
        "total_mistakes": total_mistakes,
        "word_errors": word_errors,
        "mistake_rate": round(mistake_rate, 4),
        "fluency_score": round(fluency_score, 2),
        "speech_rate": round(speech_rate, 1),
        "hesitations": hesitations,
        "pausing_pattern": pausing_pattern,
        "word_transitions": word_transitions,
        "dyslexia_probability": round(dyslexia_probability, 4),
        "indicators": indicators,
        "recommendations": recommendations,
        "actual_text": normalized_actual,
        "transcribed_text": normalized_transcribed
    }


# ----------------------------------
# ENDPOINT 1: SAVE SINGLE CANVAS LETTER
# ----------------------------------
@app.route("/save_sample", methods=["POST"])
def save_sample():
    # Log the incoming request for debugging
    print(f"Received request: {request.json}")
    
    # Handle both 'imageData' (new format) and 'image_base64' (frontend format)
    data = request.json.get("imageData") or request.json.get("image_base64")

    if not data:
        print("No image data found in request")
        return jsonify({"error": "No image data received"}), 400

    try:
        # Validate that data looks like base64
        if not isinstance(data, str) or "," not in data:
            print(f"Invalid data format received: {type(data)}")
            return jsonify({"error": "Invalid image data format"}), 400
            
        header, encoded = data.split(",", 1)
        img_bytes = base64.b64decode(encoded)

        filename = f"{uuid.uuid4().hex}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        with open(filepath, "wb") as f:
            f.write(img_bytes)

        print(f"Successfully saved image: {filepath}")
        return jsonify({"path": filepath})
    except Exception as e:
        print(f"Error saving image: {str(e)}")
        return jsonify({"error": "Failed to save image", "details": str(e)}), 500


# ----------------------------------
# ENDPOINT 2: PREDICT THE 5 LETTER IMAGES
# ----------------------------------
@app.route("/predict_handwriting", methods=["POST"])
def predict_handwriting():
    print(f"Received prediction request: {request.json}")
    
    # Handle both 'paths' (new format) and 'image_paths' (frontend format)
    paths = request.json.get("paths") or request.json.get("image_paths")

    if not paths:
        print("No image paths found in request")
        return jsonify({"error": "No image paths provided"}), 400
        
    if not isinstance(paths, list) or len(paths) != 5:
        print(f"Invalid paths format: {type(paths)} with length {len(paths) if isinstance(paths, list) else 'N/A'}")
        return jsonify({"error": f"Exactly 5 image paths are required, got {len(paths) if isinstance(paths, list) else 'non-list'}"}), 400

    results = []
    sigmoid_values = []

    try:
        # Get backend directory
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        
        for path in paths:
            # Construct full path if needed
            if not os.path.isabs(path):
                full_path = os.path.join(backend_dir, path)
            else:
                full_path = path
                
            # Check if file exists
            if not os.path.exists(full_path):
                print(f"File not found: {full_path}")
                return jsonify({"error": f"File not found: {full_path}"}), 404
                
            # Canvas samples = invert → True
            img_tensor = preprocess_image(full_path, is_canvas=True)

            start_inference = time.perf_counter()
            prob = float(model.predict(img_tensor)[0][0])
            inference_time = (time.perf_counter() - start_inference) * 1000
            print(f"[ML] inference completed in {inference_time:.2f} ms")
            label, confidence = sigmoid_to_label(prob)

            sigmoid_values.append(prob)

            results.append({
                "path": path,  # Return the original path sent by frontend
                "sigmoid_output": prob,
                "prediction": label,
                "confidence": float(confidence),
            })

        # Final score = AVERAGE of sigmoid (more mathematically correct)
        avg_prob = sum(sigmoid_values) / len(sigmoid_values)

        final_label, _ = sigmoid_to_label(avg_prob)
        dyslexia_score_percent = (1 - avg_prob) * 100  # Dyslexia confidence (%)

        return jsonify({
            "final_label": final_label,
            "dyslexia_score": round(dyslexia_score_percent, 2),
            "average_sigmoid_output": float(avg_prob),
            "letter_results": results
        })

    except Exception as e:
        return jsonify({"error": "Prediction failed", "details": str(e)}), 500


# ----------------------------------
# ENDPOINT 3: ANALYZE SPEECH PATTERNS
# ----------------------------------
@app.route("/analyze_speech", methods=["POST", "OPTIONS"])
def analyze_speech():
    if request.method == "OPTIONS":
        # Handle preflight CORS request
        return jsonify({"status": "ok"}), 200
    
    print(f"Received speech analysis request: {request.json}")
    
    # Get JSON data
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "No data provided. Please send JSON data."}), 400
    
    # Extract required fields
    transcribed_text = data.get("transcribed_text", "")
    actual_text = data.get("actual_text", "")
    recording_time = data.get("recording_time", 0)
    
    # Validate inputs
    if not actual_text:
        return jsonify({"error": "Actual text is required for comparison."}), 400
    
    # Calculate speech metrics
    try:
        metrics = calculate_speech_metrics(transcribed_text, actual_text, recording_time)
        return jsonify(metrics)
    except Exception as e:
        print(f"Error analyzing speech: {str(e)}")
        return jsonify({
            "error": "Internal server error",
            "message": str(e)
        }), 500


# ----------------------------------
# ENDPOINT 4: ADMIN APPROVE DOCTOR
# ----------------------------------
@app.route("/admin/approve-doctor", methods=["POST"])
def approve_doctor():
    data = request.json
    doctor_id = data.get("doctor_id")

    if not doctor_id:
        return jsonify({"error": "doctor_id is required"}), 400

    try:
        # Update doctor status to approved
        # Using service_role key bypasses RLS
        start_db = time.perf_counter()
        response = supabase.table("doctors").update({"status": "approved"}).eq("id", doctor_id).execute()
        db_time = (time.perf_counter() - start_db)
        print(f"[DB] query (update) completed in {db_time*1000:.2f} ms")
        
        if db_time > DB_QUERY_THRESHOLD:
            print(f"⚠️ WARNING: DB query > 500ms ({db_time*1000:.2f} ms)")
        
        # Check if any row was updated
        if not response.data:
             return jsonify({"error": "Doctor not found or update failed"}), 404

        return jsonify({"message": "Doctor approved successfully", "data": response.data}), 200
    except Exception as e:
        print(f"Error approving doctor: {str(e)}")
        return jsonify({"error": str(e)}), 500



# ----------------------------------
# ENDPOINT 5: ADMIN GET PENDING DOCTORS
# ----------------------------------
@app.route("/admin/pending-doctors", methods=["GET"])
def get_pending_doctors():
    try:
        # Fetch status='pending'
        start_db = time.perf_counter()
        response = supabase.table("doctors").select("*").eq("status", "pending").execute()
        db_time = (time.perf_counter() - start_db) * 1000
        print(f"[DB] query (select pending) completed in {db_time:.2f} ms")
        return jsonify(response.data), 200
    except Exception as e:
        print(f"Error fetching pending doctors: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------------------------
# ENDPOINT 7: ADMIN GET ALL DOCTORS
# ----------------------------------
@app.route("/admin/all-doctors", methods=["GET"])
def get_all_doctors():
    try:
        # Fetch all doctors ordered by created_at desc
        response = supabase.table("doctors").select("*").order("created_at", desc=True).execute()
        return jsonify(response.data), 200
    except Exception as e:
        print(f"Error fetching all doctors: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------------------------
# ENDPOINT 6: ADMIN REJECT DOCTOR
# ----------------------------------
@app.route("/admin/reject-doctor", methods=["POST"])
def reject_doctor():
    data = request.json
    doctor_id = data.get("doctor_id")

    if not doctor_id:
        return jsonify({"error": "doctor_id is required"}), 400

    try:
        # Update status to 'rejected' (or we could delete)
        # Using service_role key
        response = supabase.table("doctors").update({"status": "rejected"}).eq("id", doctor_id).execute()
        
        if not response.data:
             return jsonify({"error": "Doctor not found or update failed"}), 404

        return jsonify({"message": "Doctor rejected successfully", "data": response.data}), 200
    except Exception as e:
        print(f"Error rejecting doctor: {str(e)}")
        return jsonify({"error": str(e)}), 500


# ----------------------------------
# START FLASK
# ----------------------------------
if __name__ == "__main__":
    # In debug mode, Flask runs two processes. The reloader process has WERKZEUG_RUN_MAIN set.
    # We only want to initialize the heavy model in the child process that actually serves requests.
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        init_app()
        
    app.run(host="0.0.0.0", port=5000, debug=True)