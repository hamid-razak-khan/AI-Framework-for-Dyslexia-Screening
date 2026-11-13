import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, Shield, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Note: In a real app, this should be protected. 
// For now, it's an internal tool for the 'User' (Developer/Admin).

import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    useEffect(() => {
        const isAdmin = localStorage.getItem('admin_session');
        if (!isAdmin) {
            toast.error('Unauthorized access');
            navigate('/login');
        }
    }, [navigate]);

    const fetchDoctors = async () => {
        setIsLoading(true);
        try {
            const validBaseUrl = 'http://127.0.0.1:5000';
            // Fetch ALL doctors now
            const response = await fetch(`${validBaseUrl}/admin/all-doctors`);

            if (!response.ok) {
                throw new Error('Failed to fetch doctors');
            }

            const data = await response.json();
            setDoctors(data || []);

        } catch (error) {
            console.error('Error fetching doctors:', error);
            toast.error('Failed to load doctors');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (doctorId: string) => {
        try {
            const validBaseUrl = 'http://127.0.0.1:5000';
            const response = await fetch(`${validBaseUrl}/admin/approve-doctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctor_id: doctorId })
            });

            if (!response.ok) throw new Error('Approval failed');

            toast.success('Doctor approved successfully');
            toast.success('Doctor approved successfully');
            fetchDoctors(); // Refresh list
        } catch (error) {
            toast.error('Failed to approve doctor');
        }
    };

    const handleReject = async (doctorId: string) => {
        try {
            const validBaseUrl = 'http://127.0.0.1:5000';
            const response = await fetch(`${validBaseUrl}/admin/reject-doctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctor_id: doctorId })
            });

            if (!response.ok) throw new Error('Rejection failed');

            toast.success('Doctor rejected');
            toast.success('Doctor rejected');
            fetchDoctors(); // Refresh list
        } catch (error) {
            toast.error('Failed to reject doctor');
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const filteredDoctors = doctors.filter(doc => {
        if (filter === 'all') return true;
        return doc.status === filter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-700 border-green-200';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        }
    };

    return (
        <Layout>
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-full">
                            <Shield className="text-purple-600" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                            <p className="text-gray-500">Manage doctor approvals</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={fetchDoctors} disabled={isLoading}>
                            <RefreshCw size={16} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Button
                                variant={filter === 'all' ? 'default' : 'outline'}
                                onClick={() => setFilter('all')}
                                size="sm"
                            >
                                All
                            </Button>
                            <Button
                                variant={filter === 'pending' ? 'default' : 'outline'}
                                onClick={() => setFilter('pending')}
                                size="sm"
                                className={filter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                            >
                                Pending
                            </Button>
                            <Button
                                variant={filter === 'approved' ? 'default' : 'outline'}
                                onClick={() => setFilter('approved')}
                                size="sm"
                                className={filter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                                Approved
                            </Button>
                            <Button
                                variant={filter === 'rejected' ? 'default' : 'outline'}
                                onClick={() => setFilter('rejected')}
                                size="sm"
                                className={filter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
                            >
                                Rejected
                            </Button>
                        </div>

                        <h2 className="text-xl font-semibold mb-4 capitalize">{filter} Doctors ({filteredDoctors.length})</h2>

                        {filteredDoctors.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg">
                                <p className="text-gray-500">No doctors found.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredDoctors.map((doctor) => (
                                    <div key={doctor.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg hover:border-purple-200 transition-colors bg-white">
                                        <div className="mb-4 md:mb-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-semibold text-lg">{doctor.name}</h3>
                                                <Badge variant="outline" className={getStatusColor(doctor.status)}>
                                                    {doctor.status}
                                                </Badge>
                                            </div>
                                            <p className="text-gray-600 text-sm">{doctor.email}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                <span>{doctor.specialization}</span>
                                                <span>•</span>
                                                <span>{doctor.hospital || 'No Hospital Listed'}</span>
                                                <span className="text-xs text-slate-400">ID: {doctor.id.slice(0, 8)}...</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            {doctor.status === 'pending' && (
                                                <>
                                                    <Button
                                                        onClick={() => handleReject(doctor.id)}
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 md:flex-none text-red-600 border-red-200 hover:bg-red-50"
                                                    >
                                                        <X size={16} className="mr-2" />
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleApprove(doctor.id)}
                                                        size="sm"
                                                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                                                    >
                                                        <Check size={16} className="mr-2" />
                                                        Approve
                                                    </Button>
                                                </>
                                            )}
                                            {doctor.status === 'approved' && (
                                                <Badge variant="outline" className="border-green-500 text-green-600 px-3 py-1">
                                                    <Check size={12} className="mr-1" /> Active
                                                </Badge>
                                            )}
                                            {doctor.status === 'rejected' && (
                                                <Badge variant="outline" className="border-red-500 text-red-600 px-3 py-1">
                                                    <X size={12} className="mr-1" /> Rejected
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
};

export default AdminDashboard;
