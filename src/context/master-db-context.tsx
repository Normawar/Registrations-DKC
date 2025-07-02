
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
  const [database, setInternalDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Function to load data from localStorage
  const loadDataFromStorage = useCallback(() => {
    try {
      const storedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (storedDb) {
        setInternalDatabase(JSON.parse(storedDb));
      } else {
        // If nothing is in storage, initialize with default data
        setInternalDatabase(initialMasterPlayerData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialMasterPlayerData));
      }
    } catch (e) {
      console.error("Failed to load master DB from localStorage", e);
      setInternalDatabase(initialMasterPlayerData); // Fallback to default
    } finally {
      setIsDbLoaded(true);
    }
  }, []);

  // Initial load and listener for cross-tab updates
  useEffect(() => {
    loadDataFromStorage();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) {
        loadDataFromStorage();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadDataFromStorage]); // Dependency on the memoized load function

  // The function to be used by components to update the database
  const setDatabase = useCallback((players: MasterPlayer[]) => {
    try {
      // Update local state immediately
      setInternalDatabase(players);
      // Update localStorage
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(players));
    } catch (e) {
      console.error("Failed to save master DB to localStorage", e);
    }
  }, []);

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
