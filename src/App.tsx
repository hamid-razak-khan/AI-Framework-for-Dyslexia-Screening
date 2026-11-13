import { lazy, Suspense, useEffect } from "react";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthenticateWithRedirectCallback, SignedIn, UserButton, useUser } from "@clerk/clerk-react";
import UserSync from "./components/UserSync";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const SimpleHandwritingTest = lazy(() => import("./pages/SimpleHandwritingTest"));
const CognitiveAssessment = lazy(() => import("./pages/CognitiveAssessment"));
const SpeechAssessment = lazy(() => import("./pages/SpeechAssessment"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const PatientLogin = lazy(() => import("./pages/PatientLogin"));
const PatientSignUp = lazy(() => import("./pages/PatientSignUp"));
const DoctorRegistration = lazy(() => import("./pages/DoctorRegistration"));
const DoctorLogin = lazy(() => import("./pages/DoctorLogin"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));



const queryClient = new QueryClient();

const UserGreeting = () => {
  const { user } = useUser();
  if (!user) return null;
  return (
    <div className="mr-4 font-medium text-gray-700">
      Hi, {user.firstName || user.username || "there"}
    </div>
  );
};

const OAuthCallback = () => {
  return <AuthenticateWithRedirectCallback />;
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-blue"></div>
  </div>
);


const App = () => {
  useEffect(() => {
    console.timeEnd('[WEB] app-bootstrap');
    console.time('[WEB] auth-ready');
    console.log('[WEB] First render completed');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>

      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UserSync />
        <BrowserRouter>
          <header className="absolute top-4 right-4 z-50 flex items-center">
            <SignedIn>
              <UserGreeting />
              <UserButton afterSignOutUrl="/login" />
            </SignedIn>
          </header>

          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/patient-login/*" element={<PatientLogin />} />
              <Route path="/sign-in/*" element={<PatientLogin />} />
              <Route path="/sign-up/*" element={<PatientSignUp />} />

              <Route path="/doctor-registration" element={<DoctorRegistration />} />
              <Route path="/doctor-login" element={<DoctorLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />

              {/* OAuth callback handler - currently configured to redirect to home or handle the hash */}
              <Route path="/sso-callback" element={<OAuthCallback />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/handwriting"
                element={
                  <ProtectedRoute>
                    <SimpleHandwritingTest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simple-handwriting-test"
                element={
                  <ProtectedRoute>
                    <SimpleHandwritingTest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cognitive"
                element={
                  <ProtectedRoute>
                    <CognitiveAssessment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/speech"
                element={
                  <ProtectedRoute>
                    <SpeechAssessment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor-dashboard"
                element={
                  <ProtectedRoute>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;