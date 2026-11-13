import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

const SESSION_KEY = 'auth_session';

const Login = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [step, setStep] = useState<'loginType' | 'doctorLogin' | 'adminLogin'>('loginType');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Helper function to check localStorage session (for doctors)
    const checkLocalSession = () => {
      try {
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (!sessionStr) return null;

        const session = JSON.parse(sessionStr);

        // Validate session structure
        if (!session || !session.email || !session.loggedInAt) {
          return null;
        }

        // Check if session is expired (7 days)
        const sessionAge = Date.now() - session.loggedInAt;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (sessionAge > maxAge) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }

        return session;
      } catch (error) {
        // Invalid session, remove it
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
    };

    const checkSession = async () => {
      // Wait for Clerk to load
      if (!isLoaded) {
        console.log('⏳ Waiting for Clerk to load...');
        return;
      }

      // Check Clerk session first (for patients)
      if (isSignedIn) {
        // Patient is logged in via Clerk, redirect to home immediately
        console.log('✅ Patient authenticated via Clerk, redirecting to /');
        navigate('/', { replace: true });
        return;
      }

      // Check localStorage session (for doctors)
      const localSession = checkLocalSession();
      if (localSession) {
        // Doctor is logged in, redirect based on user type
        if (localSession.userType === 'doctor') {
          navigate('/doctor-dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    };

    // Run the check immediately when the component loads
    checkSession();
  }, [navigate, isSignedIn, isLoaded]);

  // Copied from DoctorRegistration to ensure matching hash logic
  const hashPassword = async (password: string) => {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleDoctorLogin = async () => {
    setError(null);

    if (!doctorEmail.trim() || !doctorPassword.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      // 1. Fetch doctor by email from public.doctors table
      const { data: doctorData, error: dbError } = await supabase
        .from('doctors')
        .select('*')
        .eq('email', doctorEmail.trim())
        .single();

      if (dbError || !doctorData) {
        throw new Error('Invalid credentials. Please check your email and password.');
      }

      // 2. Verify Password Hash
      const inputHash = await hashPassword(doctorPassword.trim());

      if (inputHash !== doctorData.password_hash) {
        throw new Error('Invalid credentials. Please check your email and password.');
      }

      // 3. Handle Status Cases
      if (doctorData.status === 'pending') {
        setError("Waiting for admin approval");
        return;
      }

      if (doctorData.status !== 'approved') {
        setError(`Access denied. Status: ${doctorData.status}`);
        return;
      }

      // 4. Approved: Set Local Storage for App Compatibility (ProtectedRoute/Navbar)
      const sessionData = {
        email: doctorData.email,
        name: doctorData.name,
        loggedInAt: Date.now(),
        userType: 'doctor',
        doctorId: doctorData.id
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

      // Redirect to home (as requested)
      navigate('/', { replace: true });

    } catch (error: any) {
      console.error('Doctor login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="assessment-container animate-fade-in min-h-[70vh] flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-6">
            <h1 className="page-title text-center mb-4">Login / Signup</h1>

            {step === 'loginType' ? (
              <div className="space-y-4">
                <p className="text-center text-gray-600 mb-6">Choose your login type</p>
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    onClick={() => navigate('/patient-login')}
                    className="w-full bg-app-blue hover:bg-app-blue-dark h-16 text-lg"
                  >
                    <div className="text-center">
                      <div className="font-semibold">Patient Login</div>
                      <div className="text-sm opacity-80">Login with Google or Email OTP</div>
                    </div>
                  </Button>

                  <Button
                    onClick={() => {
                      setStep('doctorLogin');
                    }}
                    variant="outline"
                    className="w-full h-16 text-lg border-app-green text-app-green hover:bg-app-green hover:text-white"
                  >
                    <div className="text-center">
                      <div className="font-semibold">Doctor Login</div>
                      <div className="text-sm opacity-80">Login with credentials to view patient reports</div>
                    </div>
                  </Button>
                </div>
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-500">
                    Don't have a doctor account?{' '}
                    <button
                      onClick={() => navigate('/doctor-registration')}
                      className="text-app-green hover:underline"
                    >
                      Register as Doctor
                    </button>
                  </p>
                  <p className="text-xs text-gray-400 mt-4">
                    <button onClick={() => {
                      setStep('adminLogin');
                      setError(null);
                      setDoctorEmail('');
                      setDoctorPassword('');
                    }} className="hover:text-gray-600 underline">
                      Admin Access
                    </button>
                  </p>
                </div>
              </div>
            ) : step === 'doctorLogin' ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold text-app-green">Doctor Login</h2>
                  <p className="text-sm text-gray-600">Enter your credentials to access the doctor dashboard</p>
                </div>
                <div>
                  <Label htmlFor="doctor-email">Email Address</Label>
                  <Input
                    id="doctor-email"
                    type="email"
                    value={doctorEmail}
                    onChange={e => setDoctorEmail(e.target.value)}
                    placeholder="doctor@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="doctor-password">Password</Label>
                  <Input
                    id="doctor-password"
                    type="password"
                    value={doctorPassword}
                    onChange={e => setDoctorPassword(e.target.value)}
                    placeholder="Enter your password"
                  />

                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('loginType')}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-app-green hover:bg-app-green-dark"
                    onClick={handleDoctorLogin}
                  >
                    Login as Doctor
                  </Button>
                </div>
              </div>
            ) : step === 'adminLogin' ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Admin Login</h2>
                  <p className="text-sm text-gray-600">Enter admin credentials</p>
                </div>
                <div>
                  <Label htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={doctorEmail}
                    onChange={e => setDoctorEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="admin-password">Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={doctorPassword}
                    onChange={e => setDoctorPassword(e.target.value)}
                    placeholder="Enter admin password"
                  />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep('loginType');
                      setError(null);
                      setDoctorEmail('');
                      setDoctorPassword('');
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-gray-800 hover:bg-gray-900"
                    onClick={() => {
                      // Hardcoded check as requested by user
                      // Ideally, this should be an env var or server-side check
                      if (doctorEmail === 'hamidrazakkhan2003@gmail.com' && doctorPassword === 'Hamid@2003') {
                        localStorage.setItem('admin_session', 'true');
                        navigate('/admin');
                      } else {
                        setError('Invalid admin credentials');
                      }
                    }}
                  >
                    Login as Admin
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Login;