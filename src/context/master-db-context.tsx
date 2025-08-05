
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => void;
  updatePlayer: (player: MasterPlayer) => void;
  deletePlayer: (playerId: string) => void;
  isDbLoaded: boolean;
  dbPlayerCount: number;
  dbStates: string[];
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    // In a real app, this would be fetched from a database.
    // For this prototype, we'll use the imported data directly.
    setDatabase(fullMasterPlayerData);
    setIsDbLoaded(true);
  }, []);
  
  const addPlayer = (player: MasterPlayer) => {
    // This is a mock implementation for the prototype.
    // In a real app, this would send a request to a server.
    const newPlayer = { ...player, id: player.id || `p-${Date.now()}` };
    const newDb = [...database, newPlayer];
    setDatabase(newDb);
    // In a real app, you might save this back to localStorage or a server.
  };

  const updatePlayer = (updatedPlayer: MasterPlayer) => {
    const newDb = database.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    setDatabase(newDb);
  };
  
  const deletePlayer = (playerId: string) => {
    const newDb = database.filter(p => p.id !== playerId);
    setDatabase(newDb);
  }

  const dbStates = useMemo(() => {
    if (!isDbLoaded) return ['ALL', 'NO_STATE', 'TX'];
    const usStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    const allUniqueStatesFromDb = new Set(database.map(p => p.state).filter(Boolean) as string[]);
    
    // Prioritize US states, sorted alphabetically
    const usStatesInDb = usStates.filter(s => allUniqueStatesFromDb.has(s));
    // Get non-US regions, also sorted
    const nonUsRegionsInDb = [...allUniqueStatesFromDb].filter(s => !usStates.includes(s)).sort();
    
    const sortedUsStates = usStatesInDb.filter(s => s !== 'TX').sort();

    return ['ALL', 'NO_STATE', 'TX', ...sortedUsStates, ...nonUsRegionsInDb];
  }, [database, isDbLoaded]);

  const value = {
    database,
    addPlayer,
    updatePlayer,
    deletePlayer,
    isDbLoaded,
    dbPlayerCount: database.length,
    dbStates,
  };

  return (
    <MasterDbContext.Provider value={value}>
      {children}
    </MasterDbContext.Provider>
  );
};

export const useMasterDb = () => {
  const context = useContext(MasterDbContext);
  if (context === undefined) {
    throw new Error('useMasterDb must be used within a MasterDbProvider');
  }
  return context;
};
