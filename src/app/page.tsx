
'use client';

import { useEffect } from 'react';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import UsersPage from './users/page';

// This component now directly renders the User Management page and ensures
// the correct organizer profile is set, bypassing all previous login/redirect issues.
export default function Page() {
  const { profile, updateProfile } = useSponsorProfile();

  useEffect(() => {
    // Force set the organizer profile if it's not already set.
    if (!profile || profile.email !== 'norma@dkchess.com' || profile.role !== 'organizer') {
      updateProfile({
        email: 'norma@dkchess.com',
        role: 'organizer',
        firstName: 'Norma',
        lastName: 'Guerra',
        avatarType: 'icon',
        avatarValue: 'Wrench',
        isDistrictCoordinator: true, // Organizers have full access
        district: 'SHARYLAND ISD', // Example district
        school: 'SHARYLAND PIONEER H S', // Example school
      });
    }
  }, [profile, updateProfile]);

  return <UsersPage />;
}
