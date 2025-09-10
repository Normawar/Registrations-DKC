

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter, Query, DocumentSnapshot, getDoc, setDoc, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { schoolData as initialSchoolData, type School } from '@/lib/data/school-data';
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
  addPlayer: (player: MasterPlayer) => Promise<void>;
  updatePlayer: (player: MasterPlayer, editingProfile: SponsorProfile) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
   addBulkPlayers: (
    players: MasterPlayer[], 
    onProgress?: (progress: { current: number; total: number; message: string }) => void
  ) => Promise<void>;
  bulkUploadCSV: (
    csvFile: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<{ uploaded: number; errors: string[] }>; // Renamed function
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
  database: MasterPlayer[];
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

  const loadDatabase = useCallback(async () => {
    // This function is now a no-op for initial load to improve performance.
    // Data will be fetched on demand by components.
    // It can be used for explicit refreshing if needed.
    if (!isDbLoaded) { // Only run once on initial setup
        setIsDbLoaded(true);
    }
  }, [isDbLoaded]);
  
  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  const refreshDatabase = async () => {
    if (!db) return;
    setIsDbLoaded(false);
    try {
        const playersCol = collection(db, 'players');
        const playerSnapshot = await getDocs(playersCol);
        const playerList = playerSnapshot.docs.map(doc => doc.data() as MasterPlayer);
        setDatabase(playerList);
        toast({title: "Database Refreshed", description: `Loaded ${playerList.length} players.`});
    } catch (error) {
        toast({variant: "destructive", title: "Refresh Failed", description: "Could not reload player data."});
    } finally {
        setIsDbLoaded(true);
    }
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
        // No full reload, just update local state if needed
        setDatabase(prev => [...prev.filter(p => p.id !== cleanedPlayer.id), cleanedPlayer]);

    } catch (error) {
        console.error("Error adding player:", error);
        throw error;
    }
  };

  const addBulkPlayers = async (players: MasterPlayer[]) => {
    if (!db) return;
    
    try {
      console.log(`Starting bulk upload of ${players.length} players...`);
      
      const batchSize = 500;
      const totalBatches = Math.ceil(players.length / batchSize);
  
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchPlayers = players.slice(i, i + batchSize);
        const currentBatchNum = i / batchSize + 1;
        
        console.log(`Processing batch ${currentBatchNum} of ${totalBatches}...`);
  
        // 1. Fetch existing players in the current batch
        const existingPlayerIds = batchPlayers.map(p => p.id).filter(id => !id.startsWith('temp_'));
        const existingPlayerDocs = new Map<string, MasterPlayer>();
        if (existingPlayerIds.length > 0) {
            const existingQuery = query(collection(db, 'players'), where('id', 'in', existingPlayerIds));
            const snapshot = await getDocs(existingQuery);
            snapshot.docs.forEach(doc => existingPlayerDocs.set(doc.id, doc.data() as MasterPlayer));
        }
  
        // 2. Prepare writes
        for (const player of batchPlayers) {
          const cleanedPlayer = removeUndefined(player);
          const docRef = doc(db, 'players', player.id);
  
          if (existingPlayerDocs.has(player.id)) {
            // Player exists, merge data
            batch.set(docRef, cleanedPlayer, { merge: true });
          } else {
            // New player
            batch.set(docRef, cleanedPlayer);
          }
        }
        
        // 3. Commit the batch
        await batch.commit();
        console.log(`Batch ${currentBatchNum} committed.`);
      }
      
      // Don't reload entire database, trust the writes
      console.log('Bulk upload complete.');
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

  const updatePlayer = async (updatedPlayer: MasterPlayer, editingProfile: SponsorProfile) => {
    if (!db) return;
    
    // Fetch only the single player to get the old version
    const oldPlayerDoc = await getDoc(doc(db, 'players', updatedPlayer.id));
    const oldPlayer = oldPlayerDoc.exists() ? oldPlayerDoc.data() as MasterPlayer : null;

    if (!oldPlayer) {
        console.error("Could not find original player to create change history.");
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

    if (changedFields.length > 0) {
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
    
    const oldId = finalPlayer.id;
    const newUscfId = finalPlayer.uscfId;
    
    const isIdMigration = oldId.startsWith('temp_') && newUscfId && newUscfId.toUpperCase() !== 'NEW' && newUscfId !== oldId;
    
    if (isIdMigration) {
      const newId = newUscfId;
      const playerWithNewId = { ...finalPlayer, id: newId, updatedAt: new Date().toISOString() };
      const cleanedPlayer = removeUndefined(playerWithNewId);
      await setDoc(doc(db, 'players', newId), cleanedPlayer);
      await deleteDoc(doc(db, 'players', oldId));
    } else {
      const cleanedPlayer = removeUndefined(finalPlayer);
      await setDoc(doc(db, 'players', finalPlayer.id), cleanedPlayer, { merge: true });
    }
  };

  const deletePlayer = async (playerId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'players', playerId));
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
            };
            batch.update(playerRef, updatedData);
            stats.updated++;
        } else {
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
    return stats;
  };
  
  const searchPlayers = async (criteria: Partial<SearchCriteria>): Promise<SearchResult> => {
    if (!db) {
      return { players: [], hasMore: false, totalFound: 0 };
    }
  
    try {
      console.log('Starting server-side search with criteria:', criteria);
      
      let q: Query = collection(db, 'players');
      
      // Apply all conditions
      Object.entries(criteria).forEach(([key, value]) => {
          if (value && key !== 'pageSize' && key !== 'lastDoc' && key !== 'excludeIds' && key !== 'firstName' && key !== 'lastName') {
            q = query(q, where(key, '==', value));
          }
      });
      
      // Add pagination
      if (criteria.lastDoc) {
        q = query(q, startAfter(criteria.lastDoc));
      }
      q = query(q, limit(criteria.pageSize || 100));
      
      console.log('Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      let results = querySnapshot.docs.map(doc => doc.data() as MasterPlayer);
      
      console.log(`Firestore returned ${results.length} results`);
      
      // Client-side filtering for name searches and excludeIds
      if (criteria.firstName || criteria.lastName || criteria.excludeIds) {
        const excludeSet = new Set(criteria.excludeIds || []);
        results = results.filter(player => {
          if (excludeSet.has(player.id)) return false;
          const nameMatch = 
            (!criteria.firstName || player.firstName.toLowerCase().includes(criteria.firstName.toLowerCase())) &&
            (!criteria.lastName || player.lastName.toLowerCase().includes(criteria.lastName.toLowerCase()));
          return nameMatch;
        });
      }
      
      const hasMore = results.length === (criteria.pageSize || 100);
      const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      
      return {
        players: results,
        hasMore,
        lastDoc: newLastDoc,
        totalFound: results.length, // this isn't total overall, just total in this batch
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

  const bulkUploadCSV = async (
    csvFile: File,
    onProgress?: (progress: UploadProgress) => void
): Promise<{ uploaded: number; errors: string[]; }> => {
    if (!db) throw new Error("Database not initialized");
    const updateProgress = (progress: Partial<UploadProgress>) => {
      if (onProgress) {
        const fullProgress: UploadProgress = {
            stage: 'parsing', currentBatch: 0, totalBatches: 0,
            uploadedRecords: 0, totalRecords: 0, percentage: 0,
            message: 'Starting...', ...progress
        };
        onProgress(fullProgress);
      }
    };
  
    try {
      updateProgress({ stage: 'parsing', message: 'Reading and parsing CSV file...' });
      const csvText = await csvFile.text();
      const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
        Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: resolve, error: reject });
      });
      const playersFromCsv = parseCSVData(parseResult.data);
      if (playersFromCsv.length === 0) {
        updateProgress({ stage: 'complete', message: 'No valid players found.', percentage: 100 });
        return { uploaded: 0, errors: ['No valid players found in CSV'] };
      }
  
      updateProgress({ stage: 'uploading', totalRecords: playersFromCsv.length, message: 'Preparing to upload...' });
  
      const batchSize = 400;
      const totalBatches = Math.ceil(playersFromCsv.length / batchSize);
      let totalUploaded = 0;
      let errors: string[] = [];
  
      const allTempPlayers = database.filter(p => p.id.startsWith('temp_'));
  
      for (let i = 0; i < playersFromCsv.length; i += batchSize) {
        const batchPlayers = playersFromCsv.slice(i, i + batchSize);
        const currentBatchNum = i / batchSize + 1;
  
        updateProgress({
          currentBatch: currentBatchNum, totalBatches, uploadedRecords: totalUploaded,
          percentage: Math.round((totalUploaded / playersFromCsv.length) * 90),
          message: `Processing batch ${currentBatchNum} of ${totalBatches}...`
        });
  
        const batch = writeBatch(db);
  
        for (const uscfPlayer of batchPlayers) {
          if (!uscfPlayer.uscfId || uscfPlayer.uscfId.toUpperCase() === 'NEW') continue;
  
          const existingPlayerDoc = await getDoc(doc(db, 'players', uscfPlayer.uscfId));
  
          if (existingPlayerDoc.exists()) {
            // Standard update for existing player
            batch.set(doc(db, 'players', uscfPlayer.uscfId), uscfPlayer, { merge: true });
          } else {
            // USCF ID not found, try to match with a temp player
            const potentialMatches = allTempPlayers.filter(tempPlayer =>
              tempPlayer.firstName?.toLowerCase() === uscfPlayer.firstName?.toLowerCase() &&
              tempPlayer.lastName?.toLowerCase() === uscfPlayer.lastName?.toLowerCase() &&
              tempPlayer.school?.toLowerCase() === uscfPlayer.school?.toLowerCase()
            );
  
            if (potentialMatches.length === 1) {
              // Confident match found
              const tempPlayerToUpdate = potentialMatches[0];
              const updatedData = {
                ...tempPlayerToUpdate, // Keep existing detailed data
                ...uscfPlayer,        // Overwrite with USCF data
                id: uscfPlayer.uscfId, // Set the new official ID
                potentialUscfMatch: { // Clear the flag
                  reviewStatus: 'confirmed' as const,
                  reviewedBy: 'csv-upload-system',
                }
              };
              batch.set(doc(db, 'players', uscfPlayer.uscfId), updatedData);
              batch.delete(doc(db, 'players', tempPlayerToUpdate.id)); // Delete old temp record
            } else {
              // No confident match, flag for manual review
              allTempPlayers.forEach(tempPlayer => {
                if (
                  tempPlayer.lastName?.toLowerCase() === uscfPlayer.lastName?.toLowerCase() &&
                  tempPlayer.firstName?.toLowerCase() === uscfPlayer.firstName?.toLowerCase()
                ) {
                  const matchData = {
                    uscfId: uscfPlayer.uscfId,
                    uscfHistoryUrl: `https://www.uschess.org/msa/MbrDtlTnmtHst.php?${uscfPlayer.uscfId}`,
                    confidence: 'high' as const,
                    matchedOn: ['firstName', 'lastName'],
                    flaggedDate: new Date().toISOString(),
                    reviewStatus: 'pending' as const
                  };
                  batch.set(doc(db, 'players', tempPlayer.id), { potentialUscfMatch: matchData }, { merge: true });
                }
              });
            }
          }
        }
  
        await batch.commit();
        totalUploaded += batchPlayers.length; // This is an approximation of writes
      }
  
      updateProgress({ stage: 'refreshing', percentage: 95, message: 'Uploads complete, refreshing local database...' });
      await loadDatabase();
      updateProgress({ stage: 'complete', percentage: 100, message: 'Process finished successfully.' });
  
      return { uploaded: playersFromCsv.length, errors };
    } catch (error) {
      console.error('CSV upload failed:', error);
      updateProgress({ stage: 'complete', percentage: 0, message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
      throw error;
    }
  };


  const value = {
    addPlayer,
    updatePlayer,
    deletePlayer,
    addBulkPlayers,
    bulkUploadCSV, // Use renamed function
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
    database
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
