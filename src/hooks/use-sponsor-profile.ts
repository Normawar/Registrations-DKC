
'use client';

import { useState, useEffect, useCallback } from 'react';

export type SponsorProfile = {
  firstName: string;
  lastName: string;
  district: string;
  school: string;
  email: string;
  phone: string;
  gtCoordinatorEmail?: string;
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
  gtCoordinatorEmail: '',
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
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'current_user_profile') {
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
