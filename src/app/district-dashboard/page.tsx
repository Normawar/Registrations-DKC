'use client';

import { DistrictCoordinatorGuard } from "@/components/auth-guard";

export default function DistrictDashboardPage() {
    console.log('MINIMAL AUTH GUARD TEST');
    return (
        <DistrictCoordinatorGuard>
            <div>Minimal auth guard test</div>
        </DistrictCoordinatorGuard>
    );
}