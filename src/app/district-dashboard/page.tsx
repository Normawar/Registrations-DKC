// src/app/district-dashboard/page.tsx
'use client';

import { DistrictCoordinatorGuard } from "@/components/auth-guard";

function DistrictDashboardContent() {
    console.log('DISTRICT DASHBOARD CONTENT LOADED');
    return <div>District Dashboard - With Auth Guard</div>;
}

export default function DistrictDashboardPage() {
    console.log('DISTRICT DASHBOARD PAGE WITH GUARD LOADED');
    return (
        <DistrictCoordinatorGuard>
            <DistrictDashboardContent />
        </DistrictCoordinatorGuard>
    );
}