
import Papa from 'papaparse';
import type { MasterPlayer } from '@/context/master-db-context';

// This tells TypeScript that `self` is a Worker global scope.
declare const self: Worker;

self.onmessage = (event) => {
    const { file, existingPlayers } = event.data as { file: File, existingPlayers: MasterPlayer[] };
    if (!file) {
        self.postMessage({ error: 'No file received by worker.' });
        return;
    }

    Papa.parse(file, {
        worker: false, // Run parsing in this worker thread, not another one.
        delimiter: "\t",
        skipEmptyLines: true,
        complete: (results) => {
            const rows = results.data as string[][];
            const dbMap = new Map<string, MasterPlayer>();
            
            // Pre-load existing players for efficient merging
            existingPlayers.forEach(p => dbMap.set(p.uscfId, p));

            for (const row of rows) {
                try {
                    const uscfId = row[1]?.trim();
                    const namePart = row[0]?.trim();
                    
                    if (!uscfId || !/^\d{8}$/.test(uscfId) || !namePart || namePart.replace(/[^a-zA-Z]/g, '').length === 0) {
                        continue;
                    }

                    let lastName = '', firstName = '', middleName = '';
                    const cleanedName = namePart.replace(/\s+/g, ' ').trim();
                    
                    if (cleanedName.includes(',')) {
                        const namePieces = cleanedName.split(',').map(p => p.trim());
                        lastName = namePieces[0] || '';
                        if (namePieces.length > 1 && namePieces[1]) {
                            const firstAndMiddle = namePieces[1].split(' ').filter(Boolean);
                            firstName = firstAndMiddle.shift() || '';
                            middleName = firstAndMiddle.join(' ');
                        }
                    } else {
                        const namePieces = cleanedName.split(' ').filter(Boolean);
                        if (namePieces.length > 0) {
                            lastName = namePieces.pop() || '';
                            firstName = namePieces.join(' ');
                        }
                    }

                    if (!firstName) continue;
                    
                    const expirationDateStr = row[2] || '';
                    let expirationDateISO: string | undefined = undefined;
                    if (expirationDateStr) {
                        const parsedDate = new Date(expirationDateStr);
                        if (!isNaN(parsedDate.getTime())) {
                            expirationDateISO = parsedDate.toISOString();
                        }
                    }
                    
                    const state = row[3] || '';
                    const regularRatingString = row[4] || '';
                    const quickRatingString = row[5] || '';
                    let regularRating: number | undefined = undefined;
                    if (regularRatingString && regularRatingString.toLowerCase() !== 'unrated') {
                        const ratingMatch = regularRatingString.match(/^(\d+)/);
                        if (ratingMatch && ratingMatch[1]) regularRating = parseInt(ratingMatch[1], 10);
                    }
                    
                    const existingPlayer = dbMap.get(uscfId);
                    const playerRecord: MasterPlayer = {
                        ...(existingPlayer || { id: `p-${uscfId}`, school: "Independent", district: "None", events: 0, eventIds: [] }),
                        uscfId: uscfId, 
                        firstName: firstName, 
                        lastName: lastName, 
                        middleName: middleName || undefined,
                        state: state || undefined,
                        expirationDate: expirationDateISO, 
                        regularRating: regularRating,
                        quickRating: quickRatingString || undefined,
                    };
                    dbMap.set(uscfId, playerRecord);
                } catch (e) { 
                    console.error("Worker: Error parsing a player row:", row, e); 
                }
            }
            
            const finalPlayerList = Array.from(dbMap.values());
            self.postMessage({ players: finalPlayerList });
        },
        error: (error: any) => {
            self.postMessage({ error: error.message });
        }
    });
};

// This export is necessary to treat this file as a module.
export {};
