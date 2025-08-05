'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';

interface MasterDbContextType {
  database: MasterPlayer[];
  getPlayersByFilter: (filters: { firstName?: string; lastName?: string; uscfId?: string, state?: string }) => Promise<MasterPlayer[]>;
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer) => Promise<void>;
  isDbLoaded: boolean;
  dbPlayerCount: number;
  setDatabase: (players: MasterPlayer[]) => Promise<void>;
  dbStates: string[];
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabaseState] = useState<MasterPlayer[]>(fullMasterPlayerData);
  const [isDbLoaded, setIsDbLoaded] = useState(true);

  const getPlayersByFilter = async (filters: { firstName?: string; lastName?: string; uscfId?: string, state?: string }): Promise<MasterPlayer[]> => {
    return database.filter(p => {
        const stateMatch = !filters.state || filters.state === 'ALL' || p.state === filters.state;
        const firstNameMatch = !filters.firstName || p.firstName?.toLowerCase().includes(filters.firstName.toLowerCase());
        const lastNameMatch = !filters.lastName || p.lastName?.toLowerCase().includes(filters.lastName.toLowerCase());
        const uscfIdMatch = !filters.uscfId || p.uscfId?.includes(filters.uscfId);
        return stateMatch && firstNameMatch && lastNameMatch && uscfIdMatch;
    });
  };

  const addPlayer = async (player: MasterPlayer) => {
    setDatabaseState(prev => [...prev, player]);
  };

  const updatePlayer = async (player: MasterPlayer) => {
    setDatabaseState(prev => prev.map(p => (p.id === player.id ? player : p)));
  };

  const setDatabase = async (players: MasterPlayer[]) => {
    setDatabaseState(players);
  };
  
  const dbStates = useMemo(() => {
    const usStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
    ];
    const allUniqueStatesFromDb = new Set(database.map(p => p.state).filter(Boolean) as string[]);
    const usStatesInDb = usStates.filter(s => allUniqueStatesFromDb.has(s));
    const nonUsRegionsInDb = [...allUniqueStatesFromDb].filter(s => !usStates.includes(s));
    
    const sortedUsStates = usStatesInDb.filter(s => s !== 'TX').sort();
    const sortedNonUsRegions = nonUsRegionsInDb.sort();
    
    const finalList = [
        'ALL',
        'TX',
        'NO_STATE', 
        ...sortedUsStates,
        ...sortedNonUsRegions
    ];
    
    return finalList;
  }, [database]);


  const value = {
    database,
    getPlayersByFilter,
    addPlayer,
    updatePlayer,
    isDbLoaded,
    dbPlayerCount: database.length,
    setDatabase,
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