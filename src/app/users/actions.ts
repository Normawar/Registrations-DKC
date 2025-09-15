
'use server';

import { simpleSignUp } from '@/lib/simple-auth';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';


export async function createUserByOrganizer(email: string, password: string, profileData: Omit<SponsorProfile, 'uid' | 'email'>) {
    console.log(`🔑 Creating user ${email} via organizer flow...`);
    try {
        const result = await simpleSignUp(email, password, {
            ...profileData,
            forceProfileUpdate: true, // New users should complete their profile
        });
        return result;
    } catch (error) {
        console.error('❌ Organizer user creation failed:', error);
        throw error;
    }
}
