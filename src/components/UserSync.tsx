import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// This component handles syncing Clerk user data to your Supabase 'patients' table
const UserSync = () => {
    const { user, isLoaded, isSignedIn } = useUser();

    useEffect(() => {
        const syncUser = async () => {
            if (isLoaded && isSignedIn && user) {
                console.log("🔄 Syncing user to Supabase:", user.id);

                const patientData = {
                    id: user.id,
                    name: user.fullName ||
                        user.firstName + ' ' + user.lastName ||
                        user.username ||
                        user.emailAddresses[0]?.emailAddress?.split('@')[0] ||
                        'User',
                    email: user.emailAddresses[0]?.emailAddress || ''
                };

                try {
                    const startDb = performance.now();
                    const { error } = await supabase
                        .from('patients')
                        .upsert(patientData, {
                            onConflict: 'id'
                        });
                    const dbTime = performance.now() - startDb;
                    console.log(`[DB] query (upsert patient) completed in ${dbTime.toFixed(2)} ms`);

                    if (dbTime > 500) {
                        console.warn(`⚠️ WARNING: UserSync DB query > 500ms (${dbTime.toFixed(2)} ms)`);
                    }

                    if (error) {
                        console.error('❌ Error saving patient data:', error);
                    } else {
                        console.log('✅ Patient data synced successfully');
                    }
                } catch (err) {
                    console.error('❌ Exception in UserSync:', err);
                }

            }
        };

        syncUser();
    }, [user, isLoaded, isSignedIn]);

    return null; // This component doesn't render anything
};

export default UserSync;
