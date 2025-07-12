
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

export function useSponsorProfile() {
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const pathname = usePathname();

  // This effect runs ONCE on mount to load the initial profile.
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
  
  // This effect listens for external changes (e.g., from other tabs).
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'current_user_profile') {
            try {
                const storedProfileRaw = localStorage.getItem('current_user_profile');
                setProfile(storedProfileRaw ? JSON.parse(storedProfileRaw) : null);
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


  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile> | null) => {
    // If null, clear the profile
    if (newProfileData === null) {
      localStorage.removeItem('current_user_profile');
      setProfile(null);
      return;
    }

    // This function now directly updates the state AND saves to localStorage.
    // It prevents the useEffect loop that was causing the race condition.
    setProfile(prevProfile => {
      const updated = { ...(prevProfile || {}), ...newProfileData } as SponsorProfile;
      
      try {
        const lowercasedEmail = updated.email.toLowerCase();
        
        // Save the currently active profile
        localStorage.setItem('current_user_profile', JSON.stringify(updated));

        // Also update the master list of all profiles
        const allProfilesRaw = localStorage.getItem('sponsor_profile');
        const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
        allProfiles[lowercasedEmail] = { ...allProfiles[lowercasedEmail], ...updated };
        localStorage.setItem('sponsor_profile', JSON.stringify(allProfiles));
        
      } catch (error) {
        console.error("Failed to save sponsor profile to localStorage", error);
      }
      
      // Return the updated state
      return updated;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}
