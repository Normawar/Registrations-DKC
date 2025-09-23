
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { User } from 'firebase/auth';
import { AuthService } from '@/lib/auth';
import { useMasterDb } from '@/context/master-db-context';

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
  uid: string; // UID is now required
  forceProfileUpdate?: boolean; // Flag to force profile completion
  createdAt?: string;
  updatedAt?: string;
  migratedAt?: string;
  studentIds?: string[]; // For individual users to track their students
};

// This hook now manages the auth user and their profile data together
export function useSponsorProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDbLoaded } = useMasterDb(); // Depend on the master DB context

  // Listen for auth state changes to keep user and profile in sync
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (authUser, userProfile) => {
        // We need both the authenticated user and the master database to be ready
        if (authUser && userProfile && isDbLoaded) {
            setUser(authUser);
            setProfile(userProfile);
            setLoading(false);
        } else if (!authUser) {
            // If there's no user, we are not loading a profile.
            setUser(null);
            setProfile(null);
            setLoading(false);
        }
        // If authUser exists but isDbLoaded is false, we keep loading=true
        // and wait for the isDbLoaded dependency in the next useEffect to trigger the final state.
    });
    return () => unsubscribe();
  }, [isDbLoaded]); // Add isDbLoaded as a dependency


  const updateProfile = useCallback(async (newProfileData: Partial<SponsorProfile> | null, authUser?: User | null) => {
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
      // Also clear from local storage
      localStorage.removeItem(`user_profile_${userToUpdate.uid}`);
      return;
    }

    // Merge new data with existing profile
    const updatedProfile = { ...(profile || {}), ...newProfileData, email: userToUpdate.email, uid: userToUpdate.uid } as SponsorProfile;

    try {
        // Update Firestore
        const docRef = doc(db, "users", userToUpdate.uid);
        await setDoc(docRef, updatedProfile, { merge: true });
        
        // Update local state and localStorage
        setProfile(updatedProfile);
        localStorage.setItem(`user_profile_${userToUpdate.uid}`, JSON.stringify(updatedProfile));

    } catch (error) {
        console.error("Failed to save sponsor profile to Firestore", error);
    }

  }, [profile, user]);
  
  return { user, profile, updateProfile, isProfileLoaded: !loading, loading };
}
