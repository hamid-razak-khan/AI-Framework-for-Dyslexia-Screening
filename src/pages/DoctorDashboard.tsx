import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  FileText,
  Calendar,
  Clock,
  Mail,
  Phone,
  Download,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { appointmentApi, doctorApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDoctorData();
  }, []);

  const loadDoctorData = async () => {
    try {
      // 1. Check Local Session (Custom Auth)
      const sessionStr = localStorage.getItem('auth_session');
      if (!sessionStr) {
        toast.error('Session expired. Please log in again.');
        navigate('/doctor-login');
        return;
      }

      const session = JSON.parse(sessionStr);
      if (session.userType !== 'doctor' || !session.email) {
        toast.error('Invalid session.');
        localStorage.removeItem('auth_session');
        navigate('/doctor-login');
        return;
      }

      // 2. Fetch Doctor Profile & Service Check directly by Email (since ID might not match auth.uid anymore)
      // Note: We need to trust the session email + the fact the user logged in. 
      // Ideally we re-verify password or token, but for this scope we just fetch details.
      const { data: doctor, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', session.email)
        .single();

      if (error || !doctor) {
        console.error('Doctor profile error:', error);
        toast.error('Doctor profile not found.');
        localStorage.removeItem('auth_session'); // clear bad session
        navigate('/doctor-login');
        return;
      }

      // 3. Status Check (Security)
      if (doctor.status !== 'approved') {
        toast.error(`Access denied. Status: ${doctor.status}`);
        localStorage.removeItem('auth_session');
        navigate('/doctor-login');
        return;
      }

      setDoctorInfo(doctor);

      // 4. Load Appointments from Supabase
      const { data: appointmentData, error: aptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctor.id)
        .order('created_at', { ascending: false });

      if (aptError) {
        console.error('Error fetching appointments:', aptError);
        toast.error('Failed to load appointments.');
      } else {
        // Map Supabase data to expected format if necessary, 
        // or just use it directly if keys match. 
        // Our SQL schema uses snake_case keys (patient_name, etc), 
        // but the UI expects camelCase (patientName). We need to map it.
        const formattedAppointments = appointmentData?.map(apt => ({
          id: apt.id,
          patientName: apt.patient_name,
          patientEmail: apt.patient_email,
          doctorName: doctor.name, // Known
          appointmentDate: apt.appointment_date,
          status: apt.status,
          createdAt: apt.created_at,
          reportData: apt.report_data
        })) || [];

        setAppointments(formattedAppointments);
      }

    } catch (error) {
      toast.error('Failed to load doctor data');
      console.error('Error loading doctor data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: 'reviewed' | 'completed') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      loadDoctorData(); // Reload data
      toast.success(`Appointment marked as ${newStatus}`);
    } catch (error) {
      console.error('Status update error:', error);
      toast.error('Failed to update appointment status');
    }
  };

  const downloadReport = async (appointment: any) => {
    try {
      const reportData = appointment.reportData || {};
      const assessmentData = reportData.assessmentData || {};

      // Format assessment results for PDF
      let handwritingSection = '';
      if (assessmentData.handwriting) {
        const hw = assessmentData.handwriting;
        handwritingSection = `
          <div style="background: #e0f2fe; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #bae6fd;">
            <h3 style="color: #0c4a6e; margin-top: 0;">📝 Handwriting Assessment</h3>
            <p><strong>Dyslexia Risk Score:</strong> ${hw.score}%</p>
            ${hw.indicators ? `<p><strong>Indicators:</strong></p><ul>${hw.indicators.map((ind: string) => `<li>${ind}</li>`).join('')}</ul>` : ''}
          </div>
        `;
      }

      let cognitiveSection = '';
      if (assessmentData.cognitive) {
        const cog = assessmentData.cognitive;
        cognitiveSection = `
          <div style="background: #f3e8ff; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #d8b4fe;">
            <h3 style="color: #581c87; margin-top: 0;">🧠 Cognitive Assessment</h3>
            <p><strong>Overall Dyslexia Score:</strong> ${cog.dyslexiaScore}%</p>
            ${cog.memory ? `<p><strong>Memory Test:</strong> Accuracy: ${cog.memory.accuracy}%</p>` : ''}
            ${cog.attention ? `<p><strong>Attention Test:</strong> Hit Rate: ${cog.attention.hitRate}%, Avg Reaction Time: ${(cog.attention.averageReactionTime / 1000).toFixed(2)}s</p>` : ''}
            ${cog.problemSolving ? `<p><strong>Problem Solving:</strong> Success Rate: ${cog.problemSolving.successRate}%, Error Rate: ${(cog.problemSolving.errorRate * 100).toFixed(0)}%</p>` : ''}
          </div>
        `;
      }

      let speechSection = '';
      if (assessmentData.speech) {
        const speech = assessmentData.speech;
        const fluencyPercentage = (speech.fluencyScore * 10).toFixed(0);
        speechSection = `
          <div style="background: #dcfce7; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #86efac;">
            <h3 style="color: #14532d; margin-top: 0;">🎤 Speech Assessment</h3>
            <p><strong>Fluency Score:</strong> ${fluencyPercentage}%</p>
            ${speech.notes ? `<p><strong>Notes:</strong></p><ul>${speech.notes.map((note: string) => `<li>${note}</li>`).join('')}</ul>` : ''}
          </div>
        `;
      }

      let patientDetailsSection = '';
      if (reportData.patientDetails) {
        const pd = reportData.patientDetails;
        patientDetailsSection = `
          <div style="background: #f9fafb; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="color: #111827; margin-top: 0;">👤 Patient Details</h3>
            <p><strong>Age:</strong> ${pd.age || 'N/A'}</p>
            <p><strong>Gender:</strong> ${pd.gender || 'N/A'}</p>
            ${pd.parentName ? `<p><strong>Parent Name:</strong> ${pd.parentName}</p>` : ''}
            ${pd.parentPhone ? `<p><strong>Parent Phone:</strong> ${pd.parentPhone}</p>` : ''}
            ${pd.parentEmail ? `<p><strong>Parent Email:</strong> ${pd.parentEmail}</p>` : ''}
          </div>
        `;
      }

      // Create a temporary div to render the report
      const reportDiv = document.createElement('div');
      reportDiv.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px;">
          <h1 style="color: #0ea5e9; margin-bottom: 20px; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px;">Dyslexia Assessment Report</h1>
          <div style="margin-bottom: 20px; background: #f0f9ff; padding: 15px; border-radius: 8px;">
            <h2 style="color: #0369a1; margin-top: 0;">Patient Information</h2>
            <p><strong>Name:</strong> ${appointment.patientName}</p>
            <p><strong>Email:</strong> ${appointment.patientEmail}</p>
            <p><strong>Appointment Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
            <p><strong>Doctor:</strong> ${appointment.doctorName}</p>
          </div>
          <div style="margin-bottom: 20px;">
            <h2 style="color: #0369a1; border-bottom: 2px solid #0ea5e9; padding-bottom: 5px;">Assessment Results</h2>
            ${handwritingSection}
            ${cognitiveSection}
            ${speechSection}
            ${patientDetailsSection}
          </div>
        </div>
      `;

      document.body.appendChild(reportDiv);

      // Optimize canvas rendering for smaller file size
      const canvas = await html2canvas(reportDiv, {
        scale: 1, // Reduced from 2 to 1 for smaller file size
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        removeContainer: true,
        imageTimeout: 0,
        allowTaint: false,
        foreignObjectRendering: false
      });

      // Convert to JPEG with compression (quality 0.75 = 75% quality, smaller file)
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(`assessment-report-${appointment.patientName}-${appointment.id}.pdf`);

      document.body.removeChild(reportDiv);
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download report');
      console.error('Download error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock size={12} className="mr-1" />Pending</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Eye size={12} className="mr-1" />Reviewed</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle size={12} className="mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="assessment-container animate-fade-in">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-blue mx-auto mb-4"></div>
              <p className="text-gray-600">Loading doctor dashboard...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!doctorInfo) {
    return (
      <Layout>
        <div className="assessment-container animate-fade-in">
          <Card className="max-w-2xl mx-auto mt-8">
            <CardContent className="p-8 text-center">
              <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
              <h2 className="text-xl font-semibold mb-4">Doctor Profile Not Found</h2>
              <p className="text-gray-600 mb-6">
                You need to register as a doctor to access this dashboard.
              </p>
              <Button onClick={() => window.location.href = '/doctor-registration'}>
                Register as Doctor
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="assessment-container animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Doctor Dashboard</h1>
            <p className="text-gray-600">Welcome back, Dr. {doctorInfo.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-app-blue border-app-blue">
              {doctorInfo.specialization}
            </Badge>
          </div>
        </div>

        {/* Doctor Info Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-full bg-app-blue bg-opacity-10">
                <Users className="text-app-blue" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Doctor Information</h2>
                <p className="text-gray-600">Your professional profile</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{doctorInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium flex items-center gap-2">
                  <Mail size={16} />
                  {doctorInfo.email}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Specialization</p>
                <p className="font-medium">{doctorInfo.specialization}</p>
              </div>
              {doctorInfo.hospital && (
                <div>
                  <p className="text-sm text-gray-600">Hospital</p>
                  <p className="font-medium">{doctorInfo.hospital}</p>
                </div>
              )}
              {doctorInfo.phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone size={16} />
                    {doctorInfo.phone}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Appointments Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-app-green bg-opacity-10">
                <Calendar className="text-app-green" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Patient Appointments</h2>
                <p className="text-gray-600">
                  {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} received
                </p>
              </div>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="text-gray-400 mx-auto mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Appointments Yet</h3>
                <p className="text-gray-500">
                  When patients complete assessments and select you as their doctor,
                  their reports will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id} className="border-l-4 border-l-app-blue">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{appointment.patientName}</h3>
                            {getStatusBadge(appointment.status)}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <Mail size={14} />
                              {appointment.patientEmail}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={14} />
                              {new Date(appointment.appointmentDate).toLocaleDateString()}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">
                            Submitted: {new Date(appointment.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAppointment(appointment)}
                          >
                            <Eye size={16} className="mr-1" />
                            View Report
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReport(appointment)}
                          >
                            <Download size={16} className="mr-1" />
                            Download
                          </Button>
                          {appointment.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(appointment.id, 'reviewed')}
                                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                Mark Reviewed
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(appointment.id, 'completed')}
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                Mark Completed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Viewer Modal */}
        {selectedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
              <div className="p-4 bg-app-blue text-white rounded-t-2xl flex items-center justify-between">
                <h2 className="text-xl font-bold">Assessment Report - {selectedAppointment.patientName}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-app-blue-dark"
                  onClick={() => setSelectedAppointment(null)}
                >
                  ×
                </Button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Patient Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Name:</strong> {selectedAppointment.patientName}</div>
                      <div><strong>Email:</strong> {selectedAppointment.patientEmail}</div>
                      <div><strong>Appointment Date:</strong> {new Date(selectedAppointment.appointmentDate).toLocaleDateString()}</div>
                      <div><strong>Status:</strong> {getStatusBadge(selectedAppointment.status)}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-4 text-lg">Assessment Results</h3>
                    {selectedAppointment.reportData && (
                      <div className="space-y-6">
                        {/* Handwriting Assessment */}
                        {selectedAppointment.reportData.assessmentData?.handwriting && (
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                              <FileText size={18} /> Handwriting Assessment
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Dyslexia Risk Score:</span>
                                <Badge variant={selectedAppointment.reportData.assessmentData.handwriting.score >= 50 ? "destructive" : "default"}>
                                  {selectedAppointment.reportData.assessmentData.handwriting.score}%
                                </Badge>
                              </div>
                              {selectedAppointment.reportData.assessmentData.handwriting.indicators && (
                                <div className="mt-3">
                                  <span className="font-medium">Indicators:</span>
                                  <ul className="list-disc list-inside mt-1 space-y-1 text-gray-700">
                                    {selectedAppointment.reportData.assessmentData.handwriting.indicators.map((indicator: string, idx: number) => (
                                      <li key={idx}>{indicator}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cognitive Assessment */}
                        {selectedAppointment.reportData.assessmentData?.cognitive && (
                          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                              <Users size={18} /> Cognitive Assessment
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Overall Dyslexia Score:</span>
                                <Badge variant={selectedAppointment.reportData.assessmentData.cognitive.dyslexiaScore >= 50 ? "destructive" : "default"}>
                                  {selectedAppointment.reportData.assessmentData.cognitive.dyslexiaScore}%
                                </Badge>
                              </div>

                              {selectedAppointment.reportData.assessmentData.cognitive.memory && (
                                <div className="mt-3 p-3 bg-white rounded border">
                                  <span className="font-medium text-purple-800">Memory Test:</span>
                                  <div className="mt-1 text-gray-700">
                                    Accuracy: <strong>{selectedAppointment.reportData.assessmentData.cognitive.memory.accuracy}%</strong>
                                  </div>
                                </div>
                              )}

                              {selectedAppointment.reportData.assessmentData.cognitive.attention && (
                                <div className="mt-2 p-3 bg-white rounded border">
                                  <span className="font-medium text-purple-800">Attention Test:</span>
                                  <div className="mt-1 space-y-1 text-gray-700">
                                    <div>Hit Rate: <strong>{selectedAppointment.reportData.assessmentData.cognitive.attention.hitRate}%</strong></div>
                                    <div>Average Reaction Time: <strong>{(selectedAppointment.reportData.assessmentData.cognitive.attention.averageReactionTime / 1000).toFixed(2)}s</strong></div>
                                  </div>
                                </div>
                              )}

                              {selectedAppointment.reportData.assessmentData.cognitive.problemSolving && (
                                <div className="mt-2 p-3 bg-white rounded border">
                                  <span className="font-medium text-purple-800">Problem Solving Test:</span>
                                  <div className="mt-1 space-y-1 text-gray-700">
                                    <div>Success Rate: <strong>{selectedAppointment.reportData.assessmentData.cognitive.problemSolving.successRate}%</strong></div>
                                    <div>Average Time: <strong>{selectedAppointment.reportData.assessmentData.cognitive.problemSolving.averageTime}s</strong></div>
                                    <div>Error Rate: <strong>{(selectedAppointment.reportData.assessmentData.cognitive.problemSolving.errorRate * 100).toFixed(0)}%</strong></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Speech Assessment */}
                        {selectedAppointment.reportData.assessmentData?.speech && (
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                              <Phone size={18} /> Speech Assessment
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Fluency Score:</span>
                                <Badge variant={selectedAppointment.reportData.assessmentData.speech.fluencyScore < 7 ? "destructive" : "default"}>
                                  {(selectedAppointment.reportData.assessmentData.speech.fluencyScore * 10)}%
                                </Badge>
                              </div>
                              {selectedAppointment.reportData.assessmentData.speech.notes && (
                                <div className="mt-3">
                                  <span className="font-medium">Notes:</span>
                                  <ul className="list-disc list-inside mt-1 space-y-1 text-gray-700">
                                    {selectedAppointment.reportData.assessmentData.speech.notes.map((note: string, idx: number) => (
                                      <li key={idx}>{note}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Patient Details */}
                        {selectedAppointment.reportData.patientDetails && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-semibold text-gray-900 mb-3">Patient Details</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-medium">Age:</span> {selectedAppointment.reportData.patientDetails.age || 'N/A'}
                              </div>
                              <div>
                                <span className="font-medium">Gender:</span> {selectedAppointment.reportData.patientDetails.gender || 'N/A'}
                              </div>
                              {selectedAppointment.reportData.patientDetails.parentName && (
                                <div>
                                  <span className="font-medium">Parent Name:</span> {selectedAppointment.reportData.patientDetails.parentName}
                                </div>
                              )}
                              {selectedAppointment.reportData.patientDetails.parentPhone && (
                                <div>
                                  <span className="font-medium">Parent Phone:</span> {selectedAppointment.reportData.patientDetails.parentPhone}
                                </div>
                              )}
                              {selectedAppointment.reportData.patientDetails.parentEmail && (
                                <div className="col-span-2">
                                  <span className="font-medium">Parent Email:</span> {selectedAppointment.reportData.patientDetails.parentEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Raw JSON Toggle (for debugging) */}
                        <details className="bg-gray-100 p-3 rounded-lg">
                          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                            View Raw JSON Data
                          </summary>
                          <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-60">
                            {JSON.stringify(selectedAppointment.reportData, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAppointment(null)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => downloadReport(selectedAppointment)}
                  className="flex-1 bg-app-blue hover:bg-app-blue-dark"
                >
                  <Download size={16} className="mr-2" />
                  Download Report
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DoctorDashboard;
