
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

  // Effect for initial load and cross-tab sync
  useEffect(() => {
    const loadFromStorage = () => {
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
    };

    loadFromStorage(); // Initial load

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DB_STORAGE_KEY) {
        loadFromStorage(); // Reload on change from another tab
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
        // Update state directly for immediate reflection in the current tab
        _setDatabase(players); 
        
        // Update localStorage for persistence and cross-tab sync
        const newDbString = JSON.stringify(players);
        localStorage.setItem(DB_STORAGE_KEY, newDbString);
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
