
'use client';

import { createContext, useContext } from 'react';
import { useSponsorProfile, SponsorProfile } from '@/hooks/use-sponsor-profile';
import { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  profile: SponsorProfile | null;
  loading: boolean;
  isProfileLoaded: boolean;
  updateProfile: (newProfileData: Partial<SponsorProfile> | null, authUser?: User | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useSponsorProfile();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
