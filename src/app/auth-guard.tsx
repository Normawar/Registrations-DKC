// src/components/auth-guard.tsx - Route protection component
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'sponsor' | 'organizer' | 'individual' | 'district_coordinator';
  redirectTo?: string;
}

export function AuthGuard({ children, requiredRole, redirectTo = '/' }: AuthGuardProps) {
  const { profile, loading } = useSponsorProfile();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Wait until loading is complete
    }

    if (!profile) {
      // User is not authenticated, redirect to login
      router.push(redirectTo);
      return;
    }
    
    // Check if profile completion is required
    if (profile.forceProfileUpdate && pathname !== '/profile') {
      router.push('/profile');
      return;
    }

    // New: Handle multi-role users first
    if (profile.role === 'sponsor' && profile.isDistrictCoordinator) {
        // If the user has both roles but isn't on the selection page, send them there.
        if (pathname !== '/auth/role-selection') {
            router.push('/auth/role-selection');
            return;
        }
    }
    
    if (requiredRole) {
      // Check if user has the required role. Organizers have access to all roles.
      const hasRequiredRole = 
        profile.role === 'organizer' ||
        profile.role === requiredRole;


      if (!hasRequiredRole) {
        // User doesn't have required role, redirect to their primary dashboard
        switch (profile.role) {
          case 'organizer':
            router.push('/manage-events');
            break;
          case 'district_coordinator':
             router.push('/district-dashboard');
            break;
          case 'sponsor':
              router.push('/dashboard');
            break;
          case 'individual':
            router.push('/individual-dashboard');
            break;
          default:
            router.push('/');
        }
        return;
      }
    }
  }, [profile, loading, requiredRole, router, redirectTo, pathname]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }
  
  // This check is now simplified
  const hasRequiredRoleCheck = !requiredRole || (profile && (
    profile.role === 'organizer' ||
    profile.role === requiredRole
  ));

  // Don't render children if user is not authenticated or doesn't have the role yet
  if (!profile || !hasRequiredRoleCheck || profile.forceProfileUpdate) {
    return null;
  }

  // If we reach here, user is authenticated and has required role
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
