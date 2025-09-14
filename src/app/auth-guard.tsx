// src/components/auth-guard.tsx - Route protection component with fixed organizer logic
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
  console.log('AUTH GUARD CALLED WITH:', { requiredRole, pathname: pathname });


  useEffect(() => {
    // Add detailed logging for debugging
    console.log('🔍 AuthGuard Debug:', {
      loading,
      profile: profile ? {
        role: profile.role,
        isDistrictCoordinator: profile.isDistrictCoordinator,
        forceProfileUpdate: profile.forceProfileUpdate
      } : null,
      requiredRole,
      pathname
    });

    if (loading) {
      console.log('⏳ Still loading, waiting...');
      return; // Wait until loading is complete
    }

    // If no profile, user is not authenticated, redirect to login
    if (!profile) {
      console.log('❌ No profile, redirecting to:', redirectTo);
      router.push(redirectTo);
      return;
    }
    
    // PRIORITY 1: Handle forced profile update. This must happen before any other role-based logic.
    if (profile.forceProfileUpdate && pathname !== '/profile') {
      console.log('📝 Force profile update required, redirecting to /profile');
      router.push('/profile');
      return;
    }
    
    // PRIORITY 2: Handle multi-role for district coordinators
    // This logic sends a user to role selection ONLY if they are a coordinator
    // but their currently selected role is something else (e.g. 'sponsor').
    if (profile.isDistrictCoordinator && 
        profile.role !== 'organizer' && 
        profile.role !== 'district_coordinator' &&
        pathname !== '/auth/role-selection') {
      
      console.log('🔄 District coordinator with non-DC role, redirecting to role selection');
      router.push('/auth/role-selection');
      return;
    }

    // PRIORITY 3: Handle role-based access control for pages with specific requirements
    if (requiredRole) {
      const isOrganizer = profile.role === 'organizer';
      const isRequired = profile.role === requiredRole;
      const isCoordinatorAccessingSponsorPage = profile.role === 'district_coordinator' && requiredRole === 'sponsor';

      console.log('🛡️ Role check:', {
        isOrganizer,
        isRequired,
        isCoordinatorAccessingSponsorPage,
        userRole: profile.role,
        requiredRole
      });

      // An organizer can access any page.
      // A user can access a page if they have the required role.
      // A district coordinator can also access sponsor pages.
      const hasRequiredRole = isOrganizer || isRequired || isCoordinatorAccessingSponsorPage;
      
      if (!hasRequiredRole) {
        console.log('❌ Insufficient role, redirecting based on user role:', profile.role);
        // User doesn't have the required role, redirect to their primary dashboard
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
      } else {
        console.log('✅ Role check passed, allowing access');
      }
    } else {
      console.log('🔓 No role requirement, allowing access');
    }
  }, [profile, loading, requiredRole, router, redirectTo, pathname]);

  // Show loading state while checking authentication
  if (loading) {
    console.log('🔄 Rendering loading skeleton');
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
  
  // Prevent rendering children if a redirect is imminent.
  if (!profile || (profile.forceProfileUpdate && pathname !== '/profile')) {
    console.log('🚫 Preventing render due to missing profile or force update');
    return null;
  }

  console.log('✅ Rendering protected content');
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
