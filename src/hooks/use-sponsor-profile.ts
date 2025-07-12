
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

  useEffect(() => {
    const loadProfile = () => {
      try {
        const storedProfileRaw = localStorage.getItem('current_user_profile');
        const profileData = storedProfileRaw ? JSON.parse(storedProfileRaw) : null;
        setProfile(profileData);
      } catch (error) {
        console.error("Failed to load sponsor profile from localStorage", error);
        setProfile(null);
      } finally {
        setIsProfileLoaded(true);
      }
    };
    
    loadProfile();

    const handleStorageChange = (event: StorageEvent) => {
        // Listen for changes from other tabs
        if (event.key === 'current_user_profile') {
            loadProfile();
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };

  }, [pathname]); // Re-load profile on navigation

  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile> | null) => {
    if (newProfileData === null) {
        localStorage.removeItem('current_user_profile');
        setProfile(null);
        return;
    }

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
      return updated;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}
