
'use client';

// This is a temporary, in-memory store for the large USCF database.
// It is not persisted and will be cleared on page refresh.

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

let masterPlayerDatabase: ImportedPlayer[] = [];

export const getMasterDatabase = () => masterPlayerDatabase;

export const setMasterDatabase = (players: ImportedPlayer[]) => {
  masterPlayerDatabase = players;
};

export const isMasterDatabaseLoaded = () => masterPlayerDatabase.length > 0;
