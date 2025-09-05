
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

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

// This key will now only store the email of the currently logged-in user.
const CURRENT_USER_SESSION_KEY = 'current_user_email';

export function useSponsorProfile() {
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const fetchProfile = useCallback(async (email: string) => {
    if (!db) {
        console.error("Firestore is not initialized.");
        setIsProfileLoaded(true);
        return;
    }
    const docRef = doc(db, "users", email.toLowerCase());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setProfile(docSnap.data() as SponsorProfile);
    } else {
      console.log("No such profile!");
      setProfile(null);
      localStorage.removeItem(CURRENT_USER_SESSION_KEY);
    }
    setIsProfileLoaded(true);
  }, []);

  // Load profile from session on initial mount
  useEffect(() => {
    try {
      const userEmail = localStorage.getItem(CURRENT_USER_SESSION_KEY);
      if (userEmail) {
        fetchProfile(userEmail);
      } else {
        setIsProfileLoaded(true); // No user logged in
      }
    } catch (error) {
      console.error("Failed to load user session from localStorage", error);
      setIsProfileLoaded(true);
    }
  }, [fetchProfile]);
  
  // Listen for changes from other tabs (logout)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === CURRENT_USER_SESSION_KEY) {
            const newEmail = event.newValue;
            if (newEmail) {
              fetchProfile(newEmail);
            } else {
              setProfile(null);
            }
        }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchProfile]);

  const updateProfile = useCallback(async (newProfileData: Partial<SponsorProfile> | null) => {
    if (!db) {
        console.error("Firestore is not initialized. Cannot update profile.");
        return;
    }

    if (newProfileData === null) {
      localStorage.removeItem(CURRENT_USER_SESSION_KEY);
      setProfile(null);
      return;
    }
    
    // The first time a profile is created (during signup), we set the session.
    // On subsequent updates, we just update the data.
    const emailToUpdate = (newProfileData.email || profile?.email)?.toLowerCase();
    if (!emailToUpdate) {
        console.error("Cannot update profile without an email.");
        return;
    }

    // Set session for new logins/signups
    if (newProfileData.email) {
        localStorage.setItem(CURRENT_USER_SESSION_KEY, emailToUpdate);
    }

    const updatedProfile = { ...(profile || {}), ...newProfileData } as SponsorProfile;

    try {
        const docRef = doc(db, "users", emailToUpdate);
        await setDoc(docRef, updatedProfile, { merge: true });
        setProfile(updatedProfile);
    } catch (error) {
        console.error("Failed to save sponsor profile to Firestore", error);
    }

  }, [profile]);
  
  return { profile, updateProfile, isProfileLoaded };
}
