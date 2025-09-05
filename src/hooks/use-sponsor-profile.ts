
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

// This hook now manages the auth user and their profile data together
export function useSponsorProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SponsorProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const fetchProfile = useCallback(async (uid: string) => {
    if (!db) {
      console.error("Firestore is not initialized.");
      setIsProfileLoaded(true);
      return;
    }
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      setProfile(docSnap.data() as SponsorProfile);
    } else {
      console.log("No such profile!");
      setProfile(null);
    }
    setIsProfileLoaded(true);
  }, []);

  // Listen for auth state changes to keep user and profile in sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUser(authUser);
        fetchProfile(authUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setIsProfileLoaded(true);
      }
    });

    return () => unsubscribe();
  }, [fetchProfile]);


  const updateProfile = useCallback(async (newProfileData: Partial<SponsorProfile> | null) => {
    if (!user) {
        console.error("Cannot update profile: no user logged in.");
        return;
    }
    if (!db) {
        console.error("Firestore is not initialized. Cannot update profile.");
        return;
    }

    if (newProfileData === null) {
      // This is now handled by signOut, but we keep it for safety
      setProfile(null);
      return;
    }

    const updatedProfile = { ...(profile || {}), ...newProfileData, email: user.email } as SponsorProfile;

    try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, updatedProfile, { merge: true });
        setProfile(updatedProfile);
    } catch (error) {
        console.error("Failed to save sponsor profile to Firestore", error);
    }

  }, [profile, user]);
  
  return { user, profile, updateProfile, isProfileLoaded };
}
