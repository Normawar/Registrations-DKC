'use client';

import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { UpdatedDashboard } from '@/components/updated-dashboard';
import { AppLayout } from '@/components/app-layout';

export default function IndividualDashboardPage() {
  const { profile, isProfileLoaded } = useSponsorProfile();

  if (!isProfileLoaded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading Dashboard...</h2>
            <p className="text-muted-foreground">Please wait while we load your information.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">
              Please make sure you are logged in and have completed your profile setup.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <UpdatedDashboard profile={profile} />
    </AppLayout>
  );
}
