
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
        minRating, maxRating, excludeIds = [], maxResults = 1000, // Increase default
        searchUnassigned, sponsorProfile
    } = criteria;

    console.log('=== SEARCH DEBUG START ===');
    console.log('Search criteria received:', criteria);
    console.log('maxResults value:', maxResults);
    console.log('Database size:', database.length);
    console.log('searchUnassigned:', searchUnassigned);
    console.log('sponsorProfile:', sponsorProfile);
    console.log('lastName filter:', lastName);

    const lowerFirstName = firstName?.toLowerCase();
    const lowerLastName = lastName?.toLowerCase();
    const excludeSet = new Set(excludeIds);

    // Let's see what happens step by step
    let step1Results = database.filter(p => !excludeSet.has(p.id));
    console.log('After excluding IDs:', step1Results.length);

    let step2Results = step1Results.filter(p => {
        if (searchUnassigned && sponsorProfile) {
            const isUnassigned = !p.school || p.school.trim() === '';
            const belongsToSponsor = p.school === sponsorProfile.school && p.district === sponsorProfile.district;
            const shouldInclude = isUnassigned || belongsToSponsor;
            if (!shouldInclude) {
                return false;
            }
        } else {
            const schoolMatch = !school || p.school?.toLowerCase().includes(school.toLowerCase());
            const districtMatch = !district || p.district?.toLowerCase().includes(district.toLowerCase());
            if (!schoolMatch || !districtMatch) return false;
        }
        return true;
    });
    console.log('After school/district filtering:', step2Results.length);

    let step3Results = step2Results.filter(p => {
        const stateMatch = !state || state === 'ALL' || p.state === state;
        return stateMatch;
    });
    console.log('After state filtering:', step3Results.length);

    let step4Results = step3Results.filter(p => {
        const lastNameMatch = !lowerLastName || p.lastName?.toLowerCase().includes(lowerLastName);
        return lastNameMatch;
    });
    console.log('After lastName filtering:', step4Results.length);
    
    // Show some examples of what was filtered out
    if (lowerLastName && step4Results.length < step3Results.length) {
        console.log('Sample names that were filtered out:');
        const filtered = step3Results.filter(p => !p.lastName?.toLowerCase().includes(lowerLastName));
        filtered.slice(0, 5).forEach(p => console.log(`- ${p.firstName} ${p.lastName}`));
    }

    const results = step4Results.filter(p => {
        const gradeMatch = !grade || p.grade === grade;
        const sectionMatch = !section || p.section === section;
        
        const rating = p.regularRating;
        const ratingMatch = (!minRating || (rating && rating >= minRating)) && (!maxRating || (rating && rating <= maxRating));

        const firstNameMatch = !lowerFirstName || p.firstName?.toLowerCase().includes(lowerFirstName);
        const uscfIdMatch = !uscfId || p.uscfId?.includes(uscfId);

        return gradeMatch && sectionMatch && ratingMatch && firstNameMatch && uscfIdMatch;
    });

    console.log('Filtered results before slice:', results.length);
    const finalResults = results.slice(0, maxResults);
    console.log('Final results after slice:', finalResults.length);
    console.log('Final results:', finalResults.map(p => `${p.firstName} ${p.lastName} (${p.school || 'No School'})`));
    console.log('=== SEARCH DEBUG END ===');

    return finalResults;
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
