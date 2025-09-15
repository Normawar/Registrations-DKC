
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, writeBatch, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import Papa from 'papaparse';
import { isValid, parse, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { type School } from '@/lib/data/school-data';
import { generateTeamCode } from '@/lib/school-utils';
import { type SearchCriteria, type SearchResult } from '@/lib/data/search-types';


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

interface MasterDbContextType {
  database: MasterPlayer[];
  schools: School[];
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer, editingProfile: SponsorProfile | null) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  addSchool: (school: Omit<School, 'id' | 'teamCode' | 'notes'>) => Promise<void>;
  updateSchool: (school: School) => Promise<void>;
  deleteSchool: (schoolId: string) => Promise<void>;
  renameDistrict: (oldDistrict: string, newDistrict: string) => Promise<void>;
  addBulkSchools: (data: any[]) => Promise<{ uploaded: number, errors: string[] }>;
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
  getSchoolsForDistrict: (district: string) => string[];
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
  const [schools, setSchools] = useState<School[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isDbError, setIsDbError] = useState(false);
  const { toast } = useToast();
  const [playerCount, setPlayerCount] = useState(0);

  const dbSchools = useMemo(() => [...new Set(schools.map(s => s.schoolName))].sort(), [schools]);
  const dbDistricts = useMemo(() => [...new Set(schools.map(s => s.district))].sort(), [schools]);
  
  const getSchoolsForDistrict = useCallback((district: string): string[] => {
    if (district === 'all' || !district) {
      return dbSchools;
    }
    return schools
      .filter(s => s.district === district)
      .map(s => s.schoolName)
      .sort();
  }, [schools, dbSchools]);

  const loadDatabase = useCallback(async () => {
    if (!db) return;
  
    setIsDbLoaded(false);
    
    try {
      const playersRef = collection(db, 'players');
      const schoolsRef = collection(db, 'schools');

      const [playersSnapshot, schoolsSnapshot] = await Promise.all([
        getDocs(playersRef),
        getDocs(schoolsRef),
      ]);
      
      const players = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterPlayer));
      const schoolList = schoolsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as School));
      
      setDatabase(players);
      setSchools(schoolList);
      setPlayerCount(players.length);
      setIsDbLoaded(true);
      
    } catch (error: any) {
      console.error('Failed to load players or schools database:', error);
      setIsDbLoaded(false);
      setIsDbError(true);
    }
  }, []);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);


  const refreshDatabase = async () => {
    await loadDatabase();
    toast({ title: 'Database Refreshed', description: 'Fetched the latest player and school data from the server.' });
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
            // Replace undefined with null for Firestore compatibility
            const oldValue = oldPlayer[key] === undefined ? null : oldPlayer[key];
            const newValue = updatedPlayer[key] === undefined ? null : updatedPlayer[key];
            
            if (oldValue !== newValue) {
                changedFields.push({
                    field: key,
                    oldValue,
                    newValue,
                });
            }
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
  
  const addSchool = async (school: Omit<School, 'id' | 'teamCode' | 'notes'>) => {
    if (!db) return;
    const id = `school-${Date.now()}`;
    const newSchool: School = {
        ...school,
        id,
        teamCode: generateTeamCode(school),
        notes: [],
    };
    await setDoc(doc(db, 'schools', id), newSchool);
    await loadDatabase();
  };

  const updateSchool = async (school: School) => {
      if (!db) return;
      const schoolWithCode = { ...school, teamCode: school.teamCode || generateTeamCode(school) };
      await setDoc(doc(db, 'schools', school.id), schoolWithCode, { merge: true });
      await loadDatabase();
  };

  const deleteSchool = async (schoolId: string) => {
      if (!db) return;
      await deleteDoc(doc(db, 'schools', schoolId));
      await loadDatabase();
  };
  
  const addBulkSchools = async (data: any[]) => {
    if (!db) return { uploaded: 0, errors: ["Database not connected."] };
    let errors: string[] = [];
    const newSchools = data.map((row: any, index: number) => {
      try {
        const schoolName = row['School Name'] || row['schoolName'];
        const district = row['District'] || row['district'];
        if (!schoolName || !district) throw new Error('Missing school name or district');
        const id = `school-${Date.now()}-${index}`;
        return {
          id,
          schoolName,
          district,
          streetAddress: row['Street Address'] || row['streetAddress'] || '',
          city: row['City'] || row['city'] || '',
          zip: row['ZIP'] || row['zip'] || '',
          phone: row['Phone'] || row['phone'] || '',
          county: row['County Name'] || row['county'] || '',
          state: row['State'] || row['state'] || 'TX',
          charter: row['Charter'] || row['charter'] || '',
          students: row['Students'] || row['students'] || '',
          zip4: row['ZIP 4-digit'] || row['zip4'] || '',
          notes: [],
          teamCode: generateTeamCode({ schoolName, district }),
        };
      } catch (e: any) {
        errors.push(`Row ${index + 2}: ${e.message}`);
        return null;
      }
    }).filter(Boolean);

    if (newSchools.length > 0) {
      const batch = writeBatch(db);
      newSchools.forEach(school => {
        if (school) {
            const docRef = doc(db, 'schools', school.id);
            batch.set(docRef, school);
        }
      });
      await batch.commit();
      await loadDatabase();
    }
    return { uploaded: newSchools.length, errors };
  };

  const renameDistrict = async (oldDistrict: string, newDistrict: string) => {
      if (!db) return;
      const batch = writeBatch(db);
      schools.forEach(school => {
          if (school.district === oldDistrict) {
              const schoolRef = doc(db, "schools", school.id);
              const newTeamCode = generateTeamCode({ schoolName: school.schoolName, district: newDistrict });
              batch.update(schoolRef, { district: newDistrict, teamCode: newTeamCode });
          }
      });
      await batch.commit();
      await loadDatabase();
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
  
  const clearDatabase = async() => {
    //...
  };
  
  const updatePlayerFromUscfData = async (uscfData: Partial<MasterPlayer>[]) => {
      // ...
      return { updated: 0, created: 0 };
  };

  const value = {
    database,
    schools,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addSchool,
    updateSchool,
    deleteSchool,
    renameDistrict,
    addBulkSchools,
    bulkUploadCSV,
    clearDatabase,
    updatePlayerFromUscfData,
    isDbLoaded,
    isDbError,
    dbPlayerCount: playerCount,
    dbStates: [],
    dbSchools,
    dbDistricts,
    getSchoolsForDistrict,
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
