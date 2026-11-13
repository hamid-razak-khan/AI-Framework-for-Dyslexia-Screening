# Project Summary: Mindful Cognitive Lens

## Project Overview
- A web application for dyslexia assessment combining handwriting, cognitive, and speech/reading evaluations.
- Frontend built with React, TypeScript, Vite, shadcn-ui, Tailwind CSS.
- Backend (optional/legacy plus ML services) built with Flask, integrating classical ML (Random Forest) and deep learning (MobileNetV2-based handwriting model).
- Includes AI-powered chatbot (Google Gemini) and doctor-facing dashboard with PDF reporting.

## Features
### Handwriting Assessment
- Canvas-based drawing of letters; images saved by Flask backend and analyzed by a Keras MobileNetV2 model.
- Older flow: feature-based analysis via Random Forest using spelling errors, reversals, timing, stroke counts, spacing, and variance.
- Results (score, label, per-letter probabilities) are stored in `simple_handwriting_result` in `localStorage` and consumed by the main dashboard and doctor dashboard.

### Cognitive Assessment
- Memory (sequence recall), attention (reaction/focus), and problem-solving (pattern, sequence, analogy, rotation) tests.
- Uses React components, hooks, and LocalStorage to track performance and compute dyslexia indicators.

### Speech & Reading Assessment
- Real-time microphone recording with MediaRecorder + Web Audio API; optional audio upload.
- Live transcription via Web Speech API with fallbacks when unavailable.
- Backend `/analyze_speech` endpoint computes accuracy, phoneme errors, fluency score (0–10), speech rate, hesitations, and a dyslexia probability.
- Results saved in `speech_result` in LocalStorage for dashboard aggregation.

### Dashboard & Doctor Workflow
- Dashboard aggregates handwriting, cognitive, and speech assessments into a combined Dyslexia Risk Index with charts (radar, bar, line) and recommendations.
- Doctor dashboard handles registration, appointment data, report viewing and PDF export, using LocalStorage as a mock backend.
- Doctor appointment flow depends on completion of all assessments and consistent use of `simple_handwriting_result` data.

### Chatbot
- Optional Gemini-based chatbot that answers questions about dyslexia assessment and testing.
- Uses `VITE_GEMINI_API_KEY` for online mode; has an offline rules-based fallback.

## Tech Stack
### Frontend
- React 18, TypeScript 5, Vite 5.
- shadcn-ui + Radix UI + Tailwind CSS + tailwind-animate for accessible, animated UI.
- React Hook Form + Zod for type-safe forms.
- Recharts for data visualization.
- jsPDF + html2canvas for client-side PDF generation.
- TanStack Query for future server-state management; currently most data is LocalStorage-backed.
- Lucide React icons, Sonner + Radix Toast for notifications; date-fns + react-day-picker for dates.

### Backend / Models
- Flask + flask-cors for REST endpoints.
- Two handwriting pipelines:
  - **Classical**: RandomForest model (`random_forest_dyslexia_model.pkl`) with scalers, consuming engineered handwriting features.
  - **Deep learning**: MobileNetV2-based Keras model (`simple_dyslexia_model_fixed.keras` preferred, `.h5` as fallback) consuming 224×224 RGB images.
- OpenCV + Pillow + EasyOCR + Tesseract (via pytesseract) for image/OCR support.
- Speech backend uses Python `difflib` and regex to compare transcribed vs reference text and derive detailed speech metrics.

## Models & Evaluation
### Handwriting Models
- **Random Forest flow** (`INTEGRATION_GUIDE.md`, `Backend/README.md`):
  - Frontend extracts counts and timing from handwriting plus optional OpenCV features.
  - Features standardized and normalized, then passed to the RandomForest to predict Dyslexic / Non-Dyslexic, returning label, probability, message, and echoing features.

- **MobileNetV2 deep model** (`HANDWRITING_ASSESSMENT_SETUP.md`, `MODEL_EVALUATION_REPORT.md`, preprocessing docs):
  - SimpleHandwritingTest draws 5 letters; backend saves each canvas image and preprocesses:
    - Load image, grayscale + invert for canvas, resize to 224×224, expand to 3 channels, MobileNetV2 normalization `[-1,1]`, batch dimension.
  - Model outputs a sigmoid probability per image; probabilities averaged, then converted into a final label and dyslexia risk score.
  - Several iterations fixed preprocessing (correct channels, normalization) and label interpretation (inverting probabilities due to swapped training labels).
  - Current evaluation report concludes: **system pipeline is operational but model weights are effectively untrained**, giving ~0.5 probabilities and requiring proper retraining with labeled handwriting data.

### Speech Model / Analysis
- Backend `/analyze_speech` computes:
  - Word accuracy and similarity using `SequenceMatcher`.
  - Phoneme-level error estimates via character-level edit operations.
  - Speech rate, hesitations, pausing pattern, word transitions.
  - Fluency score (0–10) and dyslexia probability by combining mistake rate, accuracy, phoneme errors, rate, and hesitations.
