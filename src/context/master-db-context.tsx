
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { openDB, type IDBPDatabase } from 'idb';
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
  setDatabase: (players: MasterPlayer[]) => Promise<void>;
  isDbLoaded: boolean;
  dbPlayerCount: number;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_NAME = 'ChessMateDB';
const DB_VERSION = 1;
const STORE_NAME = 'players';

async function getDb(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('uscfId', 'uscfId', { unique: true });
            }
        },
    });
}

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setInternalDatabase] = useState<MasterPlayer[]>([]);
  const [dbPlayerCount, setDbPlayerCount] = useState(0);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const loadInitialData = useCallback(async () => {
    setIsDbLoaded(false);
    const db = await getDb();
    const count = await db.count(STORE_NAME);
    setDbPlayerCount(count);

    if (count === 0) {
        console.log("No players in DB, populating with initial data...");
        const tx = db.transaction(STORE_NAME, 'readwrite');
        try {
            await Promise.all(initialMasterPlayerData.map(player => tx.store.add(player)));
            await tx.done;
            setInternalDatabase(initialMasterPlayerData);
            setDbPlayerCount(initialMasterPlayerData.length);
        } catch (error) {
            console.error("Error populating initial data", error);
            tx.abort();
        }
    } else {
        const allPlayers = await db.getAll(STORE_NAME);
        setInternalDatabase(allPlayers);
    }
    setIsDbLoaded(true);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const setDatabase = useCallback(async (players: MasterPlayer[]) => {
    console.log(`Updating IndexedDB with ${players.length} players...`);
    const db = await getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    
    try {
        await tx.store.clear();
        await Promise.all(players.map(player => tx.store.add(player)));
        await tx.done;
        
        console.log("IndexedDB update complete.");
        setInternalDatabase(players);
        setDbPlayerCount(players.length);
    } catch(error) {
        console.error("Failed to update database:", error);
        tx.abort();
        throw error;
    }
  }, []);

  return (
    <MasterDbContext.Provider value={{ database, setDatabase, isDbLoaded, dbPlayerCount }}>
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
