
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { initialMasterPlayerData } from '@/lib/data/master-player-data';

// Define a consistent player type to be used everywhere
export type MasterPlayer = {
  id: string;
  uscfId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  state?: string;
  // Dates should be stored as ISO strings for JSON compatibility
  expirationDate?: string; 
  regularRating?: number;
  quickRating?: string;
  school: string;
  district: string;
  events: number;
  eventIds: string[];
  // Roster-specific fields
  grade?: string;
  section?: string;
  email?: string;
  phone?: string;
  dob?: string; // ISO String
  zipCode?: string;
  studentType?: 'gt' | 'independent';
};


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

  // Load data on initial mount
  useEffect(() => {
    try {
      const storedDb = localStorage.getItem(DB_STORAGE_KEY);
      if (storedDb) {
        setInternalDatabase(JSON.parse(storedDb));
      } else {
        const initialData = initialMasterPlayerData;
        setInternalDatabase(initialData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(initialData));
      }
    } catch (e) {
      console.error("Failed to load master DB from localStorage", e);
      setInternalDatabase(initialMasterPlayerData); // Fallback to default
    } finally {
      setIsDbLoaded(true);
    }
  }, []);

  // Centralized function to update the database state and localStorage
  const setDatabase = useCallback((players: MasterPlayer[]) => {
    try {
      // Update state immediately. This triggers re-renders in consumers.
      setInternalDatabase(players);
      // Persist the changes to localStorage.
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
