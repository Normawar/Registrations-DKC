
'use client';

// This store for the large USCF database uses an in-memory variable to persist across a session.
// It is cleared when the session ends (e.g., tab is hard-refreshed or closed).
// This avoids browser storage limitations (like sessionStorage's 5-10MB quota).

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

// In-memory cache to avoid storage quotas and repeated parsing.
// This variable acts as a singleton for the browser session.
let masterPlayerDatabase: ImportedPlayer[] | null = null;

export const getMasterDatabase = (): ImportedPlayer[] => {
    // If the cache has been initialized, return it.
    if (masterPlayerDatabase !== null) {
        return masterPlayerDatabase;
    }
    // If not, initialize it as an empty array and return it.
    masterPlayerDatabase = [];
    return masterPlayerDatabase;
};

export const setMasterDatabase = (players: ImportedPlayer[]) => {
  masterPlayerDatabase = players;
  // Notify other parts of the app that the database has been updated.
  if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('masterDbUpdated'));
  }
};

export const isMasterDatabaseLoaded = (): boolean => {
    // The database is considered loaded if the in-memory cache is not null and has players.
    return masterPlayerDatabase !== null && masterPlayerDatabase.length > 0;
};
