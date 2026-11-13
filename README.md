# AI Framework for Dyslexia Screening (Mindful Cognitive Lens) 🧠

## 📋 Problem Statement
Dyslexia is a learning difference that affects reading, writing, and spelling. It is often undiagnosed or misdiagnosed in children, leading to academic struggles and low self-esteem. Early detection is crucial for effective intervention. "Mindful Cognitive Lens" aims to bridge this gap by providing an accessible, AI-powered screening tool that analyzes handwriting, cognitive skills, and speech patterns to identify potential risk factors for dyslexia.

## 🚀 Solution Overview
Mindful Cognitive Lens is a comprehensive web application that offers a multi-modal assessment approach:
1.  **Handwriting Analysis**: Uses a Deep Learning (CNN) model to analyze handwriting samples for reversal errors and irregularities.
2.  **Cognitive Assessment**: Interactive games to test working memory, attention span, and problem-solving skills.
3.  **Speech & Reading Analysis**: Evaluates reading fluency and accuracy using speech recognition technology.
4.  **AI Chatbot Assistant**: Provides guidance and answers questions about dyslexia and the assessment process.
5.  **Doctor Appointment System**: Facilitates connecting with professionals for further evaluation.

## ✨ Key Features
-   **Multi-Modal Assessment**: Combines Handwriting, Cognitive, and Speech tests for a holistic risk profile.
-   **Real-time AI Analysis**: Instant feedback and risk calculation.
-   **Interactive Dashboard**: Visualizes performance metrics (Fluency, Accuracy, Memory, Attention).
-   **PDF Report Generation**: Downloadable reports for parents and educators.
-   **Appointment Booking**: Seamless integration to book slots with specialists.
-   **Secure Authentication**: Patient login via Clerk (Google/Email) and secure data storage in Supabase.

## 🛠️ Tech Stack

### Frontend
-   **Framework**: React (Vite)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS, Shadcn/UI
-   **State Management**: React Hooks (useState, useEffect, useContext)
-   **Authentication**: Clerk (`@clerk/clerk-react`)
-   **Charts**: Recharts
-   **PDF Generation**: jsPDF, html2canvas

### Backend
-   **Framework**: Flask (Python)
-   **AI/ML**: TensorFlow/Keras (CNN Model), OpenCV, Scikit-learn, NumPy
-   **Database**: Supabase (PostgreSQL)
-   **Environment Management**: Python venv

## ⚙️ Installation & Setup

### Prerequisites
-   **Node.js** (v18+ recommended)
-   **Python** (v3.9+ recommended)
-   **Git**

### 1. Clone the Repository
```bash
git clone <repository_url>
cd mindful-cognitive-lens
```

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment.

```bash
cd Backend
python -m venv venv

# Activate Virtual Environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt
```

**Environment Variables (Backend):**
Create a `.env` file in the `Backend` directory (or ensure system env vars are set) with your Supabase credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

**Run the Server:**
```bash
python app.py
```
*The backend server typically runs on `http://localhost:5000`.*

### 3. Frontend Setup
Open a new terminal and navigate to the root directory (where `package.json` is).

```bash
# Install Node Dependencies
npm install

# Setup Environment Variables
# Create a .env file in the root directory
```

**Frontend `.env`:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... (Your Clerk Key)
VITE_GEMINI_API_KEY=... (For Chatbot)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Run the Application:**
```bash
npm run dev
```
*The frontend will typically run on `http://localhost:8080` (or the port shown in terminal).*

## 📖 Usage Guide

1.  **Login**: Access the application and log in as a Patient using Google or Email (via Clerk).
2.  **Dashboard**: You will land on the Dashboard showing your profile and assessment status.
3.  **Take Assessments**:
    *   **Handwriting**: Draw the requested letter on the canvas. The AI analyzes it instantly.
    *   **Cognitive**: Complete the memory and attention games.
    *   **Speech**: Read the displayed text aloud. The system records and analyzes your fluency.
4.  **View Report**: Check the "Analysis Results" card for your Dyslexia Risk Score.
5.  **Book Appointment**: If the risk is high, use the "Appointment" button to schedule a visit with a doctor.

## 📂 Project Structure

```
├── Backend/                 # Flask Backend
│   ├── app.py              # Main API Server
│   ├── requirements.txt    # Python Dependencies
│   └── trained models/     # AI Models (CNN)
│
├── src/                    # React Frontend
│   ├── components/         # Reusable UI Components (Button, Card, etc.)
│   ├── lib/                # Utilities (API, Supabase, Utils)
│   ├── pages/              # Main App Pages
│   │   ├── Dashboard.tsx
│   │   ├── SimpleHandwritingTest.tsx
│   │   ├── CognitiveAssessment.tsx
│   │   └── SpeechAssessment.tsx
│   └── App.tsx             # Main App Component & Routing
│
└── public/                 # Static Assets
```

## 🐛 Troubleshooting

*   **Backend doesn't start?**
    *   Ensure virtual environment is activated.
    *   Check if `requirements.txt` packages are installed.
    *   Verify `.env` variables for Supabase.
*   **Frontend API errors?**
    *   Ensure Backend is running on port 5000.
    *   Check `src/lib/api.ts` or `Dashboard.tsx` to see if API URLs match your local server.

## 📄 License
This project is for educational and research purposes.
