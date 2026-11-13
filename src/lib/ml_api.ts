/**
 * ML API Client for Flask Backend
 * Handles communication with the handwriting analysis ML model
 */

const FLASK_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

export interface HandwritingFeatures {
  Spelling_Errors: number;
  Reversals: number;
  Total_Writing_Time: number;
  Stroke_Count: number;
  Avg_Stroke_Duration: number;
  Avg_Spacing_mm: number;
  Direction_Changes: number;
  Variance_mm2: number;
}

export interface MLAnalysisResponse {
  Label: 'Dyslexic' | 'Non-Dyslexic';
  Probability: number;
  Message: string;
  Features: HandwritingFeatures;
}

export interface MLAnalysisRequest extends Partial<HandwritingFeatures> {
  image_base64?: string; // Optional base64 image for OpenCV processing
}

/**
 * Send handwriting features to Flask backend for ML analysis
 */
export const analyzeHandwritingML = async (
  features: MLAnalysisRequest
): Promise<MLAnalysisResponse> => {
  try {
    const response = await fetch(`${FLASK_API_URL}/analyze_handwriting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(features),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data: MLAnalysisResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling ML API:', error);
    throw error;
  }
};

/**
 * Check if Flask backend is healthy
 */
export const checkMLBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${FLASK_API_URL}/health`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      return data.models_loaded === true;
    }
    return false;
  } catch (error) {
    console.error('ML backend health check failed:', error);
    return false;
  }
};

