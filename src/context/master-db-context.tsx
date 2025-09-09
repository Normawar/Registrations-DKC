

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter, Query, DocumentSnapshot, getDoc, setDoc, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { schoolData as initialSchoolData, type School } from '@/lib/data/school-data';
import Papa from 'papaparse';
import { isValid } from 'date-fns';
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

// Add pagination support to SearchCriteria
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
  // New pagination fields
  lastDoc?: DocumentSnapshot;
  pageSize?: number;
}

// New return type with pagination
export type SearchResult = {
  players: MasterPlayer[];
  hasMore: boolean;
  lastDoc?: DocumentSnapshot;
  totalFound: number;
}

interface MasterDbContextType {
  database: MasterPlayer[];
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
   addBulkPlayers: (
    players: MasterPlayer[], 
    onProgress?: (progress: { current: number; total: number; message: string }) => void
  ) => Promise<void>;
  bulkUploadCSVWithProgress: (
    csvFile: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<{ uploaded: number; errors: string[] }>; // New function
  clearDatabase: () => Promise<void>;
  updateSchoolDistrict: (oldDistrict: string, newDistrict: string) => void;
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
    
    try {
        console.log("Attempting to add player:", player);
        const cleanedPlayer = removeUndefined(player);
        console.log("Cleaned player data:", cleanedPlayer);

        const playerRef = doc(db, 'players', cleanedPlayer.id);
        await setDoc(playerRef, cleanedPlayer, { merge: true });
        
        console.log("Player successfully written to Firebase");
        await loadDatabase(); // Ensure UI consistency by reloading from source
    } catch (error) {
        console.error("Error adding player:", error);
        throw error;
    }
  };

