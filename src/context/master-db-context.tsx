
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { initialMasterPlayerData, type MasterPlayer as MasterPlayerType } from '@/lib/data/master-player-data';

export type MasterPlayer = MasterPlayerType;

interface MasterDbContextType {
  database: MasterPlayer[];
  setDatabase: (players: MasterPlayer[]) => void;
  isDbLoaded: boolean;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_STORAGE_KEY = 'master_player_database';

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, _setDatabase] = useState<MasterPlayer[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  const loadFromStorage = useCallback(() => {
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

  // Initial load
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);
  
  // Listen for changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) {
        loadFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadFromStorage]);


  const setDatabase = useCallback((players: MasterPlayer[]) => {
    try {
        _setDatabase(players);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(players));
    } catch (e) {
        console.error("Failed to save master DB to localStorage", e);
    }
  }, []);
  
  return (
    <MasterDbContext.Provider value={{ database, setDatabase, isDbLoaded: isStorageLoaded }}>
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
