'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter, Query, DocumentSnapshot, getDoc, setDoc, writeBatch, deleteDoc, doc, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import Papa from 'papaparse';
import { isValid, parse, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// --- Types ---

export type UploadProgress = {
  stage: 'parsing' | 'uploading' | 'refreshing' | 'complete';
  currentBatch: number;
  totalBatches: number;
  uploadedRecords: number;
  totalRecords: number;
  percentage: number;
  message: string;
};

export type SearchCriteria = {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  uscfId?: string;
  state?: string;
  school?: string;
  district?: string;
  minRating?: number;
  maxRating?: number;
  lastDoc?: DocumentSnapshot;
  pageSize?: number;
};

export type SearchResult = {
  players: MasterPlayer[];
  hasMore: boolean;
  lastDoc?: DocumentSnapshot;
  totalFound: number;
  message?: string;
};

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer, editingProfile: SponsorProfile | null) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  bulkUploadCSV: (
    csvFile: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<{ uploaded: number; errors: string[]; }>;
  clearDatabase: () => Promise<void>;
  isDbLoaded: boolean;
  isDbError: boolean;
  dbPlayerCount: number;
  dbStates: string[];
  dbSchools: string[];
  dbDistricts: string[];
  searchPlayers: (criteria: Partial<SearchCriteria>) => Promise<SearchResult>;
  refreshDatabase: () => void;
  generatePlayerId: (uscfId: string) => string;
  updatePlayerFromUscfData: (uscfData: Partial<MasterPlayer>[]) => Promise<{ updated: number; created: number }>;
  toast: any;
}


// --- Context Definition ---

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

// Helper function to clean undefined values for Firebase
const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(removeUndefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          cleaned[key] = removeUndefined(obj[key]);
        }
      });
      return cleaned;
    }
    
    return obj;
  };

// Add this helper function for parsing CSV data
const parseCSVData = (data: any[]): MasterPlayer[] => {
  const newPlayers: MasterPlayer[] = [];
  let errors = 0;
  let skippedIncomplete = 0;

  const findColumn = (row: any, searchTerms: string[]) => {
    const keys = Object.keys(row);
    for (const term of searchTerms) {
      const found = keys.find(key => 
        key.toLowerCase().trim().includes(term.toLowerCase()) && 
        row[key] !== null && 
        row[key] !== undefined && 
        String(row[key]).trim() !== ''
      );
      if (found) return row[found];
    }
    return null;
  };

  data.forEach((row: any) => {
    try {
      if (!row || Object.keys(row).length === 0) {
        skippedIncomplete++;
        return;
      }

      const uscfId = findColumn(row, ['uscfId', 'uscf id', 'id']);
      const lastName = findColumn(row, ['lastName', 'last name']);

      if (!uscfId || !lastName) {
        skippedIncomplete++;
        return;
      }
      
      const firstName = findColumn(row, ['firstName', 'first name']) || 'Unknown';
      const middleName = findColumn(row, ['middleName', 'middle name']);
      const ratingStr = findColumn(row, ['regularRating', 'rating']);
      const expiresStr = findColumn(row, ['uscfExpiration', 'expires', 'expiration']);
      const dobStr = findColumn(row, ['dob', 'dateOfBirth', 'birth']);
      const grade = findColumn(row, ['grade']);
      const section = findColumn(row, ['section']);
      const email = findColumn(row, ['email']);
      const phone = findColumn(row, ['phone']);
      const zipCode = findColumn(row, ['zipCode', 'zip']);
      const school = findColumn(row, ['school']);
      const district = findColumn(row, ['district']);
      const state = findColumn(row, ['state', 'st']);
      const studentTypeStr = findColumn(row, ['studentType', 'type']);
      const eventsStr = findColumn(row, ['events']);
      const eventIdsStr = findColumn(row, ['eventIds']);

      // Build player data object, only including defined values
      const playerData: any = {
        id: String(uscfId),
        uscfId: String(uscfId),
        firstName: firstName,
        lastName: lastName,
        events: Number(eventsStr || 0),
        eventIds: eventIdsStr ? eventIdsStr.split(',').filter(Boolean) : [],
      };

      // Only add optional fields if they have values
      if (middleName) playerData.middleName = middleName;
      if (state) playerData.state = state;
      else playerData.state = 'TX'; // Default state
      
      if (ratingStr && !isNaN(parseInt(ratingStr))) {
        playerData.regularRating = parseInt(ratingStr);
      }
      
      if (expiresStr && isValid(new Date(expiresStr))) {
        playerData.uscfExpiration = new Date(expiresStr).toISOString();
      }
      
      if (dobStr) {
        let parsedDate;
        // Try parsing different date formats from CSV
        if (typeof dobStr === 'string' && dobStr.includes('/')) {
            parsedDate = parse(dobStr, 'M/d/yyyy', new Date());
        } else {
            parsedDate = new Date(dobStr);
        }
        if (isValid(parsedDate)) {
            playerData.dob = parsedDate.toISOString();
        }
      }
      
      if (grade) playerData.grade = grade;
      if (section) playerData.section = section;
      if (email) playerData.email = email;
      if (phone) playerData.phone = phone;
      if (zipCode) playerData.zipCode = zipCode;
      if (school) playerData.school = school;
      if (district) playerData.district = district;
      
      if (studentTypeStr === 'gt' || studentTypeStr === 'independent') {
        playerData.studentType = studentTypeStr;
      }

      // Ensure no undefined values made it through
      const cleanedPlayerData = removeUndefined(playerData);
      
      newPlayers.push(cleanedPlayerData as MasterPlayer);
    } catch(e) {
      errors++;
      console.error("Error processing player row:", row, e);
    }
  });

  console.log(`CSV Processing complete: ${newPlayers.length} players processed, ${skippedIncomplete} skipped, ${errors} errors`);
  return newPlayers;
};

