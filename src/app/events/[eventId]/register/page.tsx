'use client';

import { Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { useSponsorProfile } from '@/hooks/use-sponsor-profile';
import { useEvents } from '@/hooks/use-events';
import { AppLayout } from '@/components/app-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { SponsorRegistrationDialog } from '@/components/sponsor-registration-dialog';

function EventRegistrationPage() {
    return (
        <AppLayout>
            <Suspense fallback={<RegistrationSkeleton />}>
                <EventRegistrationContent />
            </Suspense>
        </AppLayout>
    );
}

function EventRegistrationContent() {
    const params = useParams();
    const { profile } = useSponsorProfile();
    const { events } = useEvents();
    
    const eventId = typeof params.eventId === 'string' ? params.eventId : null;
    const event = events.find(e => e.id === eventId);

    if (!profile || !event) {
        return <RegistrationSkeleton />;
    }
    
    // For now, we only have a sponsor registration flow here.
    // Individual registration is handled elsewhere.
    if (profile.role === 'sponsor' || profile.role === 'organizer') {
        return (
            <SponsorRegistrationDialog 
                isOpen={true} 
                onOpenChange={() => {}} 
                event={event} 
            />
        );
    }

    return <div>No registration component for your role.</div>;
}

function RegistrationSkeleton() {
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


export default EventRegistrationPage;
