
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
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // This effect loads from localStorage and runs whenever updateTrigger changes
  useEffect(() => {
    try {
      const storedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (storedDb) {
        _setDatabase(JSON.parse(storedDb));
      } else {
        // If nothing is in storage, use initial data and save it.
        const initialData = initialMasterPlayerData;
        _setDatabase(initialData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialData));
      }
    } catch (e) {
      console.error("Failed to load master DB from localStorage", e);
      _setDatabase(initialMasterPlayerData);
    } finally {
        setIsDbLoaded(true);
    }
  }, [updateTrigger]);

  // This effect sets up listeners for cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) {
        // Trigger a re-load from storage when another tab changes the data
        setUpdateTrigger(c => c + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // This function is exposed to update the database
  const setDatabase = useCallback((players: MasterPlayer[]) => {
    try {
        const newDbString = JSON.stringify(players);
        localStorage.setItem(DB_STORAGE_KEY, newDbString);
        // This triggers the useEffect to re-load the data in the current tab/app instance
        setUpdateTrigger(c => c + 1);
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
