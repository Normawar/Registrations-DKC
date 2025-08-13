
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
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
  searchUnassigned?: boolean; // For sponsor searches
  sponsorProfile?: SponsorProfile | null;
}

// --- Constants ---

const DB_STORAGE_KEY = 'master_player_database';
const TIMESTAMP_KEY = 'master_player_database_timestamp';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

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
      const storedTimestamp = localStorage.getItem(TIMESTAMP_KEY);
      const now = new Date().getTime();

      if (storedDb && storedTimestamp && (now - parseInt(storedTimestamp, 10) < CACHE_DURATION)) {
        setDatabase(JSON.parse(storedDb));
      } else {
        // Data is stale or doesn't exist, use initial data and set cache
        setDatabase(fullMasterPlayerData);
        localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(fullMasterPlayerData));
        localStorage.setItem(TIMESTAMP_KEY, now.toString());
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
      setIsDbError(true);
    }
  };
  
  const refreshDatabase = () => {
    localStorage.removeItem(DB_STORAGE_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
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
        minRating, maxRating, excludeIds = [], maxResults = 100,
        searchUnassigned, sponsorProfile
    } = criteria;

    const lowerFirstName = firstName?.toLowerCase();
    const lowerLastName = lastName?.toLowerCase();
    const excludeSet = new Set(excludeIds);

    const results = database.filter(p => {
        if (excludeSet.has(p.id)) return false;
        
        // School/District filtering logic
        if (searchUnassigned && sponsorProfile) {
            // For sponsors: find players in their school OR unassigned players.
            const isUnassigned = !p.school || p.school.trim() === '';
            const belongsToSponsor = p.school === sponsorProfile.school && p.district === sponsorProfile.district;
            if (!isUnassigned && !belongsToSponsor) {
                return false;
            }
        } else {
            // For organizers: standard filtering.
            const schoolMatch = !school || p.school?.toLowerCase().includes(school.toLowerCase());
            const districtMatch = !district || p.district?.toLowerCase().includes(district.toLowerCase());
            if (!schoolMatch || !districtMatch) return false;
        }

        // Other filters
        const stateMatch = !state || state === 'ALL' || p.state === state;
        const gradeMatch = !grade || p.grade === grade;
        const sectionMatch = !section || p.section === section;
        
        const rating = p.regularRating;
        const ratingMatch = (!minRating || (rating && rating >= minRating)) && (!maxRating || (rating && rating <= maxRating));

        const firstNameMatch = !lowerFirstName || p.firstName?.toLowerCase().includes(lowerFirstName);
        const lastNameMatch = !lowerLastName || p.lastName?.toLowerCase().includes(lowerLastName);
        const uscfIdMatch = !uscfId || p.uscfId?.includes(uscfId);

        return stateMatch && gradeMatch && sectionMatch && ratingMatch && firstNameMatch && lastNameMatch && uscfIdMatch;
    });

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