- Returns metrics, indicators, and recommendations; frontend stores a compact summary in `speech_result` for dashboards.

## Fixes & Iterations
### Handwriting & Model Fixes
- **Label Reversal Fix** (`LABEL_FIX_APPLIED.md`, `LABEL_REVERSAL_FIX.md`):
  - Discovered that training labels were inverted (0 = Dyslexic, 1 = Normal) relative to app expectations.
  - Fixed by inverting probabilities or reversing threshold logic so high model output now correctly maps to "Normal" and low output to "Dyslexic"; dyslexia risk score is based on the inverted probability.

- **Preprocessing Mismatch Fixes** (`PREPROCESSING_MISMATCH_FIX.md`, `PREPROCESSING_ISSUES_FIXED.md`, `PREPROCESSING_UPDATED_CLEAN.md`):
  - Identified multiple preprocessing problems: wrong normalization range (`[0,1]` vs required `[-1,1]`), grayscale vs RGB channel expectations, and shape mismatches.
  - Updated `model_utils.py` to:
    - Load images correctly (BGR→RGB for color, or grayscale→RGB where appropriate).
    - Resize to 224×224 and normalize with MobileNetV2’s `[-1,1]` convention.
    - Ensure final tensors are `(1, 224, 224, 3)`.
  - Cleaned up model loading logic to a simpler, well-documented `load_keras_model` with clear path priority and error reporting.

- **Model Loading Clarification** (`WHICH_MODEL_IS_LOADING.md`, `MODEL_EVALUATION_REPORT.md`):
  - Documented that the backend prefers `simple_dyslexia_model_fixed.keras` and falls back to `simple_dyslexia_model.h5`.
  - Confirmed that both files likely share weights and currently produce neutral (0.5) outputs, so the core next step is retraining on real handwriting data.

### Dashboard & Data Flow Fixes
- **Handwriting Dashboard Integration** (`SIMPLE_HANDWRITING_DASHBOARD_FIX.md`):
  - Ensured SimpleHandwritingTest stores results under `simple_handwriting_result` with `{ score, label, probabilities }`.
  - Updated dashboard to read this key and display the new structure (using `score` instead of `percent`, and showing per-letter probabilities).
  - Removed the old, unused `HandwritingAssessment.tsx` component.

- **Doctor Appointment Functionality** (`DOCTOR_APPOINTMENT_FIXES.md`):
  - Fixed `hasCompletedAllAssessments` and `getAssessmentData` to use the `simple_handwriting_result` key.
  - Updated DoctorDashboard and PDF generation to reference `handwriting.score` rather than the old `handwriting.percent`.
  - Verified that appointment creation, viewing, and report export now read consistent handwriting data.

### Backend Setup & OCR
- **Backend Setup & APIs** (`Backend/README.md`, `INTEGRATION_GUIDE.md`, `HANDWRITING_ASSESSMENT_SETUP.md`):
  - Doc files cover how to install Backend dependencies, verify model files, start the Flask server, and test endpoints (`/health`, `/analyze_handwriting`, `/predict_handwriting`, `/predict`, `/analyze_speech`).
  - Explain feature ranges and the exact JSON contracts for handwriting and speech endpoints.

- **Tesseract Installation** (`Backend/INSTALL_TESSERACT.md`):
  - Provides OS-specific instructions (Windows, Linux, macOS) for installing Tesseract OCR.
  - Notes that EasyOCR can act as a fallback when Tesseract is absent, though Tesseract is required for certain text-extraction routes.

## Current Model & System Status
- **System:** Backend endpoints, frontend flows, and integration between components are operational.
- **Handwriting Model:** Preprocessing and label logic are now correct but the current Keras models behave like untrained/neutral networks (output ≈ 0.5 for all inputs).
- **Recommendation:** Collect a substantial labeled handwriting dataset (e.g., 200+ normal and 200+ dyslexic samples), retrain the MobileNetV2-based model with the documented preprocessing, and deploy the new weights to `Backend/trained models/`.

## Files Included in This Summary
- Root `README.md` (project overview and basic usage)
- `FEATURES_AND_TECH_STACK.md` (detailed feature and stack description)
- `INTEGRATION_GUIDE.md` (RandomForest handwriting integration)
- `MODEL_EVALUATION_REPORT.md` (deep model evaluation and retraining recommendation)
- `SIMPLE_HANDWRITING_DASHBOARD_FIX.md` (dashboard integration)
- `SPEECH_ASSESSMENT_README.md` (speech assessment design)
- `DOCTOR_APPOINTMENT_FIXES.md` (appointment flow fixes)
- `LABEL_FIX_APPLIED.md`, `LABEL_REVERSAL_FIX.md` (label logic fixes)
- `PREPROCESSING_*` docs (preprocessing corrections)
- `WHICH_MODEL_IS_LOADING.md` (model loading priority)
- `Backend/README.md`, `Backend/HANDWRITING_ASSESSMENT_SETUP.md`, `Backend/INSTALL_TESSERACT.md` (backend and OCR setup)
