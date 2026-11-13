"""
OpenCV Utilities for Feature Extraction from Handwriting Images
Extracts handwriting features from base64 encoded canvas images
"""

import cv2
import numpy as np
import base64
from PIL import Image
import io
from typing import Dict, Optional


def decode_base64_image(image_base64: str) -> np.ndarray:
    """
    Decode base64 encoded image to OpenCV format
    
    Args:
        image_base64: Base64 encoded image string (with or without data URL prefix)
    
    Returns:
        OpenCV image (numpy array in BGR format)
    """
    try:
        # Remove data URL prefix if present (e.g., "data:image/png;base64,")
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_base64)
        
        # Convert to PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Convert to numpy array
        image_array = np.array(pil_image)
        
        # Convert RGB to BGR for OpenCV
        image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        return image_bgr
    
    except Exception as e:
        raise Exception(f"Error decoding base64 image: {str(e)}")


def extract_features_from_image(image_base64: str, timestamps: Optional[list] = None) -> Dict[str, float]:
    """
    Extract handwriting features from base64 encoded canvas image
    
    Args:
        image_base64: Base64 encoded image string
        timestamps: Optional list of timestamps for stroke timing (if available)
    
    Returns:
        Dictionary with extracted features:
        - Stroke_Count
        - Avg_Stroke_Duration (if timestamps provided)
        - Avg_Spacing_mm
        - Variance_mm2
    """
    try:
        # Decode image
        image = decode_base64_image(image_base64)
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply threshold to get binary image (handwriting in white)
        # Invert if needed (handwriting is usually dark on light background)
        _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
        
        # Find contours (each contour represents a stroke or connected component)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter out very small contours (noise)
        min_contour_area = 50  # pixels
        valid_contours = [c for c in contours if cv2.contourArea(c) > min_contour_area]
        
        # Feature 1: Stroke Count
        stroke_count = len(valid_contours)
        
        # Feature 2: Average Stroke Duration (if timestamps available)
        avg_stroke_duration = 0.45  # Default value
        if timestamps and len(timestamps) > 1:
            total_time = timestamps[-1] - timestamps[0]
            if total_time > 0:
                avg_stroke_duration = total_time / len(timestamps)
        
        # Feature 3 & 4: Letter Spacing Analysis
        # Get bounding boxes for each contour
        bounding_boxes = []
        for contour in valid_contours:
            x, y, w, h = cv2.boundingRect(contour)
            bounding_boxes.append({
                'x': x,
                'y': y,
                'width': w,
                'height': h,
                'right': x + w,  # Right edge
                'left': x  # Left edge
            })
        
        # Sort bounding boxes by X position (left to right)
        bounding_boxes.sort(key=lambda box: box['left'])
        
        # Calculate spacing between consecutive letters (horizontal gaps)
        spacings = []
        for i in range(len(bounding_boxes) - 1):
            current_right = bounding_boxes[i]['right']
            next_left = bounding_boxes[i + 1]['left']
            
            # Calculate gap (spacing)
            gap = next_left - current_right
            
            if gap > 0:  # Only positive gaps (left-to-right writing)
                # Convert pixels to mm (assuming ~96 DPI, 1 inch = 25.4mm)
                # Adjust this conversion factor based on your canvas size
                pixels_per_mm = 3.78  # Approximate conversion (96 DPI / 25.4mm)
                spacing_mm = gap / pixels_per_mm
                spacings.append(spacing_mm)
        
        # Calculate average spacing
        avg_spacing_mm = np.mean(spacings) if spacings else 1.3  # Default value
        
        # Calculate variance of spacing
        variance_mm2 = np.var(spacings) if len(spacings) > 1 else 0.7  # Default value
        
        # Ensure values are within expected ranges
        avg_spacing_mm = np.clip(avg_spacing_mm, 0.8, 2.2)
        variance_mm2 = np.clip(variance_mm2, 0.05, 2.0)
        
        # Return extracted features
        features = {
            'Stroke_Count': float(stroke_count),
            'Avg_Stroke_Duration': float(avg_stroke_duration),
            'Avg_Spacing_mm': float(avg_spacing_mm),
            'Variance_mm2': float(variance_mm2)
        }
        
        return features
    
    except Exception as e:
        print(f"⚠️ Error extracting features from image: {str(e)}")
        # Return default values if extraction fails
        return {
            'Stroke_Count': 10.0,
            'Avg_Stroke_Duration': 0.45,
            'Avg_Spacing_mm': 1.3,
            'Variance_mm2': 0.7
        }

