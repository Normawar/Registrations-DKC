
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
        const storedProfileRaw = localStorage.getItem('sponsor_profile');
        let profileData: SponsorProfile | null = storedProfileRaw ? JSON.parse(storedProfileRaw) : null;

        // The 'user_role' from the session is the source of truth for the current role.
        const sessionRole = localStorage.getItem('user_role');

        if (!profileData && sessionRole) {
            // If there's a role but no profile, maybe it's a new login or from another machine.
            // Look for the full profile details in the "all profiles" storage.
            const allProfilesRaw = localStorage.getItem('all_profiles');
            if (allProfilesRaw) {
                const allProfiles = JSON.parse(allProfilesRaw);
                // This assumes email is stored in a way we can find it.
                // This part of the logic is weak as we don't have a session email.
                // For this app, we will rely on sponsor_profile being the primary source.
            }
        }

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
        if (event.key === 'sponsor_profile' || event.key === 'user_role') {
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
            localStorage.setItem('sponsor_profile', JSON.stringify(updated));

            // Also update the master list of profiles
            const allProfilesRaw = localStorage.getItem('all_profiles');
            const allProfiles = allProfilesRaw ? JSON.parse(allProfilesRaw) : {};
            allProfiles[updated.email] = updated;
            localStorage.setItem('all_profiles', JSON.stringify(allProfiles));
            
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
