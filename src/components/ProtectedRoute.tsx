import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const SESSION_KEY = "auth_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();

  // Get doctor session from localStorage (for demo / professional login)
  const getLocalSession = () => {
    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);

      // Validate structure
      if (!session?.email || !session?.loggedInAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      // Check expiry
      const sessionAge = Date.now() - session.loggedInAt;
      if (sessionAge > SESSION_MAX_AGE) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  };

  // Wait for Clerk to load before making auth decisions
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Auth is loaded
  const authReadyTime = performance.now();

  // Patient (Clerk) OR Doctor (localStorage)
  const gateStart = performance.now();
  const localSession = getLocalSession();
  const isAuthenticated = isSignedIn || !!localSession;
  const gateTime = performance.now() - gateStart;

  // Cleanup auth-ready timer if it was started in App.tsx
  try {
    console.timeEnd('[WEB] auth-ready');
  } catch (e) {
    // Already ended or never started
  }

  console.log(`[WEB] Protected route gate passed in ${gateTime.toFixed(2)} ms`);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;

};

export default ProtectedRoute;
