
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';

// --- Types ---

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => void;
  updatePlayer: (player: MasterPlayer) => void;
  deletePlayer: (playerId: string) => void;
  addBulkPlayers: (players: MasterPlayer[]) => void;
  clearDatabase: () => void;
  updateSchoolDistrict: (oldDistrict: string, newDistrict: string) => void;
  isDbLoaded: boolean;
  isDbError: boolean;
  dbPlayerCount: number;
  dbStates: string[];
  dbSchools: string[];
  dbDistricts: string[];
  searchPlayers: (criteria: Partial<SearchCriteria>) => MasterPlayer[];
  refreshDatabase: () => void;
}

export type SearchCriteria = {
  firstName?: string;
  lastName?: string;
  uscfId?: string;
  state?: string;
  grade?: string;
  section?: string;
  school?: string;
  district?: string;
  minRating?: number;
  maxRating?: number;
  excludeIds?: string[];
  maxResults?: number;
  searchUnassigned?: boolean;
  sponsorProfile?: SponsorProfile | null;
}

// --- Constants ---

const DB_STORAGE_KEY = 'master_player_database';
const TIMESTAMP_KEY = 'master_player_database_timestamp';


// --- Context Definition ---

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

// --- Provider Component ---

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isDbError, setIsDbError] = useState(false);

  const loadDatabase = useCallback(() => {
    setIsDbLoaded(false);
    setIsDbError(false);
    try {
      const storedDb = localStorage.getItem(DB_STORAGE_KEY);
      
      if (storedDb) {
        // Always use stored data if it exists, regardless of timestamp
        const parsedDb = JSON.parse(storedDb);
        if (parsedDb.length > 0) {
          setDatabase(parsedDb);
        } else {
          // Only fall back to sample data if stored data is empty
          setDatabase(fullMasterPlayerData);
          localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fullMasterPlayerData));
          localStorage.setItem(TIMESTAMP_KEY, new Date().getTime().toString());
        }
      } else {
        // No stored data, use initial sample data
        setDatabase(fullMasterPlayerData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fullMasterPlayerData));
        localStorage.setItem(TIMESTAMP_KEY, new Date().getTime().toString());
      }
    } catch (error) {
      console.error("Failed to load or parse master player database:", error);
      setIsDbError(true);
      // Fallback to initial data if localStorage fails
      setDatabase(fullMasterPlayerData);
    } finally {
      setIsDbLoaded(true);
    }
  }, []);
  
  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  const persistDatabase = (newDb: MasterPlayer[]) => {
    try {
      setDatabase(newDb);
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(newDb));
      localStorage.setItem(TIMESTAMP_KEY, new Date().getTime().toString());
    } catch (error) {
      console.error("Failed to persist database to localStorage:", error);
    }
  };
  
  const refreshDatabase = () => {
    loadDatabase();
  };

  const addPlayer = (player: MasterPlayer) => {
    const newDb = [...database];
    const existingPlayerIndex = newDb.findIndex(p => p.uscfId && p.uscfId.toUpperCase() !== 'NEW' && p.uscfId === player.uscfId);
    
    if (existingPlayerIndex > -1) {
        const existingPlayer = newDb[existingPlayerIndex];
        // Merge new player data into existing record, preserving the original ID
        newDb[existingPlayerIndex] = { ...existingPlayer, ...player, id: existingPlayer.id };
    } else {
        const newPlayerWithId = { ...player, id: player.id || `p-${Date.now()}` };
        newDb.push(newPlayerWithId);
    }
    persistDatabase(newDb);
  };

  const addBulkPlayers = (players: MasterPlayer[]) => {
    const playerMap = new Map(database.map(p => [p.uscfId, p]));

    players.forEach(newPlayer => {
        const playerWithId = {
            ...newPlayer,
            id: newPlayer.id || newPlayer.uscfId || `p-${Date.now()}-${Math.random()}`,
        };
        const existingPlayer = playerMap.get(playerWithId.uscfId);
        // Merge new data into existing record, keeping the original ID if it exists
        playerMap.set(playerWithId.uscfId, { ...existingPlayer, ...playerWithId });
    });
    
    const updatedDb = Array.from(playerMap.values());
    persistDatabase(updatedDb);
};


  const clearDatabase = () => {
    persistDatabase([]);
  };

  const updatePlayer = (updatedPlayer: MasterPlayer) => {
    const newDb = database.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    persistDatabase(newDb);
  };

  const deletePlayer = (playerId: string) => {
    const newDb = database.filter(p => p.id !== playerId);
    persistDatabase(newDb);
  };

  const updateSchoolDistrict = (oldDistrict: string, newDistrict: string) => {
    const newDb = database.map(p => {
      if (p.district === oldDistrict) {
        return { ...p, district: newDistrict };
      }
      return p;
    });
    persistDatabase(newDb);
  };
  
  const searchPlayers = useCallback((criteria: Partial<SearchCriteria>): MasterPlayer[] => {
    if (!isDbLoaded) return [];

    const {
        firstName, lastName, uscfId, state, grade, section, school, district,
        minRating, maxRating, excludeIds = [], maxResults = 1000,
        searchUnassigned, sponsorProfile
    } = criteria;

    console.log('=== DEBUGGING CASE SENSITIVITY ===');
    console.log('Search lastName:', lastName);
    console.log('Database size:', database.length);

    const lowerFirstName = firstName?.toLowerCase();
    const lowerLastName = lastName?.toLowerCase();
    console.log('lowerLastName:', lowerLastName);

    // Let's see how many players have "GUERRA" in their last name
    const guerraPlayers = database.filter(p => 
        p.lastName && p.lastName.toUpperCase().includes('GUERRA')
    );
    console.log('Players with GUERRA in lastName (case-insensitive):', guerraPlayers.length);
    console.log('Sample GUERRA players:', guerraPlayers.slice(0, 5).map(p => ({
        name: `${p.firstName} ${p.lastName}`,
        school: p.school,
        district: p.district
    })));

    const excludeSet = new Set(excludeIds);

    // Step by step debugging
    let step1 = database.filter(p => !excludeSet.has(p.id));
    console.log('After exclude IDs:', step1.length);

    let step2 = step1.filter(p => {
        if (searchUnassigned && sponsorProfile) {
            const isUnassigned = !p.school || p.school.trim() === '';
            const belongsToSponsor = p.school === sponsorProfile.school && p.district === sponsorProfile.district;
            if (!isUnassigned && !belongsToSponsor) return false;
        } else {
            if (school && !p.school?.toLowerCase().includes(school.toLowerCase())) return false;
            if (district && !p.district?.toLowerCase().includes(district.toLowerCase())) return false;
        }
        return true;
    });
    console.log('After school/district filter:', step2.length);

    let step3 = step2.filter(p => {
        if (state && state !== 'ALL' && p.state !== state) return false;
        return true;
    });
    console.log('After state filter:', step3.length);

    let step4 = step3.filter(p => {
        if (lowerLastName && !p.lastName?.toLowerCase().includes(lowerLastName)) {
            // Debug why this player was filtered out
            if (p.lastName?.toUpperCase().includes('GUERRA')) {
                console.log('FILTERING OUT:', {
                    name: `${p.firstName} ${p.lastName}`,
                    lastName: p.lastName,
                    lowerLastName: p.lastName?.toLowerCase(),
                    searchTerm: lowerLastName,
                    includes: p.lastName?.toLowerCase().includes(lowerLastName || '')
                });
            }
            return false;
        }
        return true;
    });
    console.log('After lastName filter:', step4.length);

    const results = step4.filter(p => {
        if (lowerFirstName && !p.firstName?.toLowerCase().includes(lowerFirstName)) return false;
        if (uscfId && !p.uscfId?.includes(uscfId)) return false;
        if (grade && p.grade !== grade) return false;
        if (section && p.section !== section) return false;

        const rating = p.regularRating;
        if (minRating && (!rating || rating < minRating)) return false;
        if (maxRating && (!rating || rating > maxRating)) return false;

        return true;
    });

    console.log('Final results count:', results.length);
    console.log('Final results:', results.map(p => `${p.firstName} ${p.lastName}`));
    console.log('=== END DEBUG ===');

    return results.slice(0, maxResults);
}, [database, isDbLoaded]);

  // Memoized derived data
  const dbStates = useMemo(() => {
    if (!isDbLoaded) return ['ALL', 'TX'];
    const states = [...new Set(database.map(p => p.state).filter(Boolean))].sort();
    return ['ALL', 'NO_STATE', ...states] as string[];
  }, [database, isDbLoaded]);
  
  const dbSchools = useMemo(() => {
    if (!isDbLoaded) return [];
    return [...new Set(database.map(p => p.school).filter(Boolean))].sort() as string[];
  }, [database, isDbLoaded]);

  const dbDistricts = useMemo(() => {
    if (!isDbLoaded) return [];
    return [...new Set(database.map(p => p.district).filter(Boolean))].sort() as string[];
  }, [database, isDbLoaded]);


  const value = {
    database,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addBulkPlayers,
    clearDatabase,
    updateSchoolDistrict,
    isDbLoaded,
    isDbError,
    dbPlayerCount: database.length,
    dbStates,
    dbSchools,
    dbDistricts,
    searchPlayers,
    refreshDatabase
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
