
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { initialMasterPlayerData, type MasterPlayer as MasterPlayerType } from '@/lib/data/master-player-data';

export type MasterPlayer = MasterPlayerType;

interface MasterDbContextType {
  database: MasterPlayer[];
  setDatabase: (players: MasterPlayer[]) => void;
  isDbLoaded: boolean;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_STORAGE_KEY = 'master_player_database';
const DB_UPDATE_EVENT = 'masterDbUpdated';

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setInternalDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    const loadData = () => {
      try {
        const storedDb = localStorage.getItem(DB_STORAGE_KEY);
        if (storedDb) {
          setInternalDatabase(JSON.parse(storedDb));
        } else {
          setInternalDatabase(initialMasterPlayerData);
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialMasterPlayerData));
        }
      } catch (e) {
        console.error("Failed to load master DB from localStorage", e);
        setInternalDatabase(initialMasterPlayerData);
      } finally {
        setIsDbLoaded(true);
      }
    };

    loadData(); // Initial load

    // Listen for changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) {
        loadData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for changes from the same tab
    const handleDbUpdate = () => loadData();
    window.addEventListener(DB_UPDATE_EVENT, handleDbUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(DB_UPDATE_EVENT, handleDbUpdate);
    };
  }, []);

  const setDatabase = (players: MasterPlayer[]) => {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(players));
      // Dispatch event to notify all components (including in the same tab)
      window.dispatchEvent(new CustomEvent(DB_UPDATE_EVENT));
    } catch (e) {
      console.error("Failed to save master DB to localStorage", e);
    }
  };

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
