
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import initSqlJs, { type Database } from 'sql.js';
import { MasterPlayer } from '@/lib/data/full-master-player-data';

interface MasterDbContextType {
  database: Database | null;
  query: (sql: string, params?: any[]) => any[];
  isDbLoaded: boolean;
  dbPlayerCount: number;
  dbStates: string[];
}

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [db, setDb] = useState<Database | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [states, setStates] = useState<string[]>(['ALL', 'NO_STATE', 'TX']);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: file => `/${file}`
        });

        const dbResponse = await fetch('/master_player_database.db');
        if (!dbResponse.ok) {
          throw new Error(`Failed to fetch database file: ${dbResponse.statusText}`);
        }
        const dbArrayBuffer = await dbResponse.arrayBuffer();
        const database = new SQL.Database(new Uint8Array(dbArrayBuffer));
        setDb(database);
        
        // Get total player count
        const countResult = database.exec("SELECT COUNT(*) FROM players");
        if (countResult.length > 0 && countResult[0].values.length > 0) {
            setPlayerCount(countResult[0].values[0][0] as number);
        }

        // Get unique states
        const statesResult = database.exec("SELECT DISTINCT state FROM players WHERE state IS NOT NULL AND state != '' ORDER BY state ASC");
        if (statesResult.length > 0 && statesResult[0].values.length > 0) {
            const dbStatesList = statesResult[0].values.map(row => row[0] as string);
            const sortedUsStates = dbStatesList.filter(s => s !== 'TX').sort();
            setStates(['ALL', 'NO_STATE', 'TX', ...sortedUsStates]);
        }
        
        setIsDbLoaded(true);
      } catch (error) {
        console.error("Error initializing SQL.js database:", error);
      }
    };

    initializeDatabase();
  }, []);

  const query = (sql: string, params?: any[]): any[] => {
    if (!db) {
        console.error("Database not loaded yet.");
        return [];
    }
    try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (error) {
        console.error(`Failed to execute query: ${sql}`, error);
        return [];
    }
  };


  const value = {
    database: db,
    query,
    isDbLoaded,
    dbPlayerCount: playerCount,
    dbStates: states,
  };

  // The functions addPlayer, updatePlayer, and deletePlayer are removed as direct DB manipulation
  // in the browser is complex with sql.js file persistence. These would be server-side actions in a real app.

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
