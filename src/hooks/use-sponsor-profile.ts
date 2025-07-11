
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
  firstName: 'Sponsor',
  lastName: 'Name',
  district: 'SHARYLAND ISD',
  school: 'SHARYLAND PIONEER H S',
  email: 'sponsor@chessmate.com',
  phone: '(555) 555-5555',
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
        let profileData: SponsorProfile | null = storedProfileRaw ? JSON.parse(storedProfileRaw) : null;

        // The 'user_role' from the session is the source of truth for the current role.
        const sessionRole = localStorage.getItem('user_role');

        if (profileData) {
            if (sessionRole && (sessionRole === 'sponsor' || sessionRole === 'organizer' || sessionRole === 'individual')) {
                profileData.role = sessionRole as 'sponsor' | 'organizer' | 'individual';
            }
            setProfile(profileData);
        } else {
            // Fallback if nothing is stored
            const role = (sessionRole as SponsorProfile['role']) || 'sponsor';
            setProfile({ ...defaultSponsorData, role });
        }
        
        setIsProfileLoaded(true);
        
    } catch (error) {
        console.error("Failed to load sponsor profile from localStorage", error);
        setProfile(defaultSponsorData);
        setIsProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'current_user_profile' || event.key === 'user_role' || event.key === 'sponsor_profile') {
            loadProfile();
        }
    };
    
    // Custom event listener for same-tab updates
    const handleProfileUpdate = () => {
        loadProfile();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profileUpdate', handleProfileUpdate);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('profileUpdate', handleProfileUpdate);
    };
  }, [loadProfile]);

  const updateProfile = useCallback((newProfileData: Partial<SponsorProfile>) => {
    setProfile(prev => {
        if (newProfileData.role) {
            localStorage.setItem('user_role', newProfileData.role);
        }
        const updated = { ...(prev || defaultSponsorData), ...newProfileData };
        try {
            // This is the session profile
            localStorage.setItem('current_user_profile', JSON.stringify(updated));

            // Also update the master list of profiles
            const allProfilesRaw = localStorage.getItem('sponsor_profile');
            const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
            allProfiles[updated.email] = updated;
            localStorage.setItem('sponsor_profile', JSON.stringify(allProfiles));
            
            // Defer dispatch to avoid illegal cross-component updates during render.
            setTimeout(() => window.dispatchEvent(new Event('profileUpdate')), 0);
        } catch (error) {
            console.error("Failed to save sponsor profile to localStorage", error);
        }
        return updated;
    });
  }, []);
  
  return { profile, updateProfile, isProfileLoaded };
}
