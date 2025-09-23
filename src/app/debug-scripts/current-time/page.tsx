'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OrganizerGuard } from '@/components/auth-guard';

function CurrentTimePage() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set the initial time as soon as the component mounts on the client
    setCurrentTime(new Date());

    // Set up an interval to update the time every second
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(timerId);
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount

  const formatTime = (date: Date | null, options: Intl.DateTimeFormatOptions) => {
    if (!date) {
      return 'Loading...';
    }
    return new Intl.DateTimeFormat('en-US', options).format(date);
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Current System Time</CardTitle>
            <CardDescription>
              This page displays the current time from your browser, updated every second.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-5xl font-bold font-mono">
                {formatTime(currentTime, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
              <p className="text-lg text-muted-foreground">
                {formatTime(currentTime, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold">Full Timestamps</h4>
              <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded-md mt-2">
                <p><strong>ISO String (UTC):</strong> {currentTime?.toISOString() || '...'}</p>
                <p><strong>Local String:</strong> {currentTime?.toString() || '...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GuardedCurrentTimePage() {
  return (
    <OrganizerGuard>
      <CurrentTimePage />
    </OrganizerGuard>
  );
}
