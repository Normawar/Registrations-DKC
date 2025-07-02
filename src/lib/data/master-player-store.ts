
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

// To prevent the in-memory database from being cleared on hot-reloads in development,
// we store it on the globalThis object.
declare global {
  // eslint-disable-next-line no-var
  var masterPlayerDatabase: ImportedPlayer[] | undefined;
}

// If the global store doesn't exist, initialize it as an empty array.
// On subsequent hot-reloads, this check will fail, preserving the existing data.
if (!globalThis.masterPlayerDatabase) {
    globalThis.masterPlayerDatabase = [];
}


export const getMasterDatabase = (): ImportedPlayer[] => {
    // The store is guaranteed to be an array by the initialization logic above.
    return globalThis.masterPlayerDatabase!;
};

export const setMasterDatabase = (players: ImportedPlayer[]) => {
  globalThis.masterPlayerDatabase = players;
};

export const isMasterDatabaseLoaded = (): boolean => {
    // The database is loaded if the global array has items in it.
    return globalThis.masterPlayerDatabase!.length > 0;
};
