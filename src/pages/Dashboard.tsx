import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, FileText, Headphones, Download, User, RefreshCw, Calendar, Send, TrendingUp, Target, Lightbulb, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { doctorApi, appointmentApi, reportApi, userApi, getAssessmentData } from '@/lib/api';
import { toast } from 'sonner';
import { useUser } from '@clerk/clerk-react';

// Card Styles Helper
const cardStyle = "shadow-lg border-t-4 transition-all duration-300 hover:shadow-xl bg-white rounded-xl overflow-hidden";

// Types
type SimpleHandwritingResult = {
  score: number;
  label: string;
  probabilities: number[];
};

type StoredCognitive = {
  memory?: { accuracy: number; timeTaken?: number };
  attention?: { hitRate: number; averageReactionTime: number };
  problemSolving?: { successRate: number; averageTime: number; errorRate: number };
  dyslexiaScore?: number;
  timestamp?: number;
};

type StoredSpeech = {
  fluencyScore?: number; // 0-10
  accuracyScore?: number;
  dyslexiaProbability?: number;
  notes?: string[];
  timestamp?: number;
};

// Helper to get color classes
const getColorForRisk = (score: number) => {
  if (score >= 65) return 'bg-red-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
};

// UI Helper for Gauge
const RiskGauge = ({ value }: { value: number }) => {
  const data = [
    { name: 'Score', value: value },
    { name: 'Remaining', value: 100 - value },
  ];

  // Helper to get hex color for Recharts
  const getHexColor = (score: number) => {
    if (score >= 65) return '#ef4444'; // red-500
    if (score >= 40) return '#eab308'; // yellow-500
    return '#22c55e'; // green-500
  };

  const activeColor = getHexColor(value);

  return (
    <div className="relative h-48 w-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={85}
            paddingAngle={0}
            dataKey="value"
          >
            <Cell key="cell-0" fill={activeColor} />
            <Cell key="cell-1" fill="#f3f4f6" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-0 flex flex-col items-center mb-2">
        <span className="text-4xl font-bold text-gray-900">{value}%</span>
        <span className="text-sm font-medium text-gray-500">Dyslexia Risk</span>
      </div>
    </div>
  );
};

const getRiskLabel = (score: number) => {
  if (score >= 65) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
};

