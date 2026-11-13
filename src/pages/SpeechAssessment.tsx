
import React, { useState, useRef, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Headphones, Mic, MicOff, Play, Square, FileText, Upload, Loader2, RefreshCw, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import AssessmentInstructions from '@/components/AssessmentInstructions';

const SpeechAssessment = () => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dyslexiaResult, setDyslexiaResult] = useState<{
    detected: boolean;
    percent: number;
    indicators: string[];
  } | null>(null);
  const [assessmentMetrics, setAssessmentMetrics] = useState<{
    fluency: number;
    accuracy: number;
    riskLevel: string;
    riskPercent: number;
  } | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Refs for speech recognition and audio processing
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const renderSimpleMarkdown = (md: string) => {
    const lines = (md || '').split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    const pushList = () => {
      if (listItems.length) {
        elements.push(
          <ul className="list-disc pl-5 my-2" key={`ul-${elements.length}`}>
            {listItems.map((li, i) => (
              <li key={i}>{li}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };
    lines.forEach((line, idx) => {
      const trimmed = (line || '').trim();
      if (!trimmed) {
        pushList();
        return;
      }
      if (trimmed.startsWith('### ')) {
        pushList();
        elements.push(<h3 key={`h3-${idx}`} className="text-lg font-medium mt-4 mb-2">{trimmed.slice(4)}</h3>);
        return;
      }
      if (trimmed.startsWith('## ')) {
        pushList();
        elements.push(<h2 key={`h2-${idx}`} className="text-xl font-semibold mt-4 mb-2">{trimmed.slice(3)}</h2>);
        return;
      }
      if (trimmed.startsWith('- ')) {
        listItems.push(trimmed.slice(2));
        return;
      }
      elements.push(<p key={`p-${idx}`} className="my-2">{trimmed}</p>);
    });
    pushList();
    return <div>{elements}</div>;
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const sampleText = "The red cat ran fast to catch the small rat. Sam and Lily went to the park to play with the dog. A dog sat under the big tree in the sun.";

  // Check if browser supports Web Speech API
  const isSpeechRecognitionSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  };

  // Initialize Speech Recognition
  const initializeSpeechRecognition = () => {
    if (!isSpeechRecognitionSupported()) {
      return null;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscribedText(prev => {
        const newText = prev + finalTranscript;
        return newText;
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // This is normal, just continue
        return;
      }
      toast({
        title: "Speech Recognition Error",
        description: `Error: ${event.error}. Please try again.`,
        variant: "destructive",
      });
    };

    recognition.onend = () => {
      if (isRecording) {
        // Restart recognition if still recording
        try {
          recognition.start();
        } catch (e) {
          console.error('Error restarting recognition:', e);
        }
      }
    };

    return recognition;
  };

  // Process audio for noise reduction
  const processAudioForNoiseReduction = async (stream: MediaStream): Promise<MediaStream> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();

      // Create a gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;

      // Create a biquad filter for noise reduction (high-pass filter)
      const filter = audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 80; // Filter out low-frequency noise
      filter.Q.value = 1;

      // Connect: source -> filter -> gain -> destination
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(destination);

      return destination.stream;
    } catch (error) {
      console.error('Error processing audio:', error);
      return stream; // Return original stream if processing fails
    }
  };

  const startRecording = async () => {
    try {
      // Reset transcribed text
      setTranscribedText('');

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support microphone access');
      }

      // Request microphone permission with better error handling
      const originalStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      mediaStreamRef.current = originalStream;

      // Process audio for noise reduction
      const processedStream = await processAudioForNoiseReduction(originalStream);

      // Use processed stream for recording
      const mediaRecorder = new MediaRecorder(processedStream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);

        // Stop all tracks on the stream to release the microphone
        if (originalStream) {
          originalStream.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(console.error);
        }
      };

      // Initialize and start speech recognition
      if (isSpeechRecognitionSupported()) {
        const recognition = initializeSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          try {
            recognition.start();
            setIsTranscribing(true);
          } catch (e) {
            console.error('Error starting speech recognition:', e);
          }
        }
      } else {
        toast({
          title: "Speech Recognition Not Available",
          description: "Your browser doesn't support real-time speech-to-text. Audio will still be recorded.",
          variant: "default",
        });
      }

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: "Recording Started",
        description: "Speak clearly into your microphone. Real-time transcription is active.",
      });
    } catch (error: any) {
      console.error('Error accessing microphone:', error);

      let errorMessage = "Unable to access your microphone.";

      if (error.name === 'NotAllowedError') {
        errorMessage = "Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Your browser doesn't support microphone recording. Please use a modern browser like Chrome, Firefox, or Safari.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Microphone is being used by another application. Please close other apps and try again.";
      }

      toast({
        title: "Microphone Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(false);

      // Stop speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
        recognitionRef.current = null;
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      toast({
        title: "Recording Stopped",
        description: `Speech sample recorded (${recordingTime}s). Transcribed text captured.`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if the file is an audio file
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (WAV, MP3, etc.).",
        variant: "destructive",
      });
      return;
    }

    const audioUrl = URL.createObjectURL(file);
    setAudioURL(audioUrl);

    toast({
      title: "Audio Uploaded",
      description: "Your audio file has been successfully uploaded.",
    });
  };

  const analyzeSpeech = async () => {
    if (!audioURL && !transcribedText) {
      toast({
        title: "No Audio Sample",
        description: "Please record or upload an audio sample first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get the transcribed text (use recorded transcription or process audio)
      let finalTranscribedText = transcribedText.trim();

      // If no transcription available, we'll need to process the audio
      // For now, we'll use the transcribed text we have
      if (!finalTranscribedText && audioURL) {
        toast({
          title: "Processing Audio",
          description: "Transcribing audio... This may take a moment.",
        });
        // In a real implementation, you would send audio to backend for transcription
        // For now, we'll use the sample text comparison
        finalTranscribedText = '';
      }

      // Send to backend for analysis
      const FLASK_API_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5000';

      const response = await fetch(`${FLASK_API_URL}/analyze_speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcribed_text: finalTranscribedText,
          actual_text: sampleText.trim(),
          recording_time: recordingTime
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Format the analysis result with mistake focus
      // Format the analysis result to be simple and concise like other assessments
      const fluencyScore100 = (data.fluency_score || 0) * 10;
      const riskLevel = data.dyslexia_probability >= 0.65 ? 'High' : data.dyslexia_probability >= 0.35 ? 'Moderate' : 'Low';
      const riskPercent = Math.round(data.dyslexia_probability * 100);

      const analysis = `
### Speech Assessment Result
- **Fluency Score:** ${fluencyScore100.toFixed(1)}/100
- **Accuracy:** ${data.accuracy_score?.toFixed(1) || '0.0'}%
- **Dyslexia Risk:** ${riskLevel} (${riskPercent}%)
      `;

      setAnalysisResult(analysis);

      setAssessmentMetrics({
        fluency: fluencyScore100,
        accuracy: data.accuracy_score || 0,
        riskLevel: riskLevel,
        riskPercent: riskPercent
      });


      // Calculate risk based on scores (matching Dashboard logic)
      // Average of fluency and accuracy, then invert to get risk
      const averageScore = (fluencyScore100 + (data.accuracy_score || 0)) / 2;
      const calculatedRisk = 100 - averageScore;
      const percent = Math.round(calculatedRisk);
      const detected = percent >= 50;
      const indicators = data.indicators || [];

      setDyslexiaResult({ detected, percent, indicators });

      // Save to localStorage
      try {
        localStorage.setItem('speech_result', JSON.stringify({
          fluencyScore: data.fluency_score,
          accuracyScore: data.accuracy_score,
          dyslexiaProbability: data.dyslexia_probability,
          notes: data.recommendations || [],
          timestamp: Date.now()
        }));
      } catch { }

      setIsLoading(false);

      toast({
        title: "Analysis Complete",
        description: "Speech sample has been successfully analyzed.",
      });
    } catch (error: any) {
      console.error('Error analyzing speech:', error);
      setIsLoading(false);

      toast({
        title: "Analysis Error",
        description: error.message || "Failed to analyze speech. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetAssessment = () => {
    setAudioURL(null);
    setAnalysisResult(null);
    setRecordingTime(0);
    setDyslexiaResult(null);
    setTranscribedText('');
    setIsTranscribing(false);

    // Stop any ongoing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      recognitionRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition on unmount:', e);
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Layout>
      <div className="assessment-container animate-fade-in">
        <h1 className="page-title">Speech & Reading Assessment</h1>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Record or upload speech samples to evaluate pronunciation, fluency, and reading
            comprehension. The system will analyze speech patterns for potential indicators
            related to dyslexia and other learning differences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardContent className="p-6">
                {showInstructions ? (
                  <AssessmentInstructions
                    title="Speech Assessment"
                    description="Evaluate pronunciation, fluency, and reading accuracy. This helps detect phonological processing issues."
                    steps={[
                      "Allow microphone access when prompted",
                      "Read the text displayed on the screen clearly and at a natural pace",
                      "Try to minimize background noise",
                      "Click 'Analyze Speech' when you are finished recording"
                    ]}
                    onStart={() => setShowInstructions(false)}
                    icon={<Mic size={24} />}
                  />
                ) : (
                  <Tabs defaultValue="record">
                    <TabsList className="mb-6 w-full">
                      <TabsTrigger value="record" className="flex-1">Record Speech</TabsTrigger>
                      <TabsTrigger value="upload" className="flex-1">Upload Audio</TabsTrigger>
                    </TabsList>

                    <TabsContent value="record" className="mt-0">
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-4">Speech Sample Recording</h3>

                        <div className="p-4 bg-gray-50 border rounded-md mb-6">
                          <h4 className="text-sm font-medium mb-2">Please read the following text aloud:</h4>
                          <p className="text-base italic bg-white p-4 rounded border">{sampleText}</p>
                        </div>

                        {isTranscribing && (
                          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-sm font-medium text-blue-800 mb-1">Real-time Transcription:</p>
                            <p className="text-sm text-blue-700">{transcribedText || 'Listening...'}</p>
                          </div>
                        )}

                        {transcribedText && !isRecording && (
                          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm font-medium text-green-800 mb-1">Final Transcription:</p>
                            <p className="text-sm text-green-700">{transcribedText}</p>
                          </div>
                        )}

                        <div className="flex justify-center mb-6">
                          {isRecording ? (
                            <div className="flex flex-col items-center">
                              <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Mic className="h-12 w-12 text-red-500 animate-pulse" />
                              </div>
                              <div className="text-lg font-medium">{formatTime(recordingTime)}</div>
                              <Button
                                onClick={stopRecording}
                                variant="destructive"
                                className="mt-4 flex items-center gap-2"
                              >
                                <Square className="h-4 w-4" />
                                Stop Recording
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <button
                                onClick={startRecording}
                                className="w-24 h-24 rounded-full bg-app-blue bg-opacity-10 hover:bg-opacity-20 flex items-center justify-center mb-4 transition-all"
                                aria-label="Start recording"
                                title="Start recording"
                              >
                                <Mic className="h-12 w-12 text-app-blue" />
                              </button>
                              <p className="text-gray-500">Click to start recording</p>
                            </div>
                          )}
                        </div>

                        {audioURL && (
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">Review your recording:</p>
                            <audio src={audioURL} controls className="w-full"></audio>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="mt-0">
                      <div className="mb-6">
                        <h3 className="text-lg font-medium mb-4">Upload Audio Sample</h3>

                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 mb-6">
                          <Upload className="text-gray-400 mb-2" size={32} />
                          <p className="text-gray-500 mb-4 text-center">
                            Drag and drop your audio file here, or click to select a file
                          </p>
                          <input
                            type="file"
                            id="audio-file"
                            accept="audio/*"
                            onChange={handleFileUpload}
                            aria-label="Upload audio file"
                            title="Upload audio file"
                            className="w-full max-w-xs"
                          />
                        </div>

                        {audioURL && (
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">Uploaded audio:</p>
                            <audio src={audioURL} controls className="w-full"></audio>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}

                <div className="mt-6 flex flex-col gap-4">
                  <Button
                    className="w-full bg-app-blue hover:bg-app-blue-dark"
                    onClick={analyzeSpeech}
                    disabled={isLoading || !audioURL}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Headphones className="mr-2 h-4 w-4" />
                        Analyze Speech
                      </>
                    )}
                  </Button>

                  {(audioURL || analysisResult) && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={resetAssessment}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset Assessment
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center mb-4">
                  <FileText className="text-app-blue mr-2" size={20} />
                  <h2 className="card-title">Analysis Results</h2>
                </div>

                {assessmentMetrics && dyslexiaResult ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Dyslexia Risk Banner */}
                    <div className={`p-4 rounded-xl border ${dyslexiaResult.detected ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${dyslexiaResult.detected ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {dyslexiaResult.detected ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-lg font-semibold ${dyslexiaResult.detected ? 'text-red-900' : 'text-green-900'}`}>
                            {dyslexiaResult.detected ? 'Possible Indicators Detected' : 'No Significant Indicators'}
                          </h3>
                          <div className="mt-2 flex items-center gap-3">
                            <Progress
                              value={dyslexiaResult.percent}
                              className={`h-2.5 flex-1 bg-white ${dyslexiaResult.detected ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
                            />
                            <span className="font-bold text-lg">{dyslexiaResult.percent}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
                        <div className="text-sm text-gray-500 mb-1">Fluency Score</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {assessmentMetrics.fluency.toFixed(1)}
                          <span className="text-sm font-normal text-gray-400 ml-1">/100</span>
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 text-center">
                        <div className="text-sm text-gray-500 mb-1">Accuracy</div>
                        <div className="text-2xl font-bold text-purple-700">
                          {assessmentMetrics.accuracy.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Indicators List */}
                    {dyslexiaResult.indicators.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Activity size={16} /> Key Observations
                        </h4>
                        <ul className="space-y-2">
                          {dyslexiaResult.indicators.map((indicator, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                              {indicator}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-center p-8">
                    <div>
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="text-gray-300" size={32} />
                      </div>
                      <p className="mb-2 font-medium">No results yet</p>
                      <p className="text-sm max-w-xs mx-auto">Record or upload a speech sample and click "Analyze Speech" to begin.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SpeechAssessment;
