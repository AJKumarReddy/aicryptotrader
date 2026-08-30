
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { devAuthEnabled, getDevSession } from '@/lib/devAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  const devSession = devAuthEnabled ? getDevSession() : null;

  useEffect(() => {
    if (devAuthEnabled) {
      // Still gated - you have to sign in on the local form first.
      if (!devSession) navigate('/auth');
      return;
    }
    if (isLoaded && !user) {
      navigate('/auth');
    }
  }, [user, isLoaded, navigate, devSession]);

  if (devAuthEnabled) {
    return devSession ? <>{children}</> : null;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
