import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const SESSION_KEY = "auth_session";

const DoctorLogin = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper for hashing (same as registration)
    const hashPassword = async (password: string) => {
        const enc = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password.trim()) {
            setError('Please enter both email and password.');
            return;
        }

        setIsLoading(true);

        try {
            console.log('[AUTH] doctor login started');
            // 1. Fetch user by email (Custom Auth)
            const startDb = performance.now();
            const { data: doctorData, error: dbError } = await supabase
                .from('doctors')
                .select('*')
                .eq('email', email.trim())
                .single();
            const dbTime = performance.now() - startDb;
            console.log(`[DB] query (select doctor) completed in ${dbTime.toFixed(2)} ms`);

            if (dbTime > 500) {
                console.warn(`⚠️ WARNING: Supabase auth query ${dbTime.toFixed(2)} ms`);
            }

            if (dbError || !doctorData) {
                console.error('Login Query Error:', dbError);
                throw new Error('Invalid credentials or account not found.');
            }

            // 2. Initial Status Check
            if (doctorData.status === 'pending') {
                throw new Error('Your account is waiting for admin approval.');
            }
            if (doctorData.status === 'rejected') {
                throw new Error('Your account request was rejected.');
            }
            if (doctorData.status !== 'approved') {
                throw new Error('Account status unknown.');
            }

            // 3. Verify Password (Client-side Hash Check)
            const startHash = performance.now();
            const inputHash = await hashPassword(password);
            const hashTime = performance.now() - startHash;
            console.log(`[AUTH] password hash verified in ${hashTime.toFixed(2)} ms`);

            if (inputHash !== doctorData.password_hash) {
                throw new Error('Invalid password.');
            }

            // 4. Success: Save Session
            const sessionData = {
                email: doctorData.email,
                name: doctorData.name,
                loggedInAt: Date.now(),
                userType: 'doctor',
                doctorId: doctorData.id
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

            toast.success('Login successful!');
            navigate('/doctor-dashboard', { replace: true });

        } catch (err: any) {

            console.error('Login error:', err);
            setError(err.message || 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Layout>
            <div className="assessment-container animate-fade-in min-h-[70vh] flex items-center justify-center">
                <Card className="w-full max-w-md shadow-lg">
                    <CardContent className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/login')}
                                className="flex items-center gap-2"
                            >
                                <ArrowLeft size={16} />
                                Back
                            </Button>
                            <div className="flex items-center gap-2">
                                <UserCheck className="text-app-blue" size={24} />
                                <h1 className="text-2xl font-bold text-app-blue">Doctor Login</h1>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-6 text-center">
                            Secure login for approved healthcare professionals.
                        </p>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="doctor@example.com"
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="mt-1"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-app-blue hover:bg-app-blue-dark"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...
                                    </>
                                ) : 'Login'}
                            </Button>

                            <div className="text-center text-sm text-gray-500 mt-4">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => navigate('/doctor-registration')}
                                    className="text-app-blue hover:underline font-medium"
                                >
                                    Register here
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default DoctorLogin;
