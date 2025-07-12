
'use client';

import { useState, useEffect, useCallback } from 'react';

export type SponsorProfile = {
  firstName: string;
  lastName: string;
  district: string;
  school: string;
  email: string;
  phone: string;
  schoolAddress?: string;
  schoolPhone?: string;
  gtCoordinatorEmail?: string;
  bookkeeperEmail?: string;
  avatarType: 'icon' | 'upload';
  avatarValue: string; // Icon name or image URL
  role: 'sponsor' | 'organizer' | 'individual';
};

const defaultSponsorData: SponsorProfile = {
  firstName: 'User',
  lastName: 'Name',
  district: '',
  school: '',
  email: '',
  phone: '',
  schoolAddress: '',
  schoolPhone: '',
  gtCoordinatorEmail: '',
  bookkeeperEmail: '',
  avatarType: 'icon',
  avatarValue: 'KingIcon', 
  role: 'sponsor',
};

export function useSponsorProfile() {
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const loadProfile = useCallback(() => {
    try {
        const storedProfileRaw = localStorage.getItem('current_user_profile');
        const profileData: SponsorProfile | null = storedProfileRaw ? JSON.parse(storedProfileRaw) : null;

        if (profileData) {
            setProfile(profileData);
        } else {
            setProfile(null); // Explicitly set to null if no profile is found
        }
        
    } catch (error) {
        console.error("Failed to load sponsor profile from localStorage", error);
        setProfile(null);
    } finally {
        setIsProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    
    // This event listener ensures that if the profile changes in another tab (e.g., login/logout),
    // this hook will re-run and update its state.
    const handleStorageChange = (event: StorageEvent) => {
        // Only reload if the key is for the current user profile, or if all users/profiles are changed.
        if (event.key === 'current_user_profile' || event.key === 'sponsor_profile' || event.key === 'users') {
            loadProfile();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadProfile]);

  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile>) => {
    setProfile(prev => {
        const currentProfile = prev || defaultSponsorData;
        const updated = { ...currentProfile, ...newProfileData };
        
        try {
            localStorage.setItem('current_user_profile', JSON.stringify(updated));

            // Also update the master list of profiles
            const allProfilesRaw = localStorage.getItem('sponsor_profile');
            const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
            allProfiles[updated.email.toLowerCase()] = updated;
            localStorage.setItem('sponsor_profile', JSON.stringify(allProfiles));

        } catch (error) {
            console.error("Failed to save sponsor profile to localStorage", error);
        }
        return updated;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}
