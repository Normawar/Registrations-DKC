
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, doc, writeBatch, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MasterPlayer, fullMasterPlayerData } from '@/lib/data/full-master-player-data';
import { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { schoolData as initialSchoolData, type School } from '@/lib/data/school-data';

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
            // If the collection is empty, seed it with the initial data.
            console.log("Player database is empty. Seeding with initial data...");
            const batch = writeBatch(db);
            fullMasterPlayerData.forEach(player => {
                const docRef = doc(db, 'players', player.id);
                batch.set(docRef, player);
            });
            await batch.commit();
            setDatabase(fullMasterPlayerData);
            console.log("Seeding complete.");
        } else {
            const playerList = playerSnapshot.docs.map(doc => doc.data() as MasterPlayer);
            setDatabase(playerList);
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
    if (!db) return;
    try {
        const playerRef = doc(db, 'players', player.id);
        await setDoc(playerRef, player, { merge: true });
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
    }
  };

  const addBulkPlayers = async (players: MasterPlayer[]) => {
    if (!db) return;
    const batch = writeBatch(db);
    players.forEach(player => {
        const docRef = doc(db, 'players', player.id || player.uscfId);
        batch.set(docRef, player, { merge: true });
    });
    await batch.commit();
    await loadDatabase();
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
    const playerRef = doc(db, 'players', updatedPlayer.id);
    await setDoc(playerRef, updatedPlayer, { merge: true });
    await loadDatabase();
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
