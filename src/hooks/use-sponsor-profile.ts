'use client';

import { useState, useEffect, useCallback } from 'react';

export type SponsorProfile = {
  firstName: string;
  lastName: string;
  district: string;
  school: string;
  email: string;
  phone: string;
  avatarType: 'icon' | 'upload';
  avatarValue: string; // Icon name or image URL
};

const defaultSponsorData: SponsorProfile = {
  firstName: 'Sponsor',
  lastName: 'Name',
  district: 'SHARYLAND ISD',
  school: 'SHARYLAND PIONEER H S',
  email: 'sponsor@chessmate.com',
  phone: '(555) 555-5555',
  avatarType: 'icon',
  avatarValue: 'KingIcon', 
};

export function useSponsorProfile() {
  const [profile, setProfile] = useState<SponsorProfile>(defaultSponsorData);

  const loadProfile = useCallback(() => {
    try {
        const storedProfile = localStorage.getItem('sponsor_profile');
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
        } else {
            localStorage.setItem('sponsor_profile', JSON.stringify(defaultSponsorData));
            setProfile(defaultSponsorData);
        }
    } catch (error) {
        console.error("Failed to load sponsor profile from localStorage", error);
        setProfile(defaultSponsorData);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'sponsor_profile') {
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
        const updated = { ...prev, ...newProfileData };
        try {
            localStorage.setItem('sponsor_profile', JSON.stringify(updated));
            // Dispatch a custom event to notify other components/tabs
            window.dispatchEvent(new Event('profileUpdate'));
        } catch (error) {
            console.error("Failed to save sponsor profile to localStorage", error);
        }
        return updated;
    });
  }, []);
  
  return { profile, updateProfile };
}