  const addBulkPlayers = async (players: MasterPlayer[]) => {
    if (!db) return;
    
    try {
      console.log(`Starting bulk upload of ${players.length} players...`);
      
      // For large uploads (>1000 records), use batching with delays
      if (players.length > 1000) {
        const batchSize = 500;
        const delayMs = 1000;
        const totalBatches = Math.ceil(players.length / batchSize);
        let totalUploaded = 0;
        
        console.log(`Large upload detected. Processing ${totalBatches} batches with rate limiting...`);
        
        for (let i = 0; i < players.length; i += batchSize) {
          const batch = writeBatch(db);
          const batchPlayers = players.slice(i, i + batchSize);
          const batchNum = Math.floor(i/batchSize) + 1;
          
          console.log(`Processing batch ${batchNum}/${totalBatches} (${batchPlayers.length} players)...`);
          
          batchPlayers.forEach(player => {
            const cleanedPlayer = removeUndefined(player);
            const docRef = doc(db, 'players', player.id || player.uscfId);
            batch.set(docRef, cleanedPlayer, { merge: true });
          });
          
          await batch.commit();
          totalUploaded += batchPlayers.length;
          
          console.log(`Batch ${batchNum}/${totalBatches} completed (${totalUploaded}/${players.length} total)`);
          
          // Rate limiting delay (skip on last batch)
          if (i + batchSize < players.length) {
            console.log(`Waiting ${delayMs}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
        
        console.log(`Large upload complete! ${totalUploaded} players uploaded`);
      } else {
        // For smaller uploads, use the original method
        const batch = writeBatch(db);
        players.forEach(player => {
          const cleanedPlayer = removeUndefined(player);
          const docRef = doc(db, 'players', player.id || player.uscfId);
          batch.set(docRef, cleanedPlayer, { merge: true });
        });
        await batch.commit();
        console.log(`Small upload complete! ${players.length} players uploaded`);
      }
      
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
    playerSnapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    setDatabase([]);
  };

  const updatePlayer = async (updatedPlayer: MasterPlayer) => {
    if (!db) return;
    
    const oldId = updatedPlayer.id;
    const newUscfId = updatedPlayer.uscfId;
    
    // Check if USCF ID changed from temp ID to real USCF ID
    const isIdMigration = oldId.startsWith('temp_') && 
                         newUscfId && 
                         newUscfId.toUpperCase() !== 'NEW' && 
                         newUscfId !== oldId;
    
    if (isIdMigration) {
      const newId = newUscfId;
      const playerWithNewId = {
        ...updatedPlayer,
        id: newId,
        updatedAt: new Date().toISOString()
      };
      
      const cleanedPlayer = removeUndefined(playerWithNewId);
      
      await setDoc(doc(db, 'players', newId), cleanedPlayer);
      await deleteDoc(doc(db, 'players', oldId));
      
      setDatabase(prevDb => 
        prevDb.map(p => p.id === oldId ? playerWithNewId : p)
      );
    } else {
      const cleanedPlayer = removeUndefined(updatedPlayer);
      await setDoc(doc(db, 'players', updatedPlayer.id), cleanedPlayer, { merge: true });
      
      setDatabase(prevDb => 
        prevDb.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
      );
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'players', playerId));
    await loadDatabase();
  };

  const updateSchoolDistrict = (oldDistrict: string, newDistrict: string) => {
    console.warn("updateSchoolDistrict needs to be reimplemented for Firestore.");
  };

  const updatePlayerFromUscfData = async (uscfData: Partial<MasterPlayer>[]) => {
    if (!db) {
        throw new Error("Database not initialized");
    }
    const stats = { updated: 0, created: 0 };
    const batch = writeBatch(db);

    for (const uscfPlayer of uscfData) {
        if (!uscfPlayer.uscfId) continue;
        
        const playerId = generatePlayerId(uscfPlayer.uscfId);
        const playerRef = doc(db, 'players', playerId);
        const playerDoc = await getDoc(playerRef);

        if (playerDoc.exists()) {
            const existingData = playerDoc.data() as MasterPlayer;
            const updatedData = {
                regularRating: uscfPlayer.regularRating !== undefined ? uscfPlayer.regularRating : existingData.regularRating,
                uscfExpiration: uscfPlayer.uscfExpiration || existingData.uscfExpiration,
                // Add any other fields from USCF that should be updated
            };
            batch.update(playerRef, updatedData);
            stats.updated++;
        } else {
            // Player doesn't exist, create a new record
            const newPlayerData: MasterPlayer = {
                id: playerId,
                uscfId: uscfPlayer.uscfId,
                firstName: uscfPlayer.firstName || 'Unknown',
                lastName: uscfPlayer.lastName || 'Unknown',
                regularRating: uscfPlayer.regularRating,
                uscfExpiration: uscfPlayer.uscfExpiration,
                state: uscfPlayer.state || 'TX',
                grade: '',
                section: '',
                email: '',
                school: '',
                district: '',
                events: 0,
                eventIds: [],
            };
            const cleanedPlayer = removeUndefined(newPlayerData);
            batch.set(playerRef, cleanedPlayer);
            stats.created++;
        }
    }

    await batch.commit();
    await loadDatabase();
    return stats;
  };
  
  const searchPlayers = async (criteria: Partial<SearchCriteria>): Promise<SearchResult> => {
    if (!db) {
      return { players: [], hasMore: false, totalFound: 0 };
    }
  
    const {
      firstName, middleName, lastName, uscfId, state, grade, section, school, district,
      minRating, maxRating, pageSize = 100, lastDoc, sponsorProfile, portalType
    } = criteria;
  
    try {
      console.log('Starting server-side search with criteria:', criteria);
      
      let q: Query = collection(db, 'players');
      
      // Build efficient Firestore queries
      const conditions: any[] = [];
      
      // Exact match filters (most efficient)
      if (state && state !== 'ALL' && state !== 'NO_STATE') {
        conditions.push(where('state', '==', state));
      }
      
      if (grade && grade.trim()) {
        conditions.push(where('grade', '==', grade));
      }
      
      if (section && section.trim()) {
        conditions.push(where('section', '==', section));
      }
      
      if (school && school.trim()) {
        conditions.push(where('school', '==', school));
      }
      
      if (district && district.trim()) {
        conditions.push(where('district', '==', district));
      }
  
      // USCF ID exact match (most common search)
      if (uscfId && uscfId.trim()) {
        conditions.push(where('uscfId', '==', uscfId.trim()));
      }
      
      // Rating range queries
      if (minRating !== undefined) {
        conditions.push(where('regularRating', '>=', minRating));
      }
      if (maxRating !== undefined) {
        conditions.push(where('regularRating', '<=', maxRating));
      }
      
      // Apply all conditions
      conditions.forEach(condition => {
        q = query(q, condition);
      });
      
      // For name searches, we'll need to do client-side filtering
      // since Firestore doesn't support efficient text search
      const needsClientFiltering = firstName || middleName || lastName;
      
      // If no server-side filters and need client filtering, limit initial fetch
      if (conditions.length === 0 && needsClientFiltering) {
        q = query(q, limit(1000)); // Fetch first 1000 for name filtering
      } else {
        // Add pagination
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        q = query(q, limit(pageSize));
      }
      
      // Add ordering for consistent pagination
      q = query(q, orderBy('uscfId'));
      
      console.log('Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      let results = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        _docRef: doc // Store doc reference for pagination
      } as MasterPlayer & { _docRef: DocumentSnapshot }));
      
      console.log(`Firestore returned ${results.length} results`);
      
      // Client-side filtering for name searches and complex criteria
      if (needsClientFiltering || criteria.excludeIds?.length) {
        const excludeSet = new Set(criteria.excludeIds || []);
        
        results = results.filter(player => {
          // Exclude IDs
          if (excludeSet.has(player.id)) return false;
          
          // Name filtering (case-insensitive partial match)
          if (firstName && !player.firstName?.toLowerCase().includes(firstName.toLowerCase())) {
            return false;
          }
          if (middleName && !player.middleName?.toLowerCase().includes(middleName.toLowerCase())) {
            return false;
          }
          if (lastName && !player.lastName?.toLowerCase().includes(lastName.toLowerCase())) {
            return false;
          }
          
          return true;
        });
      }
      
      // Handle sponsor/organizer specific filtering
      if (sponsorProfile && portalType === 'sponsor') {
        results = results.filter(player => {
          const isUnassigned = !player.school || player.school.trim() === '';
          const belongsToSponsor = player.school === sponsorProfile.school && 
                                  player.district === sponsorProfile.district;
          return isUnassigned || belongsToSponsor;
        });
      }
      
      // Limit final results
      const maxResults = criteria.maxResults || pageSize;
      const hasMore = results.length === pageSize && !needsClientFiltering;
      const finalResults = results.slice(0, maxResults);
      
      // Get last document for pagination
      const newLastDoc = finalResults.length > 0 ? 
        (finalResults[finalResults.length - 1] as any)._docRef : undefined;
      
      // Clean up _docRef before returning
      const cleanResults = finalResults.map(player => {
        const { _docRef, ...cleanPlayer } = player as any;
        return cleanPlayer;
      });
      
      console.log(`Returning ${cleanResults.length} filtered results`);
      
      return {
        players: cleanResults,
        hasMore,
        lastDoc: newLastDoc,
        totalFound: cleanResults.length
      };
      
    } catch (error) {
      console.error('Search failed:', error);
      return { players: [], hasMore: false, totalFound: 0 };
    }
  };

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

  const bulkUploadCSVWithProgress = async (
  csvFile: File, 
  onProgress?: (progress: UploadProgress) => void
): Promise<{ uploaded: number; errors: string[] }> => {
  console.log('🚀 bulkUploadCSVWithProgress called with file:', csvFile.name);
  
  if (!db) throw new Error("Database not initialized");

  const updateProgress = (progress: Partial<UploadProgress>) => {
    console.log('Progress update:', progress);
    if (onProgress) {
      const fullProgress: UploadProgress = {
        stage: 'parsing',
        currentBatch: 0,
        totalBatches: 0,
        uploadedRecords: 0,
        totalRecords: 0,
        percentage: 0,
        message: 'Starting...',
        ...progress
      };
      onProgress(fullProgress);
    }
  };

  try {
    console.log('Starting enhanced CSV bulk upload...');
    updateProgress({ stage: 'parsing', message: 'Reading CSV file...' });
    
    // Read and parse CSV
    const csvText = await csvFile.text();
    console.log('CSV file read successfully, length:', csvText.length);
    updateProgress({ stage: 'parsing', message: 'Parsing CSV data...' });
    
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
      Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: true, 
        dynamicTyping: true,
        complete: resolve, 
        error: reject 
      });
    });

    const players = parseCSVData(parseResult.data);
    console.log(`Parsed ${players.length} players from CSV`);

    if (players.length === 0) {
      updateProgress({ 
        stage: 'complete', 
        message: 'No valid players found in CSV',
        percentage: 100 
      });
      return { uploaded: 0, errors: ['No valid players found in CSV'] };
    }

    // Setup batching
    const batchSize = 500;
    const delayMs = 1000;
    const totalBatches = Math.ceil(players.length / batchSize);
    let totalUploaded = 0;
    const errors: string[] = [];

    console.log(`Processing ${totalBatches} batches with progress tracking...`);
    updateProgress({ 
      stage: 'uploading', 
      totalBatches,
      totalRecords: players.length,
      message: `Starting upload of ${players.length} players in ${totalBatches} batches...` 
    });

    // Process batches
    for (let i = 0; i < players.length; i += batchSize) {
      const batchPlayers = players.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      
      updateProgress({
        stage: 'uploading',
        currentBatch: batchNum,
        totalBatches,
        uploadedRecords: totalUploaded,
        totalRecords: players.length,
        percentage: Math.round((totalUploaded / players.length) * 90),
        message: `Uploading batch ${batchNum}/${totalBatches} (${batchPlayers.length} players)...`
      });
      
      try {
        const batch = writeBatch(db);
        
        batchPlayers.forEach(player => {
          const cleanedPlayer = removeUndefined(player);
          const docRef = doc(db, 'players', player.id);
          batch.set(docRef, cleanedPlayer, { merge: true });
        });

        await batch.commit();
        totalUploaded += batchPlayers.length;
        
        console.log(`Batch ${batchNum}/${totalBatches} completed (${totalUploaded}/${players.length} total)`);

        updateProgress({
          stage: 'uploading',
          currentBatch: batchNum,
          totalBatches,
          uploadedRecords: totalUploaded,
          totalRecords: players.length,
          percentage: Math.round((totalUploaded / players.length) * 90),
          message: `Completed batch ${batchNum}/${totalBatches} - ${totalUploaded} players uploaded`
        });

        // Rate limiting delay (skip on last batch)
        if (i + batchSize < players.length) {
          updateProgress({
            stage: 'uploading',
            currentBatch: batchNum,
            totalBatches,
            uploadedRecords: totalUploaded,
            totalRecords: players.length,
            percentage: Math.round((totalUploaded / players.length) * 90),
            message: `Waiting ${delayMs}ms before next batch...`
          });
          console.log(`Waiting ${delayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        console.error(`Batch ${batchNum} failed:`, error);
        
        if (error instanceof Error && error.message.includes('resource-exhausted')) {
          console.log('Rate limit hit, waiting longer...');
          updateProgress({
            stage: 'uploading',
            currentBatch: batchNum,
            totalBatches,
            uploadedRecords: totalUploaded,
            totalRecords: players.length,
            percentage: Math.round((totalUploaded / players.length) * 90),
            message: `Rate limit reached - waiting longer before retry...`
          });
          await new Promise(resolve => setTimeout(resolve, delayMs * 3));
          i -= batchSize; // Retry this batch
          continue;
        }
        
        errors.push(`Batch ${batchNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Refresh the database after upload
    console.log('Refreshing database...');
    updateProgress({
      stage: 'refreshing',
      currentBatch: totalBatches,
      totalBatches,
      uploadedRecords: totalUploaded,
      totalRecords: players.length,
      percentage: 95,
      message: 'Refreshing database...'
    });
    
    await loadDatabase();
    
    console.log(`Enhanced upload complete! ${totalUploaded} players uploaded`);
    updateProgress({
      stage: 'complete',
      currentBatch: totalBatches,
      totalBatches,
      uploadedRecords: totalUploaded,
      totalRecords: players.length,
      percentage: 100,
      message: `Upload complete! ${totalUploaded} players uploaded successfully`
    });
    
    return { uploaded: totalUploaded, errors };

  } catch (error) {
    console.error('Enhanced CSV upload failed:', error);
    updateProgress({
      stage: 'complete',
      percentage: 0,
      message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    throw error;
  }
};

  const value = {
    database,
    addPlayer,
    updatePlayer,
    deletePlayer,
    addBulkPlayers,
    bulkUploadCSVWithProgress,
    clearDatabase,
    updateSchoolDistrict,
    isDbLoaded,
    isDbError,
    dbPlayerCount: database.length,
    dbStates,
    dbSchools,
    dbDistricts,
    searchPlayers,
    refreshDatabase,
    generatePlayerId,
    updatePlayerFromUscfData,
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