const generatePlayerId = (uscfId: string): string => {
    console.log('generatePlayerId called with:', uscfId, 'type:', typeof uscfId);
    
    if (uscfId && uscfId.toUpperCase() !== 'NEW' && uscfId.trim() !== '') {
        console.log('Returning USCF ID:', uscfId);
        return uscfId;
    }
    
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Returning temp ID:', tempId);
    return tempId;
};
  
const flagPotentialMatches = (uscfPlayers: any[], tempPlayers: MasterPlayer[]) => {
    const potentialMatches: Array<{
      tempPlayer: MasterPlayer;
      uscfPlayer: any;
      confidence: 'high' | 'medium' | 'low';
      matchedFields: string[];
    }> = [];
  
    uscfPlayers.forEach(uscfPlayer => {
      tempPlayers.forEach(tempPlayer => {
        const matches = [];
        let confidence: 'high' | 'medium' | 'low' = 'low';
  
        if (tempPlayer.firstName?.toLowerCase().trim() === uscfPlayer.firstName?.toLowerCase().trim()) {
          matches.push('firstName');
        }
        if (tempPlayer.lastName?.toLowerCase().trim() === uscfPlayer.lastName?.toLowerCase().trim()) {
          matches.push('lastName');
        }
        if (tempPlayer.state === uscfPlayer.state) {
          matches.push('state');
        }
  
        if (matches.includes('firstName') && matches.includes('lastName') && matches.includes('state')) {
          confidence = 'high';
        } else if (matches.includes('firstName') && matches.includes('lastName')) {
          confidence = 'medium';
        }
  
        if (confidence === 'high' || confidence === 'medium') {
          potentialMatches.push({
            tempPlayer,
            uscfPlayer,
            confidence,
            matchedFields: matches
          });
        }
      });
    });
  
    return potentialMatches;
  };

