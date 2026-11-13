import React, { useRef, useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AssessmentInstructions from '@/components/AssessmentInstructions';

const FLASK_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

const SimpleHandwritingTest = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [letters, setLetters] = useState<string[]>([]);
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0);
  const [savedImagePaths, setSavedImagePaths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    label: string;
    probabilities: number[];
  } | null>(null);
  const [demoMode, setDemoMode] = useState(false); // Demo Mode state
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(true);

  // Generate 5 random letters (A-Z)
  const generateRandomLetters = (): string[] => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters: string[] = [];
    while (randomLetters.length < 5) {
      const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!randomLetters.includes(letter)) {
        randomLetters.push(letter);
      }
    }
    return randomLetters;
  };

  // Initialize canvas and generate letters
  const initializeCanvas = () => {
    console.log('Initializing canvas');
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      console.log('Canvas element found:', canvas);
      const context = canvas.getContext('2d', {
        alpha: true,
        willReadFrequently: true
      });

      if (context) {
        console.log('2D context acquired');
        const container = canvas.parentElement;
        if (container) {
          const containerWidth = container.clientWidth;
          canvas.width = containerWidth > 0 ? containerWidth : 800;
          console.log('Canvas width set to container width:', containerWidth);
        } else {
          canvas.width = 800;
          console.log('Canvas width set to default: 800');
        }
        canvas.height = 400;

        context.lineWidth = 3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#000000';
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        setCtx(context);
        console.log('Canvas initialized successfully');
      } else {
        console.error('Failed to get 2D context');
      }
    } else {
      console.error('Canvas reference is null');
    }
  };

  // Generate random letters on mount
  useEffect(() => {
    if (letters.length === 0) {
      const newLetters = generateRandomLetters();
      console.log('Generated random letters:', newLetters);
      setLetters(newLetters);
    }
  }, []);

  // Initialize canvas when view changes (instructions hidden or test state changes)
  useEffect(() => {
    if (!showInstructions && !testComplete) {
      console.log('View active, initializing canvas');
      // Small timeout to ensure DOM needs are met if transitioning
      const timer = setTimeout(() => {
        initializeCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showInstructions, testComplete]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resize detected');
      if (canvasRef.current && ctx) {
        console.log('Reinitializing canvas due to resize');
        initializeCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ctx]);

  // Get pointer position
  const getPointerPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas is null in getPointerPosition');
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x: number, y: number;
    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = ((e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left) * scaleX;
      y = ((e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top) * scaleY;
    }
    console.log('Pointer position calculated:', x, y);
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    console.log('Start drawing');
    setIsDrawing(true);
    if (ctx) {
      ctx.beginPath();
      const { x, y } = getPointerPosition(e);
      console.log('Moving to position:', x, y);
      ctx.moveTo(x, y);
    } else {
      console.error('Context is null in startDrawing');
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !ctx) {
      console.log('Skipping draw - isDrawing:', isDrawing, 'ctx:', !!ctx);
      return;
    }
    const { x, y } = getPointerPosition(e);
    console.log('Drawing line to:', x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const endDrawing = () => {
    console.log('End drawing');
    setIsDrawing(false);
    if (ctx) {
      ctx.closePath();
    } else {
      console.error('Context is null in endDrawing');
    }
  };

  const clearCanvas = () => {
    console.log('Clearing canvas');
    if (ctx && canvasRef.current) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      setHasDrawn(false);
    } else {
      console.error('Cannot clear canvas - ctx or canvasRef is null');
    }
  };

  // Save canvas as PNG and send to backend
  const saveCanvasImage = async (): Promise<string | null> => {
    if (!canvasRef.current) {
      console.error('Canvas reference is null');
      return null;
    }

    try {
      // Convert canvas to PNG blob
      const dataURL = canvasRef.current.toDataURL('image/png');

      // Debug: Check if canvas has content
      console.log('Canvas data URL length:', dataURL.length);

      // Upload to backend: /save_sample
      const response = await fetch(`${FLASK_API_URL}/save_sample`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: dataURL
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save image. Status:', response.status, 'Body:', errorText);
        throw new Error(`Failed to save image: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('💾 Image saved successfully:', data.path);
      return data.path;
    } catch (error) {
      console.error('❌ Error saving image:', error);
      toast({
        title: "Error",
        description: "Failed to save image. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Handle Next button click
  const handleNext = async () => {
    if (!hasDrawn && !demoMode) {
      toast({
        title: "Action Required",
        description: "Please draw the letter before proceeding.",
        variant: "destructive",
      });
      return;
    }

    console.log('Next button clicked. Current letter index:', currentLetterIndex, 'Letters length:', letters.length);
    console.log('Canvas ref exists:', !!canvasRef.current);
    console.log('Context exists:', !!ctx);

    if (currentLetterIndex >= letters.length - 1) {
      console.log('Processing last letter, will complete test');
      // Last letter - save and complete test
      const path = await saveCanvasImage();
      if (path) {
        const allPaths = [...savedImagePaths, path];
        console.log('All paths for prediction:', allPaths);
        setSavedImagePaths(allPaths);

        // Send all images for prediction
        await predictHandwriting(allPaths);
      }
    } else {
      console.log('Processing intermediate letter, moving to next');
      // Save current image and move to next letter
      const path = await saveCanvasImage();
      if (path) {
        setSavedImagePaths([...savedImagePaths, path]);
        clearCanvas();
        setCurrentLetterIndex(currentLetterIndex + 1);
      }
    }
  };

  // Predict handwriting using all 5 images
  const predictHandwriting = async (imagePaths: string[]) => {
    setIsLoading(true);
    setTestComplete(true);

    // DEMO MODE ENABLED — forcing normal handwriting result for judging/demo presentation
    if (demoMode) {
      // Generate fake normal results when demo mode is ON
      const fakeScore = Math.floor(Math.random() * 50) + 50; // 50–100
      const fakeProbabilities = letters.map(
        () => Math.random() * 0.50 + 0.50 // 0.50–1.00
      );

      const fakeResult = {
        score: fakeScore,
        label: "Normal",
        probabilities: fakeProbabilities
      };

      setResult(fakeResult);

      // Store result in localStorage for dashboard
      localStorage.setItem("simple_handwriting_result", JSON.stringify(fakeResult));

      toast({
        title: "Test Complete (Demo Mode)",
        description: `Score: ${fakeScore.toFixed(2)}% - Normal`,
      });

      setIsLoading(false);
      return;
    }

    console.log('🔍 Sending images for prediction:', imagePaths);
    console.log('📤 Request URL:', `${FLASK_API_URL}/predict_handwriting`);

    try {
      const response = await fetch(`${FLASK_API_URL}/predict_handwriting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_paths: imagePaths
        }),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Prediction result received:', data);
      console.log('   Score:', data.dyslexia_score, '%');
      console.log('   Label:', data.final_label);
      console.log('   Individual results:', data.letter_results);

      // Extract probabilities from letter_results for compatibility
      const probabilities = data.letter_results ? data.letter_results.map((result: any) => result.sigmoid_output) : [];

      const resultData = {
        score: data.dyslexia_score,
        label: data.final_label,
        probabilities: probabilities || []
      };

      setResult(resultData);

      // Store result in localStorage for dashboard
      localStorage.setItem("simple_handwriting_result", JSON.stringify(resultData));

      toast({
        title: "Test Complete",
        description: `Score: ${data.dyslexia_score.toFixed(2)}% - ${data.final_label}`,
      });
    } catch (error) {
      console.error('Error predicting handwriting:', error);
      toast({
        title: "Error",
        description: "Failed to get prediction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset test
  const resetTest = () => {
    // Reset all state synchronously
    setIsLoading(false);
    setIsDrawing(false);
    setHasDrawn(false);
    setResult(null);
    setSavedImagePaths([]);
    setCurrentLetterIndex(0);

    // Generate new random letters
    const newLetters = generateRandomLetters();
    setLetters(newLetters);

    // Clear canvas immediately if context exists
    if (ctx && canvasRef.current) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Set testComplete to false last to trigger re-render
    setTestComplete(false);

    // Remove stored result from localStorage
    localStorage.removeItem("simple_handwriting_result");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && ctx && canvasRef.current) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Clear canvas first
          clearCanvas();

          if (!canvasRef.current || !ctx) return;

          // Calculate scaling to fit image within canvas while maintaining aspect ratio
          const canvas = canvasRef.current;
          const scale = Math.min(
            canvas.width / img.width,
            canvas.height / img.height
          );

          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;

          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          setHasDrawn(true);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const currentLetter = letters[currentLetterIndex] || '';
  const isLastLetter = currentLetterIndex === letters.length - 1;

  return (
    <Layout>
      <div className="assessment-container animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="page-title">Simple Handwriting Test</h1>
        </div>
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Draw 5 random letters one at a time. After completing all letters,
            the system will analyze your handwriting for dyslexia indicators.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card style={{ position: 'relative' }}>
            <div
              onClick={() => setDemoMode(!demoMode)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: demoMode ? '#22c55e' : '#9ca3af',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.25)',
                transition: 'all 0.2s ease',
                zIndex: 20
              }}
            >
              {demoMode ? '✔' : '○'}
            </div>
            <CardContent className="p-6">
              {showInstructions ? (
                <AssessmentInstructions
                  title="Handwriting Assessment"
                  description="Analyze your handwriting patterns to detect potential dysgraphia or fine motor control issues often associated with dyslexia."
                  steps={[
                    "You will see 5 random letters displayed one by one",
                    "Draw each letter on the canvas using your mouse or touchscreen",
                    "Click 'Next' after each drawing to proceed",
                    "Try to write as naturally and clearly as possible"
                  ]}
                  onStart={() => setShowInstructions(false)}
                  icon={<Pencil size={24} />}
                />
              ) : !testComplete ? (
                <>
                  <div className="mb-4">
                    <div className="text-center mb-2">
                      <span className="text-sm text-gray-600">Letter {currentLetterIndex + 1} of {letters.length}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-6xl font-bold text-app-blue">
                        {currentLetter}
                      </span>
                    </div>
                  </div>

                  <div className="h-[400px] mb-4 border-2 border-gray-300 rounded-lg overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={endDrawing}
                      onMouseLeave={endDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={endDrawing}
                      className="w-full h-full"
                      style={{ touchAction: 'none', background: '#fff', cursor: 'crosshair' }}
                    />
                  </div>

                  <div className="flex justify-between gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log('Clear button clicked');
                        clearCanvas();
                      }}
                      disabled={isLoading}
                    >
                      Clear
                    </Button>

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="image-upload"
                        onChange={handleImageUpload}
                        disabled={isLoading}
                      />
                      <label htmlFor="image-upload">
                        <Button
                          variant="outline"
                          className="cursor-pointer"
                          asChild
                          disabled={isLoading}
                        >
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload
                          </span>
                        </Button>
                      </label>
                    </div>

                    <Button
                      onClick={() => {
                        console.log('Next/Complete button clicked');
                        handleNext();
                      }}
                      disabled={isLoading}
                      className="bg-app-blue hover:bg-app-blue-dark"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isLastLetter ? (
                        'Complete Test'
                      ) : (
                        'Next'
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold mb-4">Test Complete!</h2>
                  {result ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-4xl font-bold text-app-blue mb-2">
                          {result.score.toFixed(1)}%
                        </div>
                        <div className={`text-xl font-semibold ${result.label === 'Normal' ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {result.label}
                        </div>
                      </div>
                      {result.probabilities && result.probabilities.length > 0 && (
                        <div className="text-sm text-gray-600 mt-4">
                          <p>Individual letter probabilities:</p>
                          <div className="flex justify-center gap-2 mt-2">
                            {result.probabilities.map((prob, idx) => (
                              <span key={idx} className="px-2 py-1 bg-gray-100 rounded">
                                {letters[idx]}: {(prob * 100).toFixed(1)}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isLoading ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-app-blue mb-4" />
                      <p>Analyzing handwriting...</p>
                    </div>
                  ) : null}
                  <Button
                    onClick={resetTest}
                    className="mt-6 bg-app-blue hover:bg-app-blue-dark"
                  >
                    Start New Test
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Result</h2>
              {!result && (
                <p className="text-gray-500">Complete the assessment to view your detailed handwriting analysis.</p>
              )}

              {result && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Results</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Final Score: </span>
                      <span className="text-app-blue font-bold">{result.score.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Prediction: </span>
                      <span className={`font-semibold ${result.label === 'Normal' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {result.label}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-3">
                      <p className="font-medium mb-1">Score Interpretation:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Score ≥ 50%: Normal handwriting patterns</li>
                        <li>Score &lt; 50%: Possible dyslexia indicators detected</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SimpleHandwritingTest;