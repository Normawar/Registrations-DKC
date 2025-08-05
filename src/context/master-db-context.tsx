

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import type { MasterPlayer } from '@/lib/data/master-player-data';
import { initialMasterPlayerData } from '@/lib/data/master-player-data';
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

  const initializeDatabase = useCallback(async () => {
    if (dbInitialized.current) return;
    dbInitialized.current = true;

    try {
      // Connect to AlaSQL IndexedDB database
      // The version number (4) is critical. Increment it if schema changes.
      await alasql.promise(`
        CREATE INDEXEDDB DATABASE IF NOT EXISTS chessmate_db;
        ATTACH INDEXEDDB DATABASE chessmate_db;
        USE chessmate_db;
        CREATE TABLE IF NOT EXISTS players (
          id STRING, uscfId STRING, firstName STRING, lastName STRING, middleName STRING, 
          state STRING, uscfExpiration STRING, regularRating INT, quickRating STRING, 
          school STRING, district STRING, events INT, eventIds ARRAY,
          grade STRING, section STRING, email STRING, phone STRING, dob STRING, zipCode STRING, studentType STRING
        );
      `);

      const playerCount = alasql('SELECT VALUE COUNT(*) FROM players');
      
      if (playerCount === 0) {
        // This logic can be replaced with fetching from a remote server in a real app
        const response = await fetch('/data/all-tx-players-2024-05-10-11_33_08.txt');
        const textData = await response.text();
        const players: MasterPlayer[] = textData.split('\n').map((line, index) => {
            const parts = line.split('|');
            const uscfId = parts[0]?.trim();
            const namePart = parts[1]?.trim();
            const expirationDateStr = parts[2]?.trim();
            const state = parts[3]?.trim();
            const regularRatingString = parts[4]?.trim();
            
            let lastName = '', firstName = '', middleName = '';
            if (namePart) {
              if (namePart.includes(',')) {
                  const namePieces = namePart.split(',').map(p => p.trim());
                  lastName = namePieces[0] || '';
                  if (namePieces.length > 1 && namePieces[1]) {
                      const firstAndMiddle = namePieces[1].split(' ').filter(Boolean);
                      firstName = firstAndMiddle.shift() || '';
                      middleName = firstAndMiddle.join(' ');
                  }
              } else {
                  const namePieces = namePart.split(' ').filter(Boolean);
                  if (namePieces.length === 1) {
                      lastName = namePieces[0];
                  } else if (namePieces.length > 1) {
                      lastName = namePieces.pop() || '';
                      firstName = namePieces.shift() || '';
                      middleName = namePieces.join(' ');
                  }
              }
            }
            
            let expirationDateISO: string | undefined = undefined;
            if (expirationDateStr) {
                const dateParts = expirationDateStr.split('/');
                if (dateParts.length === 3) {
                    let year = parseInt(dateParts[2], 10);
                    if (!isNaN(year) && year < 100) {
                        year += (year > 50 ? 1900 : 2000); 
                    }
                    const month = parseInt(dateParts[0], 10) - 1;
                    const day = parseInt(dateParts[1], 10);
                    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        const parsedDate = new Date(Date.UTC(year, month, day));
                        if (!isNaN(parsedDate.getTime())) {
                            expirationDateISO = parsedDate.toISOString();
                        }
                    }
                }
            }

            const player: MasterPlayer = {
              id: `p-${uscfId || index}`,
              uscfId: uscfId || '',
              firstName: firstName,
              lastName: lastName,
              middleName: middleName,
              state: state || undefined,
              uscfExpiration: expirationDateISO,
              regularRating: regularRatingString ? parseInt(regularRatingString, 10) : undefined,
              school: '', district: '', events: 0, eventIds: []
            };
            return player;
        });

        alasql('SELECT * INTO players FROM ?', [players]);
        setDatabaseState(players);
      } else {
        const storedPlayers = alasql('SELECT * FROM players');
        setDatabaseState(storedPlayers);
      }
    } catch (error) {
      console.error("Failed to load and parse master player data:", error);
      // Fallback to initial data if there's a severe error
      setDatabaseState(initialMasterPlayerData);
    } finally {
      setIsDbLoaded(true);
    }
  }, []);
  
  const setDatabase = useCallback(async (players: MasterPlayer[], progressCallback?: (saved: number, total: number) => void) => {
    if (!dbInitialized.current) {
        await initializeDatabase();
    }
    await alasql.promise('DELETE FROM players');
    
    // Chunk insert for large datasets to avoid blocking the main thread for too long
    const chunkSize = 1000;
    const totalPlayers = players.length;
    for (let i = 0; i < totalPlayers; i += chunkSize) {
        const chunk = players.slice(i, i + chunkSize);
        await alasql.promise('SELECT * INTO players FROM ?', [chunk]);
        if (progressCallback) {
            progressCallback(Math.min(i + chunkSize, totalPlayers), totalPlayers);
        }
    }
    
    const allPlayers = alasql('SELECT * FROM players');
    setDatabaseState(allPlayers);
  }, [initializeDatabase]);


  useEffect(() => {
    initializeDatabase();
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
    alasql('INSERT INTO players VALUES ?', [[player]]);
    setDatabaseState(prev => [...prev, player]);
  }, [isDbLoaded]);

  const updatePlayer = useCallback(async (player: MasterPlayer) => {
    if (!isDbLoaded) return;
    
    // AlaSQL's UPDATE syntax with '?' doesn't work well for entire objects,
    // so we build the SET clause manually. This is safer against SQL injection
    // as we control the keys.
    const fieldsToUpdate = Object.keys(player).filter(k => k !== 'id');
    const setClause = fieldsToUpdate.map(key => `${key} = ?`).join(', ');
    const params = fieldsToUpdate.map(key => player[key as keyof MasterPlayer]);
    
    alasql(`UPDATE players SET ${setClause} WHERE id = ?`, [...params, player.id]);
    
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
