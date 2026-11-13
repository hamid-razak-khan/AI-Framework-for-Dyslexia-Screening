import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Brain, Headphones, Stethoscope, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

const Navbar = () => {
  const navigate = useNavigate();
  const { isSignedIn, signOut } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  // State for doctor login (localStorage-based)
  const [doctorSession, setDoctorSession] = React.useState<any>(null);
  const [isDoctor, setIsDoctor] = React.useState(false);

  React.useEffect(() => {
    // Helper function to check localStorage session (for doctors)
    const getLocalSession = () => {
      try {
        const sessionStr = localStorage.getItem('auth_session');
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
          localStorage.removeItem('auth_session');
          return null;
        }

        return session;
      } catch (error) {
        localStorage.removeItem('auth_session');
        return null;
      }
    };

    const checkDoctorSession = () => {
      const localSession = getLocalSession();
      if (localSession && localSession.userType === 'doctor') {
        setDoctorSession(localSession);
        setIsDoctor(true);
      } else {
        setDoctorSession(null);
        setIsDoctor(false);
      }
    };

    checkDoctorSession();

    // Listen for localStorage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_session') {
        checkDoctorSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check auth on focus (in case localStorage changed in same tab)
    const handleFocus = () => {
      checkDoctorSession();
    };

    window.addEventListener('focus', handleFocus);

    // Periodic check for localStorage changes (fallback for same-tab changes)
    // This helps detect doctor login which uses localStorage
    // Only check when page is visible to save resources
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        checkDoctorSession();
      }
    }, 2000); // Check every 2 seconds when page is visible

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Sign out from Clerk (for patients)
      if (isSignedIn) {
        await signOut();
      }
    } catch (error) {
      console.error('Error signing out from Clerk:', error);
    }

    try {
      // Clear localStorage session (for doctors)
      localStorage.removeItem('auth_session');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // Update state
    setDoctorSession(null);
    setIsDoctor(false);

    // Redirect to login page for both patients and doctors
    navigate('/login', { replace: true });
  };

  // Determine if user is logged in (Clerk patient or localStorage doctor)
  const isLoggedIn = (isSignedIn && userLoaded) || isDoctor;

  // Get user name
  const getUserName = () => {
    if (isDoctor && doctorSession) {
      return doctorSession.name || 'Doctor';
    }
    if (user) {
      return user.fullName ||
        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
        user.emailAddresses[0]?.emailAddress?.split('@')[0] ||
        'User';
    }
    return 'User';
  };

  return (
    <nav className="bg-white shadow-sm py-3 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Brain size={28} className="text-app-blue" />
          <span className="text-xl font-semibold text-app-blue">CognitiveLens</span>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/handwriting" className="flex items-center gap-2 text-gray-700 hover:text-app-blue transition-colors">
            <FileText size={18} />
            <span>Handwriting Test</span>
          </Link>
          <Link to="/cognitive" className="flex items-center gap-2 text-gray-700 hover:text-app-blue transition-colors">
            <Brain size={18} />
            <span>Cognitive</span>
          </Link>
          <Link to="/speech" className="flex items-center gap-2 text-gray-700 hover:text-app-blue transition-colors">
            <Headphones size={18} />
            <span>Speech</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <>
              {isDoctor ? (
                <Button variant="outline" onClick={() => navigate('/doctor-dashboard')}>
                  <Stethoscope size={16} className="mr-2" />
                  Doctor Dashboard
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </Button>
              )}

              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/doctor-registration')}
                className="flex items-center gap-2"
              >
                <UserCheck size={16} />
                Register as Doctor
              </Button>
              <Button className="bg-app-blue hover:bg-app-blue-dark text-white" onClick={() => navigate('/login')}>
                Login / Signup
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
