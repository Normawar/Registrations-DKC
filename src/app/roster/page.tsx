'use client';
import dynamic from 'next/dynamic';

const RosterPageClient = dynamic(
  () => import('./RosterPageClient'),
  { 
    ssr: false,
    loading: () => <div>Loading roster...</div>
  }
);

export default function RosterPage() {
  return <RosterPageClient />;
}