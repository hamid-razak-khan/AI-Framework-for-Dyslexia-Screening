# Clerk Authentication Setup Guide

## Overview
The application has been migrated from Supabase Auth to Clerk for patient authentication. Clerk handles Google OAuth and Email OTP, while Supabase is used only as a database.

## Changes Made

### 1. **App.tsx**
- Added `ClerkProvider` wrapper
- Requires `VITE_CLERK_PUBLISHABLE_KEY` environment variable

### 2. **PatientLogin.tsx**
- Replaced Supabase Auth with Clerk authentication
- Google OAuth: Uses `signIn.authenticateWithRedirect()` with `oauth_google` strategy
- Email OTP: Uses Clerk's email code flow
- Automatically saves patient data to Supabase after successful login
- Redirects to `/` after login

### 3. **ProtectedRoute.tsx**
- Uses `useAuth()` from Clerk to check patient authentication
- Still supports doctor login via localStorage (backward compatibility)
- Redirects unauthenticated users to `/login`

### 4. **Navbar.tsx**
- Uses `useUser()` and `useAuth()` from Clerk
- Displays patient name from Clerk user data
- Still supports doctor login display
- Logout clears both Clerk session and localStorage

### 5. **Index.tsx**
- Uses `useUser()` from Clerk
- Saves patient data to Supabase `patients` table after login
- Uses Clerk `user.id` as primary key

### 6. **supabase.ts**
- Removed all auth configuration
- Now only used for database operations

## Environment Variables Required

Add to your `.env` file:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Get your Clerk publishable key from: https://dashboard.clerk.com

## Clerk Dashboard Configuration

1. **Enable Google OAuth**:
   - Go to Clerk Dashboard → User & Authentication → Social Connections
   - Enable Google provider
   - Configure OAuth redirect URLs

2. **Enable Email OTP**:
   - Go to Clerk Dashboard → User & Authentication → Email, Phone, Username
   - Enable "Email code" as a sign-in method

3. **Configure Redirect URLs**:
   - Add your application URL to allowed redirect URLs
   - For development: `http://localhost:8080`
   - For production: Your production domain

## Supabase Table Schema

Ensure your `patients` table matches this schema:
```sql
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Note: The `id` field uses Clerk's `user.id` (TEXT type, not UUID).

## Authentication Flow

### Patient Login (Clerk)
1. User clicks "Patient Login" → navigates to `/patient-login`
2. User chooses Google OAuth or Email OTP
3. After successful authentication:
   - Clerk creates/manages the session
   - Patient data is saved to Supabase `patients` table
   - User is redirected to `/` (home page)

### Doctor Login (LocalStorage)
- Still uses localStorage-based authentication
- Unchanged from previous implementation

## Testing Checklist

- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` to `.env`
- [ ] Configure Google OAuth in Clerk Dashboard
- [ ] Configure Email OTP in Clerk Dashboard
- [ ] Test Google login flow
- [ ] Test Email OTP flow
- [ ] Verify patient data is saved to Supabase
- [ ] Verify redirect to `/` after login
- [ ] Verify protected routes require authentication
- [ ] Verify logout functionality

## Notes

- Patient authentication is now fully handled by Clerk
- Supabase is only used for database operations
- Doctor login remains unchanged (localStorage-based)
- All patient routes are protected and require Clerk authentication
