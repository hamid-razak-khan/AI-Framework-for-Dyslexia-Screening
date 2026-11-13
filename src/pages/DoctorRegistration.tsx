import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const DoctorRegistration = () => {
  const navigate = useNavigate();

  // Debugging: Check connectivity and URL
  React.useEffect(() => {
    const checkConnection = async () => {
      const url = (supabase as any).supabaseUrl || 'Unknown';
      console.log('Current Supabase Config URL:', url);

      try {
        // Simple query to check if we can reach the DB (even if table is empty or we get 401, it proves connection)
        const { data, error, status } = await supabase.from('doctors').select('count', { count: 'exact', head: true });

        if (error) {
          console.error('Connectivity Check Failed:', error);
          console.error('Status:', status);
          if (status === 0 || status === 500 || status === 404) {
            toast.error(`Connection Error (${status}): ${error.message}`);
          }
        } else {
          console.log('✅ Supabase DB Connection Established. Status:', status);
          toast.success('Database Connected', { duration: 2000 });
        }
      } catch (err) {
        console.error('Connectivity Check Exception:', err);
      }
    };
    checkConnection();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    hospital: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const specializations = [
    'Pediatric Neurology',
    'Educational Psychology',
    'Speech-Language Pathology',
    'Occupational Therapy',
    'Learning Disabilities Specialist',
    'Developmental Pediatrics',
    'Neuropsychology',
    'Special Education',
    'Other'
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';

    // Hospital is optional in my code but user requirements said "Form fields: ... Hospital". 
    // I'll make it optional or required? User listed it as a field. I'll make it optional to be safe or just standard input.
    // The DB schema says `hospital text` (nullable by default in Supabase unless specified NOT NULL, prompt said "hospital text" without "not null").

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hashPassword = async (password: string) => {
    // Basic SHA-256 hashing as requested
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      console.log('[AUTH] doctor signup started');
      // 1. Generate UUID explicitly (No Supabase Auth)
      const newDoctorId = crypto.randomUUID();

      // 2. Hash password for doctors table
      const startHash = performance.now();
      const passwordHash = await hashPassword(formData.password);
      console.log(`[AUTH] password hashed in ${(performance.now() - startHash).toFixed(2)} ms`);

      // 3. Insert into doctors table directly
      const startDb = performance.now();
      const { error: dbError } = await supabase.from('doctors').insert({
        id: newDoctorId,
        name: formData.name,
        email: formData.email,
        password_hash: passwordHash,
        specialization: formData.specialization,
        hospital: formData.hospital,
        status: 'pending'
      });
      const dbTime = performance.now() - startDb;
      console.log(`[AUTH] insert completed in ${dbTime.toFixed(2)} ms`);

      if (dbTime > 2000) {
        console.warn(`⚠️ WARNING: Supabase auth insert ${dbTime.toFixed(2)} ms`);
      }

      if (dbError) {
        console.error('Database insertion error:', dbError);
        throw new Error('Failed to save doctor details: ' + dbError.message);
      }

      toast.success('Registration successful!', {
        description: 'Waiting for admin approval.'
      });

      // 4. Navigate back to login
      navigate('/doctor-login');

    } catch (error: any) {

      console.error('Registration Error:', error);
      toast.error('Registration failed', {
        description: error.message || 'An error occurred during registration'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <Layout>
      <div className="assessment-container animate-fade-in min-h-[70vh] flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="flex items-center gap-2">
                <ArrowLeft size={16} /> Back
              </Button>
              <div className="flex items-center gap-2">
                <UserCheck className="text-app-blue" size={24} />
                <h1 className="text-2xl font-bold text-app-blue">Doctor Registration</h1>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Register to access the doctor dashboard. Admin approval is required.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Name */}
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Dr. John Smith"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="doctor@example.com"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Create a password"
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
                </div>

                {/* Specialization */}
                <div>
                  <Label htmlFor="specialization">Specialization *</Label>
                  <Select
                    value={formData.specialization}
                    onValueChange={(value) => handleInputChange('specialization', value)}
                  >
                    <SelectTrigger className={errors.specialization ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select Specialization" />
                    </SelectTrigger>
                    <SelectContent>
                      {specializations.map((spec) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.specialization && <p className="text-sm text-red-600 mt-1">{errors.specialization}</p>}
                </div>

                {/* Hospital */}
                <div>
                  <Label htmlFor="hospital">Hospital / Clinic</Label>
                  <Input
                    id="hospital"
                    value={formData.hospital}
                    onChange={(e) => handleInputChange('hospital', e.target.value)}
                    placeholder="City General Hospital"
                  />
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1 bg-app-blue hover:bg-app-blue-dark">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                    </>
                  ) : 'Register as Doctor'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DoctorRegistration;

