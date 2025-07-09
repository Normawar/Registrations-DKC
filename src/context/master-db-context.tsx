
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
  uscfExpiration?: string; 
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
  setDatabase: (players: MasterPlayer[], onProgress?: (saved: number, total: number) => void) => Promise<void>;
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
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

  const setDatabase = useCallback(async (newPlayers: MasterPlayer[], onProgress?: (saved: number, total: number) => void) => {
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
                onProgress(playersWritten, totalPlayers);
            }
        } catch(e) {
            console.error("Failed to write chunk to IndexedDB", e);
            if (!tx.aborted) tx.abort();
            throw e; 
        }
    }
    flushSync(() => {
      setDatabaseState(newPlayers);
      setIsDbLoaded(true);
    });
  }, []);

  const addPlayer = useCallback(async (player: MasterPlayer) => {
    const db = await getDb();
    await db.add(STORE_NAME, player);
    setDatabaseState(prev => [...prev, player]);
  }, []);

  const updatePlayer = useCallback(async (player: MasterPlayer) => {
    const db = await getDb();
    await db.put(STORE_NAME, player);
    setDatabaseState(prev => prev.map(p => p.id === player.id ? player : p));
  }, []);

  const deletePlayer = useCallback(async (playerId: string) => {
    const db = await getDb();
    await db.delete(STORE_NAME, playerId);
    setDatabaseState(prev => prev.filter(p => p.id !== playerId));
  }, []);

  const dbPlayerCount = database.length;

  return (
    <MasterDbContext.Provider value={{ database, setDatabase, addPlayer, updatePlayer, deletePlayer, isDbLoaded, dbPlayerCount }}>
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