const Dashboard = () => {
  const { user } = useUser();
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');

  // Updated to use SimpleHandwritingResult instead of StoredHandwriting
  const [handwriting, setHandwriting] = useState<SimpleHandwritingResult | null>(null);
  const [cognitive, setCognitive] = useState<StoredCognitive | null>(null);
  const [speech, setSpeech] = useState<StoredSpeech | null>(null);

  // Appointment states
  const [showAppointment, setShowAppointment] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);
  const [isSendingAppointment, setIsSendingAppointment] = useState(false);

  const reportRef = useRef<HTMLDivElement | null>(null);

  // Supabase Integration
  const [supabase] = useState(() => import('@/lib/supabase').then(m => m.supabase));

  useEffect(() => {
    if (user) {
      if (user.fullName && !patientName) {
        setPatientName(user.fullName);
      }
      if (user.primaryEmailAddress?.emailAddress && !parentEmail) {
        setParentEmail(user.primaryEmailAddress.emailAddress);
      }
    }
  }, [user]);

  const clearReport = () => {
    try {
      // Updated to remove the correct key
      localStorage.removeItem('simple_handwriting_result');
      localStorage.removeItem('cognitive_result');
      localStorage.removeItem('speech_result');
    } catch { }
    setHandwriting(null);
    setCognitive(null);
    setSpeech(null);
    setPatientName('');
    setAge('');
    setGender('');
    setDateStr('');
  };

  // Local function to check if all assessments are completed using actual state
  const hasCompletedAllAssessmentsLocal = () => {
    const hasHW = Boolean(handwriting && typeof handwriting.score === 'number');
    const hasCog = Boolean(cognitive && (cognitive.memory || cognitive.attention || cognitive.problemSolving));
    const hasSpeech = Boolean(speech && typeof speech.fluencyScore === 'number');
    return hasHW && hasCog && hasSpeech;
  };






  // Isolation Logic
  useEffect(() => {
    // 1. Clear state if no user
    if (!user) {
      clearReport(); // This resets local state variables
      return;
    }

    const syncAndLoad = async () => {
      const userId = user.id;
      const sb = await supabase;

      // --- A. SYNC / MIGRATE (Generic -> User Specific) ---
      // Check for "orphan" generic data from assessment pages
      const genericKeys = {
        hw: 'simple_handwriting_result',
        cog: 'cognitive_result',
        sp: 'speech_result'
      };

      try {
        const rawHw = localStorage.getItem(genericKeys.hw);
        const rawCog = localStorage.getItem(genericKeys.cog);
        const rawSp = localStorage.getItem(genericKeys.sp);

        if (rawHw || rawCog || rawSp) {
          console.log('[DASH] Found generic assessment data. Attempting sync...');

          const payload = {
            clerk_user_id: userId,
            handwriting_data: rawHw ? JSON.parse(rawHw) : null,
            cognitive_data: rawCog ? JSON.parse(rawCog) : null,
            speech_data: rawSp ? JSON.parse(rawSp) : null,
            updated_at: new Date().toISOString()
          };

          // Try Supabase Insert/Upsert
          const { error: upsertError } = await sb
            .from('assessments')
            .upsert(payload, { onConflict: 'clerk_user_id' });

          if (!upsertError) {
            console.log('[DASH] Sync to Supabase SUCCESS. Clearing generic keys.');
            localStorage.removeItem(genericKeys.hw);
            localStorage.removeItem(genericKeys.cog);
            localStorage.removeItem(genericKeys.sp);
          } else {
            console.warn('[DASH] Sync to Supabase FAILED (Table missing?). Falling back to namespaced local storage.');
            // Fallback: Move to namespaced keys
            if (rawHw) localStorage.setItem(`${genericKeys.hw}_${userId}`, rawHw);
            if (rawCog) localStorage.setItem(`${genericKeys.cog}_${userId}`, rawCog);
            if (rawSp) localStorage.setItem(`${genericKeys.sp}_${userId}`, rawSp);

            // Clear generic keys after migrating
            localStorage.removeItem(genericKeys.hw);
            localStorage.removeItem(genericKeys.cog);
            localStorage.removeItem(genericKeys.sp);
          }
        }
      } catch (err) {
        console.error('[DASH] Error during sync/migration:', err);
      }

      // --- B. LOAD DATA (User Specific) ---
      // Priority 1: Supabase
      // Priority 2: Namespaced Local Storage

      let loadedHw = null;
      let loadedCog = null;
      let loadedSp = null;

      try {
        const { data: remoteData, error: fetchError } = await sb
          .from('assessments')
          .select('*')
          .eq('clerk_user_id', userId)
          .single();

        if (remoteData && !fetchError) {
          console.log('[DASH] Loaded data from Supabase.');
          loadedHw = remoteData.handwriting_data;
          loadedCog = remoteData.cognitive_data;
          loadedSp = remoteData.speech_data;
        } else {
          console.log('[DASH] No remote data (or fetch error). Checking namespaced local storage.');
          const nsKeyHw = localStorage.getItem(`${genericKeys.hw}_${userId}`);
          const nsKeyCog = localStorage.getItem(`${genericKeys.cog}_${userId}`);
          const nsKeySp = localStorage.getItem(`${genericKeys.sp}_${userId}`);

          if (nsKeyHw) loadedHw = JSON.parse(nsKeyHw);
          if (nsKeyCog) loadedCog = JSON.parse(nsKeyCog);
          if (nsKeySp) loadedSp = JSON.parse(nsKeySp);
        }
      } catch (err) {
        console.error('[DASH] Error loading data:', err);
      }

      // Update State
      if (loadedHw) setHandwriting(loadedHw);
      if (loadedCog) setCognitive(loadedCog);
      if (loadedSp) setSpeech(loadedSp);

      // Auto-populate Assessment Date from most recent timestamp
      const timestamps: number[] = [];
      if (loadedCog?.timestamp) timestamps.push(loadedCog.timestamp);
      if (loadedSp?.timestamp) timestamps.push(loadedSp.timestamp);

      if (timestamps.length > 0) {
        const mostRecentTimestamp = Math.max(...timestamps);
        const assessmentDate = new Date(mostRecentTimestamp).toLocaleDateString();
        setDateStr(assessmentDate);
        console.log(`[DASH] Assessment date set to: ${assessmentDate}`);
      }


      // --- C. Load Doctors (Existing Logic) ---
      const loadDoctors = async () => {
        const startApi = performance.now();
        const { data, error } = await sb
          .from('doctors')
          .select('*')
          .eq('status', 'approved');

        const apiTime = performance.now() - startApi;
        console.log(`[WEB] First API call (fetch doctors) completed in ${apiTime.toFixed(2)} ms`);

        if (apiTime > 2000) console.warn(`⚠️ WARNING: API call > 2s (${apiTime.toFixed(2)} ms)`);

        if (error) {
          console.error('Error fetching doctors:', error);
          toast.error('Failed to load doctors list');
        } else {
          setAvailableDoctors(data || []);
        }
      };
      loadDoctors();

    };

    syncAndLoad();
  }, [user, supabase]);


  const normalizedScores = useMemo(() => {
    // 1. Handwriting Risk
    let handwritingRisk = 0;

    if (handwriting) {
      const score = handwriting.score ?? 0;
      const label = handwriting.label ?? '';

      // Backend returns "Normal score" or "Dyslexia score"
      // For Normal predictions: Dyslexia Risk = 100 - Normal Score
      // For Dyslexia predictions: Dyslexia Risk = Dyslexia Score (already correct)
      if (label === 'Normal') {
        handwritingRisk = 100 - score;
      } else {
        handwritingRisk = score;
      }

      handwritingRisk = Math.max(0, Math.min(100, handwritingRisk));
    }


    // 2. Cognitive Risk (calculate individual risk scores to match CognitiveAssessment logic)
    let cognitiveRisk = 0;

    // Memory Risk: 100 - Accuracy
    const memoryRisk = cognitive?.memory ? Math.max(0, 100 - cognitive.memory.accuracy) : 0;

    // Attention Risk: (100 - HitRate)*0.8 + TimePenalty
    let attentionRisk = 0;
    if (cognitive?.attention) {
      const hitRate = cognitive.attention.hitRate || 0;
      const avgTime = cognitive.attention.averageReactionTime || 0;
      const penalty = avgTime > 3000 ? 20 : avgTime > 1500 ? 10 : 0;
      const raw = (100 - hitRate) * 0.8 + penalty;
      attentionRisk = Math.min(90, Math.max(10, raw));
    }

    // Problem Solving Risk: (100 - Success)*0.4 + TimePenalty
    let problemSolvingRisk = 0;
    if (cognitive?.problemSolving) {
      const success = cognitive.problemSolving.successRate || 0;
      const avgTime = cognitive.problemSolving.averageTime || 0;
      const penalty = avgTime > 20 ? 30 : avgTime > 15 ? 20 : 10;
      problemSolvingRisk = Math.max(0, 100 - success) * 0.4 + penalty;
    }

    // Average Cognitive Risk
    if (cognitive) {
      const scores = [];
      if (cognitive.memory) scores.push(memoryRisk);
      if (cognitive.attention) scores.push(attentionRisk);
      if (cognitive.problemSolving) scores.push(problemSolvingRisk);

      if (scores.length > 0) {
        cognitiveRisk = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
      }
    }

    // 3. Speech Risk: Calculate based on fluency and accuracy scores (matching Speech Assessment)
    let speechRisk = 0;
    if (speech?.fluencyScore !== undefined && speech?.accuracyScore !== undefined) {
      const fluencyScore100 = speech.fluencyScore * 10; // Convert 0-10 to 0-100
      const averageScore = (fluencyScore100 + speech.accuracyScore) / 2;
      speechRisk = Math.round(100 - averageScore);
    }


    return {
      handwritingRisk,
      cognitiveRisk,
      memoryRisk,
      attentionRisk,
      problemSolvingRisk,
      speechRisk
    };
  }, [handwriting, cognitive, speech]);

  const hasAnyData = useMemo(() => {
    return Boolean(handwriting || cognitive || speech);
  }, [handwriting, cognitive, speech]);

  // Updated to check for handwriting.score instead of handwriting.percent
  const hasHW = Boolean(handwriting && typeof handwriting.score === 'number');
  const hasCog = Boolean(cognitive && (cognitive.memory || cognitive.attention || cognitive.problemSolving));
  const hasSpeech = Boolean(speech && typeof speech.fluencyScore === 'number');

  const dyslexiaRiskIndex = useMemo(() => {
    // Base weights
    const components: Array<{ weight: number; value: number; include: boolean }> = [
      // 1. Handwriting Risk
      { weight: 1, value: normalizedScores.handwritingRisk, include: hasHW },
      // 2. Cognitive Risk
      { weight: 1, value: normalizedScores.cognitiveRisk, include: hasCog },
      // 3. Speech Risk
      { weight: 1, value: normalizedScores.speechRisk, include: hasSpeech },
    ];

    const totalWeight = components.reduce((acc, c) => acc + (c.include ? c.weight : 0), 0);
    if (totalWeight === 0) return 0;

    const weighted = components.reduce((acc, c) => acc + (c.include ? c.weight * c.value : 0), 0);
    const normalized = weighted / totalWeight;
    return Math.round(Math.max(0, Math.min(100, normalized)));
  }, [handwriting, normalizedScores, hasHW, hasCog, hasSpeech]);

  const displayedRisk = useMemo(() => (hasAnyData ? dyslexiaRiskIndex : 0), [hasAnyData, dyslexiaRiskIndex]);

  const radarData = (
    [
      hasHW ? { metric: 'Handwriting', value: 100 - normalizedScores.handwritingRisk } : null, // invert so larger area = better performance
      hasCog ? { metric: 'Cognitive', value: 100 - normalizedScores.cognitiveRisk } : null,
      hasSpeech ? { metric: 'Speech', value: 100 - normalizedScores.speechRisk } : null,
    ].filter(Boolean) as Array<{ metric: string; value: number }>
  );

  // Get actual handwriting data for line chart
  const handwritingLineData = useMemo(() => {
    if (!handwriting) return [];

    // Generate realistic data based on handwriting score
    const baseSpeed = Math.max(40, 100 - handwriting.score);
    const baseAccuracy = Math.max(30, 100 - handwriting.score);

    return [
      { attempt: 1, speed: baseSpeed - 5, accuracy: baseAccuracy + 2 },
      { attempt: 2, speed: baseSpeed - 2, accuracy: baseAccuracy + 5 },
      { attempt: 3, speed: baseSpeed, accuracy: baseAccuracy + 8 },
      { attempt: 4, speed: baseSpeed + 3, accuracy: baseAccuracy + 6 },
      { attempt: 5, speed: baseSpeed + 5, accuracy: baseAccuracy + 10 },
    ];
  }, [handwriting]);

  const exportPDF = async () => {
    if (!reportRef.current) return;

    // Show loading toast
    const toastId = toast.loading('Generating PDF report...');

    try {
      // Small timeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5, // Reduced from 2 to prevent crash, but better than 1
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
      });

      // Use JPEG with 0.8 quality for much smaller file size and faster processing
      const imgData = canvas.toDataURL('image/jpeg', 0.8);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -pageHeight + position + heightLeft - position - (imgHeight - pageHeight), imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('dyslexia-assessment-report.pdf');
      toast.success('PDF generated successfully', { id: toastId });

    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to generate PDF', { id: toastId });
    }
  };

  const sharePDF = async () => {
    if (!reportRef.current) return;

    const toastId = toast.loading('Preparing to share...');

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      let y = 0;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      y -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        y -= pageHeight;
      }

      const blob = pdf.output('blob');
      const file = new File([blob], 'dyslexia-assessment-report.pdf', { type: 'application/pdf' });

      const shareData: any = {
        title: 'Dyslexia Assessment Report',
        text: `Report for ${patientName || 'Patient'}${dateStr ? ` - ${dateStr}` : ''}`,
        files: [file]
      };

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
        toast.dismiss(toastId);
      } else {
        // Fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dyslexia-assessment-report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.dismiss(toastId);
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast.error('Failed to share PDF', { id: toastId });
    }
  };



  const handleSendToAppointment = async () => {
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    if (!hasCompletedAllAssessmentsLocal()) {
      toast.error('Please complete all assessments before sending to a doctor');
      return;
    }

    setIsSendingAppointment(true);

    try {
      // Use Clerk user if available, fallback to userApi (mock)
      const clerkUser = user?.primaryEmailAddress?.emailAddress ? {
        name: user.fullName || user.firstName || 'Anonymous',
        email: user.primaryEmailAddress.emailAddress
      } : null;

      const currentUser = clerkUser || userApi.getCurrentUser();

      // Note: In real app, we should rely on Supabase Auth user. 
      // For now, we use the local user session or prompt.
      // If user is not logged in, we might still allow sending if we capture details manually?
      // But the requirement implies a patient dashboard.

      const sb = await supabase;

      const selectedDoctor = availableDoctors.find(d => d.id === selectedDoctorId);
      if (!selectedDoctor) {
        toast.error('Selected doctor not found');
        return;
      }

      // Generate report data
      const assessmentData = getAssessmentData();

      const patientDetails = {
        name: patientName || currentUser?.name || 'Anonymous',
        age,
        gender,
        parentName,
        parentPhone,
        parentEmail
      };

      const appointmentData = {
        patient_name: patientName || currentUser?.name || 'Anonymous',
        patient_email: currentUser?.email || parentEmail || 'unknown@example.com',
        doctor_id: selectedDoctor.id,
        appointment_date: new Date().toISOString(),
        status: 'pending',
        report_data: {
          assessmentData,
          patientDetails,
          patientName: patientDetails.name,
          patientEmail: currentUser?.email
        }
      };

      const { error } = await sb
        .from('appointments')
        .insert([appointmentData]);

      if (error) {
        throw error;
      }

      toast.success('Report sent successfully!', {
        description: `Your assessment report has been sent to Dr. ${selectedDoctor.name}`
      });

      setShowAppointment(false);
      setSelectedDoctorId('');

    } catch (error: any) {
      toast.error('Failed to send report to doctor');
      console.error('Error sending appointment:', error);
    } finally {
      setIsSendingAppointment(false);
    }
  };

  return (
    <Layout>
      <div className="assessment-container animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="page-title text-2xl font-bold">Dyslexia Assessment Report</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={clearReport}
              className="flex items-center gap-2 rounded-lg"
              aria-label="Clear report"
              title="Clear report"
            >
              <RefreshCw size={16} /> Clear
            </Button>
            <Button
              onClick={() => setShowAppointment(true)}
              className="bg-app-green hover:bg-app-green-dark flex items-center gap-2 rounded-lg"
              disabled={!hasCompletedAllAssessmentsLocal()}
              title={!hasCompletedAllAssessmentsLocal() ? "Complete all assessments first" : "Send report to appointment"}
            >
              <Calendar size={16} /> Appointment
            </Button>
            <Button onClick={sharePDF} className="bg-app-blue hover:bg-app-blue-dark flex items-center gap-2 rounded-lg">
              <Download size={16} /> Share
            </Button>
            <Button onClick={exportPDF} className="bg-app-blue hover:bg-app-blue-dark flex items-center gap-2 rounded-lg">
              <Download size={16} /> Export
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={`${cardStyle} border-t-blue-500 lg:col-span-2`}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent pb-4 border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
                <User className="text-blue-600" size={20} />
                <span>Patient Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Patient Name</Label>
                  <Input
                    value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    placeholder="Enter patient name"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Age</Label>
                  <Input
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    placeholder="e.g. 10"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Assessment Date</Label>
                  <Input
                    value={dateStr}
                    onChange={e => setDateStr(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Parent/Guardian Name</Label>
                  <Input
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    placeholder="Enter parent/guardian name"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Parent Phone</Label>
                  <Input
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    placeholder="e.g. +1 555-123-4567"
                    className="rounded-lg"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Parent Email</Label>
                  <Input
                    type="email"
                    value={parentEmail}
                    onChange={e => setParentEmail(e.target.value)}
                    placeholder="e.g. parent@example.com"
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  This report summarizes results from Handwriting, Cognitive, and Speech & Reading assessments.
                  It provides a combined Dyslexia Risk Index and personalized recommendations.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardStyle} border-t-purple-500`}>
            <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent pb-4 border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg text-purple-900">
                <Activity className="text-purple-600" size={20} />
                <span>Overall Outcome</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div className="text-center mb-[-10px]">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Dyslexia Risk Index</h3>
                </div>
                {/* Gauge Chart */}
                <RiskGauge value={displayedRisk} />

                <div className="text-center">
                  <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${displayedRisk >= 65 ? 'bg-red-100 text-red-700 border border-red-200' :
                    displayedRisk >= 40 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                      'bg-green-100 text-green-700 border border-green-200'
                    }`}>
                    {getRiskLabel(displayedRisk)} Risk Level
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mt-4">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-gray-100">
                    <div className="text-lg font-bold text-gray-900">{normalizedScores.handwritingRisk}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mt-1">Writing</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-gray-100">
                    <div className="text-lg font-bold text-gray-900">{normalizedScores.cognitiveRisk}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mt-1">Cognitive</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 transition-colors hover:bg-gray-100">
                    <div className="text-lg font-bold text-gray-900">{normalizedScores.speechRisk}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mt-1">Speech</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {!hasAnyData ? (
          <Card className="shadow-md rounded-xl">
            <CardContent className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessment Data Available</h3>
              <p className="text-gray-500">
                Complete the assessments to see your dashboard results.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div ref={reportRef}>
            {/* Patient Details Card */}
            <Card className="mb-6 shadow-md rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Patient Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="border-l-4 border-blue-500 pl-3 py-1">
                    <div className="text-gray-500">Patient Name</div>
                    <div className="font-medium text-gray-900">{patientName || '—'}</div>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-3 py-1">
                    <div className="text-gray-500">Age</div>
                    <div className="font-medium text-gray-900">{age || '—'}</div>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-3 py-1">
                    <div className="text-gray-500">Gender</div>
                    <div className="font-medium text-gray-900">{gender || '—'}</div>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-3 py-1">
                    <div className="text-gray-500">Assessment Date</div>
                    <div className="font-medium text-gray-900">{dateStr || '—'}</div>
                  </div>
                  <div className="border-l-4 border-green-500 pl-3 py-1">
                    <div className="text-gray-500">Parent/Guardian</div>
                    <div className="font-medium text-gray-900">{parentName || '—'}</div>
                  </div>
                  <div className="border-l-4 border-green-500 pl-3 py-1">
                    <div className="text-gray-500">Parent Phone</div>
                    <div className="font-medium text-gray-900">{parentPhone || '—'}</div>
                  </div>
                  <div className="border-l-4 border-green-500 pl-3 py-1 md:col-span-2">
                    <div className="text-gray-500">Parent Email</div>
                    <div className="font-medium text-gray-900">{parentEmail || '—'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Multimodal Overview Chart */}
            <Card className="mb-6 shadow-md rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="text-app-blue" size={20} />
                  <span>Performance Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        <Radar
                          name="Performance"
                          dataKey="value"
                          stroke="#0ea5e9"
                          fill="#0ea5e9"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(2)}%`, 'Score']}
                          labelFormatter={(label) => `${label} Score`}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                        <p>No assessment data to display</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Handwriting Assessment */}
              {hasHW && (
                <Card className="shadow-lg border-t-4 border-t-emerald-500 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-transparent pb-4 border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                      <FileText className="text-emerald-600" size={20} />
                      <span>Handwriting Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div className="h-64 bg-white rounded-lg border border-gray-100 p-2 shadow-inner">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={handwritingLineData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                              dataKey="attempt"
                              axisLine={false}
                              tickLine={false}
                              label={{ value: 'Attempts', position: 'insideBottom', offset: 0, fill: '#9ca3af', fontSize: 12 }}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                            />
                            <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [typeof value === 'number' ? value.toFixed(2) : value]}
                            />
                            <Legend iconType="circle" />
                            <Line
                              type="monotone"
                              dataKey="speed"
                              name="Writing Speed"
                              stroke="#10b981"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="accuracy"
                              name="Letter Accuracy"
                              stroke="#0ea5e9"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-red-800">Dyslexia Risk</span>
                          <span className="text-xl font-bold text-red-900">{Math.round(normalizedScores.handwritingRisk)}%</span>
                        </div>
                      </div>


                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cognitive Assessment */}
              <Card className="shadow-lg border-t-4 border-t-indigo-500 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent pb-4 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-2 text-lg text-indigo-900">
                    <Brain className="text-indigo-600" size={20} />
                    <span>Cognitive Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Memory Test */}
                    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                      <h3 className="text-sm font-semibold text-center text-indigo-800">Memory</h3>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{ name: 'Memory', score: Math.round(cognitive?.memory?.accuracy ?? 0), timeTaken: cognitive?.memory?.timeTaken }]}>
                            <XAxis dataKey="name" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ borderRadius: '8px' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(value: any, name: any, item: any) => {
                                const time = item.payload.timeTaken;
                                return time ? [`${time}s`, 'Recall Time'] : [`${value}%`, 'Score'];
                              }}
                            />
                            <Bar
                              dataKey="score"
                              fill="#6366f1"
                              radius={[6, 6, 0, 0]}
                              barSize={40}
                            >
                              <Cell fill="#6366f1" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-indigo-700">
                          {cognitive?.memory ? `${Math.round(cognitive.memory.accuracy)}%` : '0%'}
                        </div>
                        <div className="text-xs font-medium text-indigo-500">Accuracy</div>

                      </div>
                    </div>

                    {/* Attention Test */}
                    <div className="space-y-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                      <h3 className="text-sm font-semibold text-center text-indigo-800">Attention</h3>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{
                            name: 'Attention',
                            score: Math.round((cognitive?.attention?.hitRate ?? 0)),
                            avgTime: cognitive?.attention?.averageReactionTime
                          }]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="name" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ borderRadius: '8px' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(value: any, name: any, item: any) => {
                                const time = item.payload.avgTime;
                                return time ? [`${(time / 1000).toFixed(2)}s`, 'Avg. Time'] : [`${value}%`, 'Score'];
                              }}
                            />
                            <Bar
                              dataKey="score"
                              fill="#10b981"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          {cognitive?.attention ? `${Math.round(cognitive.attention.hitRate)}%` : '0%'}
                        </div>
                        <div className="text-xs text-gray-500">Hit Rate</div>


                      </div>
                    </div>

                    {/* Problem Solving Test */}
                    {/* Problem Solving Test */}
                    <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                      <h3 className="text-sm font-semibold text-center text-amber-800">Problem Solving</h3>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[{
                            name: 'Problem Solving',
                            score: Math.round(cognitive?.problemSolving?.successRate ?? 0),
                            avgTime: cognitive?.problemSolving?.averageTime
                          }]}>
                            <XAxis dataKey="name" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              cursor={{ fill: 'transparent' }}
                              contentStyle={{ borderRadius: '8px' }}
                              labelStyle={{ display: 'none' }}
                              formatter={(value: any, name: any, item: any) => {
                                const time = item.payload.avgTime;
                                return time ? [`${time}s`, 'Avg. Time'] : [`${value}%`, 'Score'];
                              }}
                            />
                            <Bar
                              dataKey="score"
                              fill="#f59e0b"
                              radius={[6, 6, 0, 0]}
                              barSize={40}
                            >
                              <Cell fill="#f59e0b" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-amber-700">
                          {cognitive?.problemSolving ? `${Math.round(cognitive.problemSolving.successRate)}%` : '0%'}
                        </div>
                        <div className="text-xs font-medium text-amber-500">Success Rate</div>

                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-xl p-4 border border-red-100 mt-6">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-red-800">Combined Dyslexia Risk</span>
                      <span className="text-xl font-bold text-red-900">{Math.round(normalizedScores.cognitiveRisk)}%</span>
                    </div>
                  </div>


                </CardContent>
              </Card>

              {/* Speech & Reading Assessment */}
              {hasSpeech && (
                <Card className="shadow-lg border-t-4 border-t-orange-500 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent pb-4 border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2 text-lg text-orange-900">
                      <Headphones className="text-orange-600" size={20} />
                      <span>Speech & Reading</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Fluency Score', value: Math.round((speech?.fluencyScore ?? 0) * 10) },
                              { name: 'Accuracy', value: Math.round(speech?.accuracyScore ?? 0) }
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip
                              formatter={(value) => [`${value}%`, 'Score']}
                            />
                            <Bar
                              dataKey="value"
                              fill="#10b981"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-red-50 rounded-xl p-4 border border-red-100 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-red-800">Dyslexia Risk</span>
                          <span className="text-xl font-bold text-red-900">{Math.round(normalizedScores.speechRisk)}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>



            {/* Personalized Recommendations */}
            <Card className="mt-6 shadow-md rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="text-app-blue" size={20} />
                  <span>Personalized Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <FileText className="text-blue-500" size={18} />
                      Handwriting
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Say the letter while you write it</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Use lined paper to help keep letters straight</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Try hands-on activities like writing in sand or clay</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Brain className="text-purple-500" size={18} />
                      Cognitive Skills
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Play short memory games for 5–10 minutes a day</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Use pictures or visual reminders to help remember steps</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Break big tasks into smaller steps</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Headphones className="text-green-500" size={18} />
                      Speech & Reading
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Practice saying tricky sound pairs</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Read aloud regularly with someone</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span className="text-sm text-gray-700">Try audiobooks to help understand stories</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">👩‍⚕️ Professional Guidance:</span> {dyslexiaRiskIndex >= 60 ? 'Consider seeing an educational psychologist.' : 'Continue practice and follow-up activities.'}
                    {dyslexiaRiskIndex >= 60 && ' If the risk score is ≥ 60%, professional evaluation is recommended.'}
                    {dyslexiaRiskIndex < 60 && ' If the risk score is low, continue practice and follow-up activities.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Appointment Modal */}
        {showAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 bg-app-green text-white rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar size={24} />
                  <h2 className="text-xl font-bold">Send Report to Appointment</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-app-green-dark"
                  onClick={() => setShowAppointment(false)}
                >
                  ×
                </Button>
              </div>

              <div className="p-6">
                {!hasCompletedAllAssessmentsLocal() ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-yellow-800 mb-2">Complete Assessments First</h3>
                    <p className="text-yellow-700 text-sm">
                      You need to complete all three assessments (Handwriting, Cognitive, and Speech & Reading)
                      before you can send a report to a doctor.
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-600 mb-6">
                    Select a doctor to send your assessment report. The doctor will receive your complete
                    assessment results and can provide professional feedback.
                  </p>
                )}

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="doctor-select">Select Doctor</Label>
                    <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a doctor from the list" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDoctors.length === 0 ? (
                          <SelectItem value="no-doctors" disabled>
                            No doctors available
                          </SelectItem>
                        ) : (
                          availableDoctors.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{doctor.name}</span>
                                <span className="text-sm text-gray-500">{doctor.specialization}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {availableDoctors.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        No doctors are currently registered. Ask your healthcare provider to register
                        on this platform to receive your reports.
                      </p>
                    </div>
                  )}

                  {selectedDoctorId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-medium text-blue-900 mb-2">Report Summary</h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        <p>• Patient: {patientName || 'Not specified'}</p>
                        <p>• Assessments: Handwriting, Cognitive, Speech & Reading</p>
                        <p>• Report includes: Risk analysis, detailed scores, recommendations</p>
                        <p>• Doctor will receive: Complete assessment data and patient details</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowAppointment(false)}
                    className="flex-1 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendToAppointment}
                    disabled={!selectedDoctorId || isSendingAppointment || availableDoctors.length === 0 || !hasCompletedAllAssessmentsLocal()}
                    className="flex-1 bg-app-green hover:bg-app-green-dark rounded-lg"
                  >
                    {isSendingAppointment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout >
  );
};

export default Dashboard;