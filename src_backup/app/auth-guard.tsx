// src/app/auth-guard.tsx
'use client';

import { useEffect, useState } from 'react';
import { getUserRole } from '@/lib/role-utils';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
  redirectTo?: string;
}

export function AuthGuard({ children, requiredRole, redirectTo = '/' }: AuthGuardProps) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) {
      return; // Wait for the auth state to be loaded
    }

    const performAuthCheck = async () => {
      if (!profile) {
        router.push(redirectTo);
        return;
      }

      // CRITICAL: Normalize role - handle both string and array formats
      const userRole = getUserRole(profile);

      // Force profile update check
      if (profile.forceProfileUpdate && pathname !== '/profile') {
        router.push('/profile');
        return;
      }

      // District coordinator role selection check
      if (
        profile.isDistrictCoordinator &&
        userRole !== 'organizer' &&
        userRole !== 'district_coordinator' &&
        pathname !== '/auth/role-selection'
      ) {
        router.push('/auth/role-selection');
        return;
      }

      // Required role check
      if (requiredRole) {
        const isOrganizer = userRole === 'organizer';
        const isRequired = userRole === requiredRole;
        const isCoordinatorAccessingSponsorPage = 
          userRole === 'district_coordinator' && requiredRole === 'sponsor';
        const hasRequiredRole = isOrganizer || isRequired || isCoordinatorAccessingSponsorPage;

        if (!hasRequiredRole) {
          const userDashboard = {
            organizer: '/manage-events',
            district_coordinator: '/district-dashboard',
            sponsor: '/dashboard',
            individual: '/individual-dashboard',
          }[userRole] || '/';
          
          router.push(userDashboard);
          return;
        }
      }

      // All checks passed
      setIsChecking(false);
    };

    performAuthCheck();
  }, [profile, loading, router, pathname, requiredRole, redirectTo]);

  if (loading || isChecking || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience components for specific roles
export function SponsorGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="sponsor" redirectTo="/">
      {children}
    </AuthGuard>
  );
}

export function OrganizerGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="organizer" redirectTo="/">
      {children}
    </AuthGuard>
  );
}

export function IndividualGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="individual" redirectTo="/">
      {children}
    </AuthGuard>
  );
}

export function DistrictCoordinatorGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="district_coordinator" redirectTo="/">
      {children}
    </AuthGuard>
  );
}