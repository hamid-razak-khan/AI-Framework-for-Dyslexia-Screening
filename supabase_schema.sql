-- Create the doctors table
create table public.doctors (
  id uuid references auth.users on delete cascade not null primary key,
  name text not null,
  email text not null,
  specialization text not null,
  hospital text,
  phone text,
  password_hash text,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.doctors enable row level security;

-- Policy 1: Allow users to insert their own profile during registration
create policy "Enable insert for authenticated users only"
  on public.doctors for insert
  with check (auth.uid() = id);

-- Policy 2: Allow doctors to read their own profile
create policy "Enable read access for users based on their ID"
  on public.doctors for select
  using (auth.uid() = id);

-- Policy 3: Allow Admin (Service Role) full access is automatic (bypasses RLS)
