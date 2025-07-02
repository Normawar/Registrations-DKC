
'use client';

// This store for the large USCF database uses sessionStorage to persist across a session.
// It is cleared when the session ends (e.g., tab is closed).

export type ImportedPlayer = {
  id: string; // A unique ID generated during import
  uscfId: string;
  firstName: string;
  lastName:string;
  middleName?: string;
  state?: string;
  expirationDate?: string;
  regularRating?: number;
  quickRating?: string;
};

// In-memory cache to avoid repeated sessionStorage access and parsing
let masterPlayerDatabase: ImportedPlayer[] | null = null;
const SESSION_STORAGE_KEY = 'master_player_db';

export const getMasterDatabase = (): ImportedPlayer[] => {
    // If we have a cached version, return it
    if (masterPlayerDatabase !== null) {
        return masterPlayerDatabase;
    }

    // If not cached, try to load from sessionStorage
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const storedData = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (storedData) {
                masterPlayerDatabase = JSON.parse(storedData);
                return masterPlayerDatabase!;
            }
        }
    } catch (e) {
        console.error("Failed to get master database from sessionStorage", e);
        masterPlayerDatabase = []; // Reset on error
        return [];
    }

    // If nothing in storage, initialize and return empty array
    masterPlayerDatabase = [];
    return masterPlayerDatabase;
};

export const setMasterDatabase = (players: ImportedPlayer[]) => {
  masterPlayerDatabase = players;
  try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(players));
      }
  } catch (e) {
      console.error("Failed to set master database in sessionStorage", e);
      // This might happen if storage is full. The in-memory cache will still work for the current page.
  }
};

export const isMasterDatabaseLoaded = (): boolean => {
    // Check cache first
    if (masterPlayerDatabase !== null) {
        return masterPlayerDatabase.length > 0;
    }
    
    // Fallback to check sessionStorage directly
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const storedData = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
            return !!storedData && JSON.parse(storedData).length > 0;
        }
    } catch (e) {
        console.error("Failed to check master database in sessionStorage", e);
    }
    
    return false;
};
