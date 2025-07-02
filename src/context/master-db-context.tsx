
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { initialMasterPlayerData, type ImportedPlayer as ImportedPlayerType } from '@/lib/data/master-player-data';

export type ImportedPlayer = ImportedPlayerType;

interface MasterDbContextType {
  database: ImportedPlayer[];
  setDatabase: (players: ImportedPlayer[]) => void;
  isDbLoaded: boolean;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_STORAGE_KEY = 'master_player_database';

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, _setDatabase] = useState<ImportedPlayer[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (storedDb) {
        _setDatabase(JSON.parse(storedDb));
      } else {
        _setDatabase(initialMasterPlayerData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialMasterPlayerData));
      }
    } catch (e) {
      console.error("Failed to load master DB from localStorage", e);
      _setDatabase(initialMasterPlayerData);
    } finally {
        setIsStorageLoaded(true);
    }
  }, []);

  const setDatabase = useCallback((players: ImportedPlayer[]) => {
    try {
        _setDatabase(players);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(players));
    } catch (e) {
        console.error("Failed to save master DB to localStorage", e);
    }
  }, []);
  
  const isDbLoaded = isStorageLoaded && database.length > 0;

  return (
    <MasterDbContext.Provider value={{ database, setDatabase, isDbLoaded }}>
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
