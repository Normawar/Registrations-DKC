
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => void;
  updatePlayer: (player: MasterPlayer) => void;
  deletePlayer: (playerId: string) => void;
  addBulkPlayers: (players: MasterPlayer[]) => void;
  isDbLoaded: boolean;
  dbPlayerCount: number;
  dbStates: string[];
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    // Directly use the imported data. This avoids all file fetching and database initialization issues.
    setDatabase(fullMasterPlayerData);
    setIsDbLoaded(true);
  }, []);
  
  const addPlayer = (player: MasterPlayer) => {
    const newPlayer = { ...player, id: player.id || `p-${Date.now()}` };
    const newDb = [...database, newPlayer];
    setDatabase(newDb);
  };

  const addBulkPlayers = (players: MasterPlayer[]) => {
    const playerMap = new Map(database.map(p => [p.uscfId, p]));
    players.forEach(p => {
        // Ensure new players have a unique ID if not provided
        const id = p.id || p.uscfId || `p-${Date.now()}-${Math.random()}`;
        playerMap.set(p.uscfId, { ...playerMap.get(p.uscfId), ...p, id });
    });
    setDatabase(Array.from(playerMap.values()));
  }

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
    
    const usStatesInDb = usStates.filter(s => allUniqueStatesFromDb.has(s));
    const nonUsRegionsInDb = [...allUniqueStatesFromDb].filter(s => !usStates.includes(s)).sort();
    
    const sortedUsStates = usStatesInDb.filter(s => s !== 'TX').sort();

    return ['ALL', 'NO_STATE', 'TX', ...sortedUsStates, ...nonUsRegionsInDb];
  }, [database, isDbLoaded]);

  const value = {
    database,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addBulkPlayers,
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
