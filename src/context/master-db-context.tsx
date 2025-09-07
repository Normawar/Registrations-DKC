
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, writeBatch, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { schoolData as initialSchoolData, type School } from '@/lib/data/school-data';
import Papa from 'papaparse';
import { isValid } from 'date-fns';

// --- Types ---

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => void;
  updatePlayer: (player: MasterPlayer) => void;
  deletePlayer: (playerId: string) => void;
  addBulkPlayers: (players: MasterPlayer[]) => Promise<void>;
  clearDatabase: () => Promise<void>;
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
  middleName?: string;
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
  portalType?: 'sponsor' | 'organizer' | 'individual';
}

// --- Context Definition ---

const MasterDbContext = createContext<MasterDbContextType | undefined>(undefined);

// Helper function to remove undefined values from an object
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
      
      if (dobStr && isValid(new Date(dobStr))) {
        playerData.dob = new Date(dobStr).toISOString();
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

// --- Provider Component ---

export const MasterDbProvider = ({ children }: { children: ReactNode }) => {
  const [database, setDatabase] = useState<MasterPlayer[]>([]);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isDbError, setIsDbError] = useState(false);

  const loadDatabase = useCallback(async () => {
    if (!db) {
        console.error("Firestore not initialized.");
        setIsDbError(true);
        setIsDbLoaded(true);
        return;
    }
    setIsDbLoaded(false);
    setIsDbError(false);
    try {
        const playersCol = collection(db, 'players');
        const playerSnapshot = await getDocs(playersCol);
        
        if (playerSnapshot.empty) {
            console.log("Player database is empty. Seeding with master CSV data...");
            
            try {
                const response = await fetch('/data/master-players.csv');
                if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
                
                const csvText = await response.text();
                
                const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
                    Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
                });
                
                const seedPlayers = parseCSVData(parseResult.data);
                
                if (seedPlayers.length > 0) {
                    const batchSize = 500;
                    for (let i = 0; i < seedPlayers.length; i += batchSize) {
                        const batch = writeBatch(db);
                        const batchPlayers = seedPlayers.slice(i, i + batchSize);
                        
                        batchPlayers.forEach(player => {
                            const cleanedPlayer = removeUndefined(player);
                            const docRef = doc(db, 'players', player.id);
                            batch.set(docRef, cleanedPlayer);
                        });
                        await batch.commit();
                    }
                    
                    setDatabase(seedPlayers);
                    console.log(`Seeding complete. Imported ${seedPlayers.length} players from master CSV.`);
                } else {
                    console.warn("No valid players found in master CSV data. Falling back to placeholder data.");
                    const batch = writeBatch(db);
                    fullMasterPlayerData.forEach(player => {
                        const cleanedPlayer = removeUndefined(player);
                        const docRef = doc(db, 'players', player.id);
                        batch.set(docRef, cleanedPlayer);
                    });
                    await batch.commit();
                    setDatabase(fullMasterPlayerData);
                }
            } catch (csvError) {
                console.error("Error loading master CSV, falling back to placeholder data:", csvError);
                const batch = writeBatch(db);
                fullMasterPlayerData.forEach(player => {
                    const cleanedPlayer = removeUndefined(player);
                    const docRef = doc(db, 'players', player.id);
                    batch.set(docRef, cleanedPlayer);
                });
                await batch.commit();
                setDatabase(fullMasterPlayerData);
            }
        } else {
            const playerList = playerSnapshot.docs.map(doc => doc.data() as MasterPlayer);
            setDatabase(playerList);
            console.log(`Loaded ${playerList.length} players from Firestore.`);
        }
    } catch (error) {
      console.error("Failed to load player database from Firestore:", error);
      setIsDbError(true);
    } finally {
      setIsDbLoaded(true);
    }
  }, []);
  
  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  const refreshDatabase = () => {
    loadDatabase();
  };

  const addPlayer = async (player: MasterPlayer) => {
    if (!db) {
        console.error("Database not initialized");
        return;
    }

    console.log("Current user:", auth.currentUser);
    console.log("User authenticated:", !!auth.currentUser);

    if (!auth.currentUser) {
        console.error("User not authenticated! Cannot add player.");
        return;
    }

    try {
        console.log("Attempting to add player:", player);
        const cleanedPlayer = removeUndefined(player);
        console.log("Cleaned player data:", cleanedPlayer);

        const playerRef = doc(db, 'players', cleanedPlayer.id);
        await setDoc(playerRef, cleanedPlayer, { merge: true });

        console.log("Player successfully written to Firebase");
        
        // Optimistically update UI, then refresh from source
        setDatabase(prev => {
            const existingIndex = prev.findIndex(p => p.id === player.id);
            if (existingIndex > -1) {
                const newDb = [...prev];
                newDb[existingIndex] = player;
                return newDb;
            }
            return [...prev, player];
        });
        await loadDatabase(); // ensure consistency
    } catch (error) {
        console.error("Error adding/updating player:", error);
        throw error;
    }
  };

  const addBulkPlayers = async (players: MasterPlayer[]) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        players.forEach(player => {
            const cleanedPlayer = removeUndefined(player);
            const docRef = doc(db, 'players', player.id || player.uscfId);
            batch.set(docRef, cleanedPlayer, { merge: true });
        });
        await batch.commit();
        await loadDatabase();
    } catch (error) {
        console.error("Error adding bulk players:", error);
        throw error;
    }
  };

  const clearDatabase = async () => {
    if (!db) return;
    const playersCol = collection(db, 'players');
    const playerSnapshot = await getDocs(playersCol);
    const batch = writeBatch(db);
    playerSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    setDatabase([]);
  };

  const updatePlayer = async (updatedPlayer: MasterPlayer) => {
    if (!db) return;
    try {
        const cleanedPlayer = removeUndefined(updatedPlayer);
        const playerRef = doc(db, 'players', updatedPlayer.id);
        await setDoc(playerRef, cleanedPlayer, { merge: true });
        await loadDatabase();
    } catch (error) {
        console.error('Error updating player:', error);
        throw error;
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'players', playerId));
    await loadDatabase();
  };

  const updateSchoolDistrict = (oldDistrict: string, newDistrict: string) => {
    // This function will need to be updated to work with Firestore for schools.
    console.warn("updateSchoolDistrict needs to be reimplemented for Firestore.");
  };
  
  const searchPlayers = useCallback((criteria: Partial<SearchCriteria>): MasterPlayer[] => {
    if (!isDbLoaded) return [];

    const {
        firstName, middleName, lastName, uscfId, state, grade, section, school, district,
        minRating, maxRating, excludeIds = [], maxResults = 1000,
        searchUnassigned, sponsorProfile, portalType
    } = criteria;
    
    const lowerFirstName = firstName?.trim().toLowerCase();
    const lowerMiddleName = middleName?.trim().toLowerCase();
    const lowerLastName = lastName?.trim().toLowerCase();
    const lowerUscfId = uscfId?.trim();
    const excludeSet = new Set(excludeIds);

    const results = database.filter(p => {
        if (excludeSet.has(p.id)) return false;

        if (searchUnassigned && sponsorProfile) {
            const isUnassigned = !p.school || p.school.trim() === '';
            const belongsToSponsor = p.school === sponsorProfile.school && p.district === sponsorProfile.district;
            if (!isUnassigned && !belongsToSponsor) return false;
        } else if (portalType === 'organizer') {
            if (school && school.trim() && p.school !== school) return false;
            if (district && district.trim() && p.district !== district) return false;
        }

        if (state && state !== 'ALL') {
            if (state === 'NO_STATE') {
                if (p.state && p.state.trim() !== '') return false;
            } else {
                if (p.state !== state) return false;
            }
        }

        if (lowerFirstName && !p.firstName?.toLowerCase().includes(lowerFirstName)) return false;
        if (lowerMiddleName && !p.middleName?.toLowerCase().includes(lowerMiddleName)) return false;
        if (lowerLastName && !p.lastName?.toLowerCase().includes(lowerLastName)) return false;
        if (lowerUscfId && p.uscfId && !p.uscfId.toString().includes(lowerUscfId)) return false;
        if (grade && grade.trim() && p.grade !== grade) return false;
        if (section && section.trim() && p.section !== section) return false;

        const rating = p.regularRating;
        if (minRating !== undefined && (!rating || rating < minRating)) return false;
        if (maxRating !== undefined && (!rating || rating > maxRating)) return false;

        return true;
    });

    return results.slice(0, maxResults);
  }, [database, isDbLoaded]);

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
