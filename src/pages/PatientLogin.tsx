import React from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useAuth } from '@clerk/clerk-react';

const PatientLogin = () => {
  const navigate = useNavigate();
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <Layout>
        <div className="assessment-container animate-fade-in min-h-[70vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-app-blue" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="assessment-container animate-fade-in min-h-[70vh] flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg border-0 bg-transparent shadow-none">
          <CardContent className="p-0 flex flex-col items-center">
            <div className="w-full mb-4 pl-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="mb-2"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>

            <SignIn
              path="/patient-login"
              routing="path"
              signUpUrl="/sign-up"
              forceRedirectUrl="/"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-xl border border-gray-200 rounded-xl"
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PatientLogin;
