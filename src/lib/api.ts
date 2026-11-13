// Mock API utilities for doctor and appointment management
// This simulates backend functionality using localStorage

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  phone?: string;
  registrationDate: string;
  isActive: boolean;
  password?: string; // For demo purposes
}

export interface Appointment {
  id: string;
  patientName: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  reportData: any; // The PDF report data
  status: 'pending' | 'reviewed' | 'completed';
  createdAt: string;
}

export interface UserSession {
  email: string;
  name: string;
  loggedInAt: number;
  userType?: 'patient' | 'doctor';
}

// Storage keys
const DOCTORS_KEY = 'registered_doctors';
const APPOINTMENTS_KEY = 'patient_appointments';
const USER_SESSION_KEY = 'auth_session';

// Doctor Management Functions
export const doctorApi = {
  // Register a new doctor
  register: (doctorData: Omit<Doctor, 'id' | 'registrationDate' | 'isActive'>): Doctor => {
    const doctors = doctorApi.getAll();
    
    // Check for duplicate email
    const existingDoctor = doctors.find(d => d.email.toLowerCase() === doctorData.email.toLowerCase());
    if (existingDoctor) {
      throw new Error('A doctor with this email already exists');
    }

    const newDoctor: Doctor = {
      ...doctorData,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      registrationDate: new Date().toISOString(),
      isActive: true,
      password: doctorData.password || 'doctor123' // Default password
    };

    doctors.push(newDoctor);
    localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors));
    return newDoctor;
  },

  // Get all registered doctors
  getAll: (): Doctor[] => {
    try {
      const doctors = localStorage.getItem(DOCTORS_KEY);
      return doctors ? JSON.parse(doctors) : [];
    } catch {
      return [];
    }
  },

  // Get doctor by ID
  getById: (id: string): Doctor | null => {
    const doctors = doctorApi.getAll();
    return doctors.find(d => d.id === id) || null;
  },

  // Get doctor by email
  getByEmail: (email: string): Doctor | null => {
    const doctors = doctorApi.getAll();
    return doctors.find(d => d.email.toLowerCase() === email.toLowerCase()) || null;
  },

  // Update doctor information
  update: (id: string, updates: Partial<Doctor>): Doctor | null => {
    const doctors = doctorApi.getAll();
    const index = doctors.findIndex(d => d.id === id);
    
    if (index === -1) return null;

    doctors[index] = { ...doctors[index], ...updates };
    localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors));
    return doctors[index];
  },

  // Deactivate doctor
  deactivate: (id: string): boolean => {
    const doctor = doctorApi.getById(id);
    if (!doctor) return false;
    
    doctorApi.update(id, { isActive: false });
    return true;
  }
};

// Appointment Management Functions
export const appointmentApi = {
  // Create a new appointment
  create: (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Appointment => {
    const appointments = appointmentApi.getAll();
    
    const newAppointment: Appointment = {
      ...appointmentData,
      id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    appointments.push(newAppointment);
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
    return newAppointment;
  },

  // Get all appointments
  getAll: (): Appointment[] => {
    try {
      const appointments = localStorage.getItem(APPOINTMENTS_KEY);
      return appointments ? JSON.parse(appointments) : [];
    } catch {
      return [];
    }
  },

  // Get appointments for a specific doctor
  getByDoctorId: (doctorId: string): Appointment[] => {
    const appointments = appointmentApi.getAll();
    return appointments.filter(apt => apt.doctorId === doctorId);
  },

  // Get appointments for a specific patient
  getByPatientEmail: (patientEmail: string): Appointment[] => {
    const appointments = appointmentApi.getAll();
    return appointments.filter(apt => apt.patientEmail.toLowerCase() === patientEmail.toLowerCase());
  },

  // Update appointment status
  updateStatus: (id: string, status: Appointment['status']): Appointment | null => {
    const appointments = appointmentApi.getAll();
    const index = appointments.findIndex(apt => apt.id === id);
    
    if (index === -1) return null;

    appointments[index].status = status;
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
    return appointments[index];
  },

  // Get appointment by ID
  getById: (id: string): Appointment | null => {
    const appointments = appointmentApi.getAll();
    return appointments.find(apt => apt.id === id) || null;
  }
};

// User Session Management
export const userApi = {
  // Get current user session
  getCurrentUser: (): UserSession | null => {
    try {
      const session = localStorage.getItem(USER_SESSION_KEY);
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  },

  // Update user session with type
  updateUserType: (userType: 'patient' | 'doctor'): void => {
    const session = userApi.getCurrentUser();
    if (session) {
      session.userType = userType;
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
    }
  },

  // Check if user is a doctor
  isDoctor: (): boolean => {
    const session = userApi.getCurrentUser();
    return session?.userType === 'doctor';
  },

  // Check if user is a patient
  isPatient: (): boolean => {
    const session = userApi.getCurrentUser();
    return session?.userType === 'patient' || !session?.userType;
  }
};

// PDF Report Management
export const reportApi = {
  // Generate a unique report ID
  generateReportId: (): string => {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Store report data
  storeReport: (reportId: string, reportData: any): void => {
    const reports = reportApi.getAllReports();
    reports[reportId] = {
      ...reportData,
      id: reportId,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('stored_reports', JSON.stringify(reports));
  },

  // Get report by ID
  getReport: (reportId: string): any => {
    const reports = reportApi.getAllReports();
    return reports[reportId] || null;
  },

  // Get all reports
  getAllReports: (): Record<string, any> => {
    try {
      const reports = localStorage.getItem('stored_reports');
      return reports ? JSON.parse(reports) : {};
    } catch {
      return {};
    }
  }
};

// Utility function to check if user has completed all assessments
export const hasCompletedAllAssessments = (): boolean => {
  try {
    const handwriting = localStorage.getItem('simple_handwriting_result');
    const cognitive = localStorage.getItem('cognitive_result');
    const speech = localStorage.getItem('speech_result');
    
    return !!(handwriting && cognitive && speech);
  } catch {
    return false;
  }
};

// Utility function to get assessment data
export const getAssessmentData = () => {
  try {
    return {
      handwriting: localStorage.getItem('simple_handwriting_result') ? JSON.parse(localStorage.getItem('simple_handwriting_result')!) : null,
      cognitive: localStorage.getItem('cognitive_result') ? JSON.parse(localStorage.getItem('cognitive_result')!) : null,
      speech: localStorage.getItem('speech_result') ? JSON.parse(localStorage.getItem('speech_result')!) : null
    };
  } catch {
    return {
      handwriting: null,
      cognitive: null,
      speech: null
    };
  }
};
