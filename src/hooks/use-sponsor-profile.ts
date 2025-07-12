
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();

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
        if (event.key === 'current_user_profile' || event.key === null) {
            loadProfile();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadProfile, pathname]);

  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile>) => {
    // This function now correctly updates the hook's internal state
    // in addition to localStorage.
    setProfile(prev => {
        const currentProfile = prev || defaultSponsorData;
        const updated = { ...currentProfile, ...newProfileData };
        
        try {
            const lowercasedEmail = updated.email.toLowerCase();
            localStorage.setItem('current_user_profile', JSON.stringify(updated));

            // Also update the master list of profiles
            const allProfilesRaw = localStorage.getItem('sponsor_profile');
            const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
            allProfiles[lowercasedEmail] = updated;
            localStorage.setItem('sponsor_profile', JSON.stringify(allProfiles));

        } catch (error) {
            console.error("Failed to save sponsor profile to localStorage", error);
        }
        return updated;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}

