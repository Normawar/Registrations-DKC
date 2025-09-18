
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { OrganizerRegistrationForm } from '@/components/organizer-registration-form';

function OrganizerRegistrationPage() {
    return (
        <AppLayout>
            <Suspense fallback={<OrganizerRegistrationSkeleton />}>
                <OrganizerRegistrationContent />
            </Suspense>
        </AppLayout>
    );
}

function OrganizerRegistrationContent() {
    const searchParams = useSearchParams();
    const eventId = searchParams.get('eventId');
    return <OrganizerRegistrationForm eventId={eventId} />;
}

function OrganizerRegistrationSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-4 w-3/4 mt-2" />
            </div>
            <div className="grid gap-8 md:grid-cols-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}


export default OrganizerRegistrationPage;