// --- Provider Component ---

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isDbError, setIsDbError] = useState(false);
  const { toast } = useToast();
  const [playerCount, setPlayerCount] = useState(0);

  // New state for summary data
  const [dbStates, setDbStates] = useState<string[]>([]);
  const [dbSchools, setDbSchools] = useState<string[]>([]);
  const [dbDistricts, setDbDistricts] = useState<string[]>([]);

  const loadDatabase = useCallback(async () => {
    if (!db) return;
  
    setIsDbLoaded(false);
    
    try {
      const playersRef = collection(db, 'players');
      const playersSnapshot = await getDocs(playersRef);
      
      const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterPlayer));
      
      setDatabase(players);
      setPlayerCount(players.length);
      setIsDbLoaded(true);
      
      // Compute summary data
      const states = new Set<string>();
      const schools = new Set<string>();
      const districts = new Set<string>();
      
      players.forEach(p => {
        if (p.state) states.add(p.state);
        if (p.school) schools.add(p.school);
        if (p.district) districts.add(p.district);
      });
      
      setDbStates([...states].sort());
      setDbSchools([...schools].sort());
      setDbDistricts([...districts].sort());
      
    } catch (error: any) {
      console.error('Failed to load players database:', error);
      setIsDbLoaded(false);
      setIsDbError(true);
    }
  }, []);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);


  const refreshDatabase = async () => {
    await loadDatabase();
    toast({ title: 'Database Refreshed', description: 'Fetched the latest player data from the server.' });
  };

  const addPlayer = async (player: MasterPlayer) => {
    if (!db) return;
    try {
        const cleanedPlayer = removeUndefined(player);
        const playerRef = doc(db, 'players', cleanedPlayer.id);
        await setDoc(playerRef, cleanedPlayer, { merge: true });
        await loadDatabase();
    } catch (error) {
        console.error("Error adding player:", error);
        throw error;
    }
  };

  const updatePlayer = async (updatedPlayer: MasterPlayer, editingProfile: SponsorProfile | null) => {
    if (!db) return;
    
    const oldPlayerDoc = await getDoc(doc(db, 'players', updatedPlayer.id));
    const oldPlayer = oldPlayerDoc.exists() ? oldPlayerDoc.data() as MasterPlayer : null;

    if (!oldPlayer) {
        return addPlayer(updatedPlayer); // Fallback to add if not found
    }

    const changedFields: { field: string; oldValue: any; newValue: any }[] = [];
    (Object.keys(updatedPlayer) as Array<keyof MasterPlayer>).forEach(key => {
        if (updatedPlayer[key] !== oldPlayer[key]) {
            changedFields.push({
                field: key,
                oldValue: oldPlayer[key],
                newValue: updatedPlayer[key],
            });
        }
    });

    let finalPlayer = { ...updatedPlayer };

    if (changedFields.length > 0 && editingProfile) {
        const newHistoryEntry = {
            timestamp: new Date().toISOString(),
            userId: editingProfile?.uid || 'unknown',
            userName: `${editingProfile?.firstName} ${editingProfile?.lastName}`.trim() || editingProfile?.email || 'Unknown User',
            changes: changedFields,
        };

        finalPlayer = {
            ...updatedPlayer,
            changeHistory: [...(oldPlayer.changeHistory || []), newHistoryEntry],
            updatedAt: new Date().toISOString(),
        };
    } else {
        return; // No changes
    }
    
    const cleanedPlayer = removeUndefined(finalPlayer);
    await setDoc(doc(db, 'players', finalPlayer.id), cleanedPlayer, { merge: true });
    await loadDatabase(); // Refresh data
  };

  const deletePlayer = async (playerId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'players', playerId));
    await loadDatabase(); // Refresh data
  };
  
  const searchPlayers = async (criteria: Partial<SearchCriteria>): Promise<SearchResult> => {
    if (!db) return { players: [], hasMore: false, totalFound: 0, message: 'Database not initialized.' };

    try {
        const response = await fetch('/api/search-players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(criteria),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API search failed');
        }

        const result = await response.json();
        return result;

    } catch (error) {
        console.error('API search failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { players: [], hasMore: false, totalFound: 0, message: errorMessage };
    }
  };


  const bulkUploadCSV = async (
    csvFile: File,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ uploaded: number; errors: string[]; }> => {
    // ... rest of the implementation
    return { uploaded: 0, errors: [] }; // Placeholder
  };
  
  const addBulkPlayers = async(players: MasterPlayer[]) => {
      // ...
  };

  const clearDatabase = async() => {
    //...
  };
  
  const updatePlayerFromUscfData = async (uscfData: Partial<MasterPlayer>[]) => {
      // ...
      return { updated: 0, created: 0 };
  };

  const value = {
    database,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addBulkPlayers,
    bulkUploadCSV,
    clearDatabase,
    updatePlayerFromUscfData,
    isDbLoaded,
    isDbError,
    dbPlayerCount: playerCount,
    dbStates,
    dbSchools,
    dbDistricts,
    searchPlayers,
    refreshDatabase,
    generatePlayerId,
    toast,
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
