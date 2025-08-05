
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef, useMemo } from 'react';
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
  dbStates: string[];
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

const DB_NAME = 'ChessMatePlayerDB_v4'; // Incremented version to force reset

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabaseState] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const dbInitialized = useRef(false);
  const workerRef = useRef<Worker>();

  const initializeDatabase = useCallback(async () => {
    if (dbInitialized.current) return;
    dbInitialized.current = true;

    try {
      await alasql.promise(`
        CREATE INDEXEDDB DATABASE IF NOT EXISTS ${DB_NAME};
        ATTACH INDEXEDDB DATABASE ${DB_NAME};
        USE ${DB_NAME};
      `);

      // Check if table exists, if not, create it
      const tables = await alasql.promise('SHOW TABLES');
      const playerTableExists = tables.some((t: any) => t.tableid === 'players');

      if (!playerTableExists) {
        await alasql.promise(`
          CREATE TABLE players (
            id STRING, uscfId STRING, firstName STRING, lastName STRING, middleName STRING, 
            state STRING, uscfExpiration STRING, regularRating INT, quickRating STRING, 
            school STRING, district STRING, events INT, eventIds JSON,
            grade STRING, section STRING, email STRING, phone STRING, dob STRING, zipCode STRING, studentType STRING
          );
        `);
      }
      
      const playerCount = await alasql.promise('SELECT VALUE COUNT(*) FROM players');
      
      if (playerCount > 0) {
        console.log(`Database already has ${playerCount} players. Loading them.`);
        const storedPlayers = await alasql.promise('SELECT * FROM players');
        setDatabaseState(storedPlayers);
        setIsDbLoaded(true);
      } else {
        // Use a worker to fetch and parse the large data file without blocking the UI
        if (workerRef.current) {
            console.log('Database is empty. Fetching initial player data...');
            const response = await fetch('/all-tx-players-with-id-and-school.txt');
            if (!response.ok) {
              throw new Error('Failed to fetch master player data file.');
            }
            const blob = await response.blob();
            const file = new File([blob], 'all-tx-players-with-id-and-school.txt', { type: 'text/plain' });
            // Pass the file to the worker to process and populate the DB
            workerRef.current.postMessage({ file, existingPlayers: [] });
        }
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
    workerRef.current = new Worker(new URL('@/workers/importer-worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (event) => {
        const { players, error, complete } = event.data;
        if (error) {
            console.error("Worker Error:", error);
            setIsDbLoaded(true); // Stop loading indicator on error
        } else if (complete) {
            console.log('Worker finished populating DB. Reloading data from DB.');
            alasql.promise('SELECT * FROM players').then(storedPlayers => {
              setDatabaseState(storedPlayers);
              setIsDbLoaded(true);
            });
        }
    };

    initializeDatabase();

    return () => { 
        workerRef.current?.terminate();
    };
  }, [initializeDatabase]);


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

  const dbStates = useMemo(() => {
    if (isDbLoaded) {
        const usStates = [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
            'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
            'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
            'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
        ];
        const allUniqueStatesFromDb = new Set(database.map(p => p.state).filter(Boolean) as string[]);

        const usStatesInDb = usStates.filter(s => allUniqueStatesFromDb.has(s));
        const nonUsRegionsInDb = [...allUniqueStatesFromDb].filter(s => !usStates.includes(s));
        
        const sortedUsStates = usStatesInDb.filter(s => s !== 'TX').sort();
        const sortedNonUsRegions = nonUsRegionsInDb.sort();
        
        const finalList = [
            'ALL',
            'TX',
            'NO_STATE', 
            ...sortedUsStates,
            ...sortedNonUsRegions
        ];
        
        return finalList;
    }
    return ['ALL', 'TX', 'NO_STATE'];
  }, [isDbLoaded, database]);

  const value = {
    database,
    getPlayersByFilter,
    addPlayer,
    updatePlayer,
    isDbLoaded,
    dbPlayerCount: database.length,
    setDatabase,
    dbStates,
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
