
'use client';

import { AppLayout } from "@/components/app-layout";
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { UpdatedDashboard } from '@/components/updated-dashboard';
import { Skeleton } from "@/components/ui/skeleton";

export default function IndividualDashboardPage() {
  const { profile, isProfileLoaded } = useSponsorProfile();

  if (!isProfileLoaded) {
    return (
      <AppLayout>
        <div className="space-y-8">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-4 w-3/4 mt-2" />
            </div>
            <Skeleton className="h-96 w-full" />
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
