
// Updated src/app/players/page.tsx
'use client';

import React from 'react';
import { EnhancedPlayerSearchDialog } from '@/components/EnhancedPlayerSearchDialog';
import { useMasterDb } from '@/context/master-db-context';

export default function PlayersPage() {
  const { addPlayer } = useMasterDb();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelectPlayer = (player: any) => {
    // Logic to add or update player in the master database
    console.log("Selected player:", player);
    const isMasterPlayer = 'uscfId' in player;
    const playerToAdd: Partial<any> = isMasterPlayer ? 
      player : 
      {
        id: player.uscf_id,
        uscfId: player.uscf_id,
        firstName: player.name.split(' ')[0],
        lastName: player.name.split(' ').slice(1).join(' '),
        regularRating: player.rating_regular,
        state: player.state,
        uscfExpiration: player.expiration_date,
      };
    addPlayer(playerToAdd);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Player Database</h1>
          <p className="text-sm text-gray-600 mt-1">
            Search, manage, and register every player in the system.
          </p>
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            onClick={() => setIsOpen(true)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Players
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">All Players</h2>
          <p className="text-sm text-gray-600">The complete list of players. Use the search button for advanced filtering.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  School / District
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  USCF ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Events
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan={7}>
                  Player data will be displayed here when the database loads...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <EnhancedPlayerSearchDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onPlayerSelected={handleSelectPlayer}
        excludeIds={[]} // No exclusions for master database
        title="Search and Add Players"
      />
    </div>
  );
}
