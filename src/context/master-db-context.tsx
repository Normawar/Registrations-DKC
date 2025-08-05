
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import type { MasterPlayer } from '@/lib/data/master-player-data';
import alasql from 'alasql';

interface MasterDbContextType {
  database: MasterPlayer[];
  getPlayersByFilter: (filters: { firstName?: string; lastName?: string; uscfId?: string, state?: string }) => Promise<MasterPlayer[]>;
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer) => Promise<void>;
  isDbLoaded: boolean;
  dbPlayerCount: number;
  setDatabase: (players: MasterPlayer[], progressCallback?: (saved: number, total: number) => void) => Promise<void>;
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabaseState] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const dbInitialized = useRef(false);
  const workerRef = useRef<Worker>();

  const initializeDatabase = useCallback(async () => {
    if (dbInitialized.current) return;
    dbInitialized.current = true;

    try {
      // Connect to AlaSQL IndexedDB database
      await alasql.promise(`
        CREATE INDEXEDDB DATABASE IF NOT EXISTS chessmate_db;
        ATTACH INDEXEDDB DATABASE chessmate_db;
        USE chessmate_db;
        CREATE TABLE IF NOT EXISTS players (
          id STRING, uscfId STRING, firstName STRING, lastName STRING, middleName STRING, 
          state STRING, uscfExpiration STRING, regularRating INT, quickRating STRING, 
          school STRING, district STRING, events INT, eventIds JSON,
          grade STRING, section STRING, email STRING, phone STRING, dob STRING, zipCode STRING, studentType STRING
        );
      `);

      const playerCount = await alasql.promise('SELECT VALUE COUNT(*) FROM players');
      
      if (playerCount === 0) {
        // Use a worker to fetch and parse the large data file without blocking the UI
        if (workerRef.current) {
            console.log('Fetching initial player data...');
            const response = await fetch('/all-tx-players-with-id-and-school.txt');
            if (!response.ok) {
              throw new Error('Failed to fetch master player data file.');
            }
            const blob = await response.blob();
            const file = new File([blob], 'all-tx-players-with-id-and-school.txt', { type: 'text/plain' });
            workerRef.current.postMessage({ file, existingPlayers: [] });
        }
      } else {
        const storedPlayers = await alasql.promise('SELECT * FROM players');
        setDatabaseState(storedPlayers);
        setIsDbLoaded(true);
      }
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }, []);
  
  const setDatabase = useCallback(async (players: MasterPlayer[], progressCallback?: (saved: number, total: number) => void) => {
    if (!dbInitialized.current) {
        await initializeDatabase();
    }
    await alasql.promise('DELETE FROM players');
    
    const chunkSize = 1000;
    const totalPlayers = players.length;
    for (let i = 0; i < totalPlayers; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);
        await alasql.promise('INSERT INTO players FROM ?', [chunk]);
        if (progressCallback) {
            progressCallback(Math.min(i + chunkSize, totalPlayers), totalPlayers);
        }
    }
    
    const allPlayers = await alasql.promise('SELECT * FROM players');
    setDatabaseState(allPlayers);
    setIsDbLoaded(true);
  }, [initializeDatabase]);

  useEffect(() => {
    // Initialize the worker.
    workerRef.current = new Worker(new URL('@/workers/importer-worker.ts', import.meta.url), {
      type: 'module'
    });

    // Handle messages from the worker.
    workerRef.current.onmessage = (event) => {
        const { players, error } = event.data;
        if (error) {
            console.error("Worker Error:", error);
        } else if (players) {
            setDatabase(players, (saved, total) => {
                console.log(`Saving to local DB: ${saved} of ${total}`);
            }).then(() => {
                console.log('Initial database import complete.');
            });
        }
    };

    // Initialize the database.
    initializeDatabase();

    // Cleanup worker on component unmount.
    return () => { 
        workerRef.current?.terminate();
    };
  }, [initializeDatabase, setDatabase]);


  const getPlayersByFilter = useCallback(async (filters: { firstName?: string; lastName?: string; uscfId?: string, state?:string }) => {
    if (!isDbLoaded) return [];
    
    let query = 'SELECT * FROM players WHERE 1=1';
    const params: (string|undefined)[] = [];
    
    if(filters.state && filters.state !== 'ALL') {
      if(filters.state === 'NO_STATE') {
        query += ' AND state IS NULL';
      } else {
        query += ' AND state = ?';
        params.push(filters.state);
      }
    }

    if (filters.firstName) {
      query += ` AND LOWER(firstName) LIKE ?`;
      params.push(`${filters.firstName.toLowerCase()}%`);
    }
    if (filters.lastName) {
      query += ` AND LOWER(lastName) LIKE ?`;
      params.push(`${filters.lastName.toLowerCase()}%`);
    }
    if (filters.uscfId) {
      query += ` AND uscfId LIKE ?`;
      params.push(`${filters.uscfId}%`);
    }
    
    return alasql(query, params) as MasterPlayer[];
  }, [isDbLoaded]);

  const addPlayer = useCallback(async (player: MasterPlayer) => {
    if (!isDbLoaded) return;
    await alasql.promise('INSERT INTO players VALUES ?', [[player]]);
    setDatabaseState(prev => [...prev, player]);
  }, [isDbLoaded]);

  const updatePlayer = useCallback(async (player: MasterPlayer) => {
    if (!isDbLoaded) return;
    
    const fieldsToUpdate = Object.keys(player).filter(k => k !== 'id');
    const setClause = fieldsToUpdate.map(key => `${key} = ?`).join(', ');
    const params = fieldsToUpdate.map(key => player[key as keyof MasterPlayer]);
    
    await alasql.promise(`UPDATE players SET ${setClause} WHERE id = ?`, [...params, player.id]);
    
    setDatabaseState(prev => prev.map(p => p.id === player.id ? player : p));
  }, [isDbLoaded]);

  const value = {
    database,
    getPlayersByFilter,
    addPlayer,
    updatePlayer,
    isDbLoaded,
    dbPlayerCount: database.length,
    setDatabase
  };

  return (
    <MasterDbContext.Provider value={value}>
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
