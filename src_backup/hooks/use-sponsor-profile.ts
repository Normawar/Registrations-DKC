'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { AuthService } from '@/lib/auth';

export type SponsorProfile = {
  firstName: string;
  lastName: string;
  email: string;
  school: string;
  district: string;
  zip: string;
  phone?: string;
  gtCoordinatorEmail?: string;
  bookkeeperEmail?: string;
  avatarType: 'icon' | 'upload';
  avatarValue: string;
  role: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
  isDistrictCoordinator?: boolean;
  uid: string;
  forceProfileUpdate?: boolean;
  createdAt?: string;
  updatedAt?: string;
  migratedAt?: string;
  studentIds?: string[];
};

export function useSponsorProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (authUser, userProfile) => {
      if (!authUser) {
        // No user - clear everything and stop loading
        setUser(null);
        setProfile(null);
        setLoading(false);
        isFirstLoad.current = false;
        return;
      }

      // User exists
      setUser(authUser);
      
      if (userProfile) {
        // Profile loaded successfully
        setProfile(userProfile);
        setLoading(false);
        isFirstLoad.current = false;
      } else if (isFirstLoad.current) {
        // First load and no profile - keep loading true
        // The user might have just signed up and needs to create profile
        setProfile(null);
        // Keep loading true to prevent flash
      } else {
        // Subsequent loads with no profile - user needs to create one
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateProfile = useCallback(async (
    newProfileData: Partial<SponsorProfile> | null,
    authUser?: User | null
  ) => {
    const userToUpdate = authUser || user;
    
    if (!userToUpdate) {
      console.error("Cannot update profile: no user logged in.");
      return;
    }

    if (!db) {
      console.error("Firestore is not initialized. Cannot update profile.");
      return;
    }

    if (newProfileData === null) {
      setProfile(null);
      localStorage.removeItem(`user_profile_${userToUpdate.uid}`);
      return;
    }

    const updatedProfile = {
      ...(profile || {}),
      ...newProfileData,
      email: userToUpdate.email,
      uid: userToUpdate.uid,
    } as SponsorProfile;

    try {
      const docRef = doc(db, "users", userToUpdate.uid);
      await setDoc(docRef, updatedProfile, { merge: true });
      
      setProfile(updatedProfile);
      localStorage.setItem(
        `user_profile_${userToUpdate.uid}`,
        JSON.stringify(updatedProfile)
      );
      
      // Now that profile is set, we're no longer in first load
      isFirstLoad.current = false;
    } catch (error) {
      console.error("Failed to save sponsor profile to Firestore", error);
      throw error;
    }
  }, [profile, user]);
  
  const value = useMemo(() => ({
    user,
    profile,
    updateProfile,
    isProfileLoaded: !loading,
    loading
  }), [user, profile, updateProfile, loading]);

  return value;
}