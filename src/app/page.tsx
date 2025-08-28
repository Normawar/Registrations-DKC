
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSponsorProfile, type SponsorProfile } from '@/hooks/use-sponsor-profile';

export default function Page() {
  const router = useRouter();
  const { updateProfile } = useSponsorProfile();

  useEffect(() => {
    // Define the organizer profile for norma@dkchess.com
    const organizerProfile: SponsorProfile = {
      email: 'norma@dkchess.com',
      role: 'organizer',
      firstName: 'Norma',
      lastName: 'Guerra',
      phone: '555-123-4567',
      district: '',
      school: '',
      avatarType: 'icon',
      avatarValue: 'Wrench',
    };

    // Set the profile to be an organizer
    updateProfile(organizerProfile);

    // Redirect to the organizer dashboard
    router.replace('/manage-events');
  }, [router, updateProfile]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <p>Redirecting to Organizer Dashboard...</p>
    </div>
  );
}
