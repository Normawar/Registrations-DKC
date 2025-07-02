
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { openDB, type IDBPDatabase } from 'idb';
import { initialMasterPlayerData } from '@/lib/data/master-player-data';
import { flushSync } from 'react-dom';

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
  setDatabase: (players: MasterPlayer[], onProgress?: (progress: number) => void) => Promise<void>;
  isDbLoaded: boolean;
  dbPlayerCount: number;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_NAME = 'ChessMatePlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'players';

async function getDb(): Promise<IDBPDatabase> {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('uscfId', 'uscfId', { unique: true });
        },
    });
}

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabaseState] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // This effect runs once on mount to load data from IndexedDB
  useEffect(() => {
    async function loadDataFromDb() {
      const db = await getDb();
      let players = await db.getAll(STORE_NAME);

      if (players.length === 0) {
        console.log("No players in DB, populating with initial data...");
        const tx = db.transaction(STORE_NAME, 'readwrite');
        try {
            for (const player of initialMasterPlayerData) {
                await tx.store.add(player);
            }
            await tx.done;
            players = initialMasterPlayerData;
        } catch (error) {
            console.error("Error populating initial data", error);
            if (!tx.aborted) {
                tx.abort();
            }
        }
      }
      
      setDatabaseState(players);
      setIsDbLoaded(true);
    }
    loadDataFromDb();
  }, []);

  // This is the function that components will call to update the database
  const setDatabase = useCallback(async (newPlayers: MasterPlayer[], onProgress?: (progress: number) => void) => {
    const db = await getDb();
    
    const clearTx = db.transaction(STORE_NAME, 'readwrite');
    await clearTx.store.clear();
    await clearTx.done;
    
    const totalPlayers = newPlayers.length;
    const CHUNK_SIZE = 5000;
    let playersWritten = 0;

    for (let i = 0; i < totalPlayers; i += CHUNK_SIZE) {
        const chunk = newPlayers.slice(i, i + CHUNK_SIZE);
        const tx = db.transaction(STORE_NAME, 'readwrite');
        
        try {
            const addPromises = chunk.map(player => tx.store.add(player));
            await Promise.all(addPromises);
            await tx.done;
            
            playersWritten += chunk.length;
            if (onProgress) {
                const progress = Math.round((playersWritten / totalPlayers) * 100);
                onProgress(progress);
            }
        } catch(e) {
            console.error("Failed to write chunk to IndexedDB", e);
            if (!tx.aborted) tx.abort();
            throw e; 
        }
    }

    // Force React to synchronously update the state before continuing.
    // This is crucial to prevent race conditions where other pages might
    // load with stale data after a large import.
    flushSync(() => {
      setDatabaseState(newPlayers);
      setIsDbLoaded(true);
    });
  }, []);

  const dbPlayerCount = database.length;

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
