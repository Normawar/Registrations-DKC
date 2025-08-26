
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
  role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
  isDistrictCoordinator?: boolean;
};

export function useSponsorProfile() {
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  // Load profile from localStorage on initial mount
  useEffect(() => {
    try {
      const storedProfileRaw = localStorage.getItem('current_user_profile');
      if (storedProfileRaw) {
        setProfile(JSON.parse(storedProfileRaw));
      }
    } catch (error) {
      console.error("Failed to load sponsor profile from localStorage", error);
      setProfile(null);
    } finally {
      setIsProfileLoaded(true);
    }
  }, []);

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'current_user_profile') {
            try {
                const newProfileRaw = event.newValue;
                setProfile(newProfileRaw ? JSON.parse(newProfileRaw) : null);
            } catch (error) {
                console.error("Failed to handle storage change:", error);
                setProfile(null);
            }
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Update function that sets state and saves to localStorage
  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile> | null) => {
    if (newProfileData === null) {
      localStorage.removeItem('current_user_profile');
      setProfile(null);
      return;
    }

    setProfile(prevProfile => {
      const updatedProfile = { ...(prevProfile || {}), ...newProfileData } as SponsorProfile;
      
      try {
        const lowercasedEmail = updatedProfile.email.toLowerCase();
        
        // Save the currently active profile
        localStorage.setItem('current_user_profile', JSON.stringify(updatedProfile));

        // Update the master list of all profiles
        const allProfilesRaw = localStorage.getItem('sponsor_profile');
        const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
        allProfiles[lowercasedEmail] = { ...allProfiles[lowercasedEmail], ...updatedProfile };
        localStorage.setItem('sponsor_profile', JSON.stringify(allProfiles));
        
      } catch (error) {
        console.error("Failed to save sponsor profile to localStorage", error);
      }
      
      return updatedProfile;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}
