import type { SponsorProfile } from '@/hooks/use-sponsor-profile';

export function normalizeRole(
  role: SponsorProfile['role'] | string[] | string | undefined
): 'sponsor' | 'organizer' | 'individual' | 'district_coordinator' | undefined {
  if (!role) return undefined;
  return Array.isArray(role) ? role[0] as any : role;
}

export function getUserRole(
  profile: SponsorProfile | null | undefined
): 'sponsor' | 'organizer' | 'individual' | 'district_coordinator' | undefined {
  if (!profile) return undefined;
  
  // Check for special flags first (take precedence over role field)
  if (profile.isOrganizer === true) {
    return 'organizer';
  }
  
  if (profile.isDistrictCoordinator === true) {
    return 'district_coordinator';
  }
  
  return normalizeRole(profile.role);
}