'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  // Redirect to the organizer dashboard.
  useEffect(() => {
    router.replace('/manage-events');
  }, [router]);

  // We render a simple loading state while redirecting.
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <p>Redirecting to Organizer Dashboard...</p>
    </div>
  );
}
