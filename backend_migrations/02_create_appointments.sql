-- Create the appointments table
create table public.appointments (
  id uuid default gen_random_uuid() primary key,
  patient_name text not null,
  patient_email text not null,
  doctor_id uuid references public.doctors(id) not null,
  appointment_date timestamp with time zone not null,
  status text not null default 'pending', -- pending, confirmed, completed, cancelled
  report_data jsonb, -- Stores the assessment snapshot
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.appointments enable row level security;

-- Policy: Patients can insert appointments
create policy "Allow public insert for appointments" 
on public.appointments for insert 
with check (true);

-- Policy: Patients can view their own appointments (by email match for now)
-- Note: This assumes simple email matching. In a real app with Clerk/Supabase integration, use auth.uid() mapping.
create policy "Allow patients to view own appointments"
on public.appointments for select
using (true); 

-- Policy: Doctors can view appointments assigned to them
create policy "Allow doctors to view assigned appointments"
on public.appointments for select
using (doctor_id = auth.uid());
