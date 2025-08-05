
import Papa from 'papaparse';
import type { MasterPlayer } from '@/lib/data/master-player-data';
import alasql from 'alasql';

// This tells TypeScript that `self` is a Worker global scope.
declare const self: Worker;

const DB_NAME = 'ChessMatePlayerDB_v4'; // Must match context provider version

async function processAndStoreData(players: MasterPlayer[]) {
    if (players.length === 0) {
        self.postMessage({ complete: true });
        return;
    }
    try {
        await alasql.promise(`ATTACH INDEXEDDB DATABASE ${DB_NAME}; USE ${DB_NAME};`);
        
        const chunkSize = 2000;
        for (let i = 0; i < players.length; i += chunkSize) {
            const chunk = players.slice(i, i + chunkSize);
            await alasql.promise('INSERT INTO players FROM ?', [chunk]);
            console.log(`Worker: Inserted chunk ${i / chunkSize + 1}`);
        }
        
        self.postMessage({ complete: true });
    } catch (e) {
        console.error("Worker DB Error:", e);
        self.postMessage({ error: (e as Error).message });
    }
}


self.onmessage = (event) => {
    const { file } = event.data as { file: File, existingPlayers: MasterPlayer[] };
    if (!file) {
        self.postMessage({ error: 'No file received by worker.' });
        return;
    }

    let skippedCount = 0;
    let finalPlayerList: MasterPlayer[] = [];

    Papa.parse(file, {
        worker: false, // Run parsing in this worker thread.
        delimiter: "\t",
        skipEmptyLines: true,
        chunk: (results) => {
            const rows = results.data as string[][];
             for (const row of rows) {
                try {
                    const uscfId = row[1]?.trim();
                    if (!uscfId) {
                        skippedCount++;
                        continue;
                    }
                    const namePart = row[0]?.trim() || `Player ${uscfId}`;
                    let lastName = '', firstName = '', middleName = '';
                    if (namePart.includes(',')) {
                        const namePieces = namePart.split(',').map(p => p.trim());
                        lastName = namePieces[0] || '';
                        if (namePieces.length > 1 && namePieces[1]) {
                            const firstAndMiddle = namePieces[1].split(' ').filter(Boolean);
                            firstName = firstAndMiddle.shift() || '.';
                            middleName = firstAndMiddle.join(' ');
                        } else {
                           firstName = '.';
                        }
                    } else {
                        const namePieces = namePart.split(' ').filter(Boolean);
                        lastName = namePieces.pop() || '.';
                        firstName = namePieces.join(' ');
                        if (!firstName) firstName = '.';
                    }
                     const expirationDateStr = row[2] || '';
                     let expirationDateISO: string | undefined = undefined;
                     if (expirationDateStr) {
                         const dateParts = expirationDateStr.split('/');
                         if (dateParts.length === 3) {
                             let year = parseInt(dateParts[2], 10);
                             if (!isNaN(year) && year < 100) {
                                 year += (year > 50 ? 1900 : 2000);
                             }
                             const month = parseInt(dateParts[0], 10) - 1;
                             const day = parseInt(dateParts[1], 10);
                             if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                                 const parsedDate = new Date(Date.UTC(year, month, day));
                                 if (!isNaN(parsedDate.getTime())) {
                                     expirationDateISO = parsedDate.toISOString();
                                 }
                             }
                         }
                     }
                    const state = row[3]?.trim() || undefined;
                    const regularRatingString = row[4] || '';
                    const quickRatingString = row[5]?.trim() || undefined;
                    let regularRating: number | undefined = undefined;
                    if (regularRatingString && !isNaN(parseInt(regularRatingString, 10))) {
                        const ratingMatch = regularRatingString.match(/^(\d+)/);
                        if (ratingMatch && ratingMatch[1]) regularRating = parseInt(ratingMatch[1], 10);
                    }
                    
                    const playerRecord: MasterPlayer = {
                        id: `p-${uscfId}`, 
                        uscfId: uscfId, 
                        firstName: firstName, 
                        lastName: lastName, 
                        middleName: middleName || undefined,
                        state: state,
                        uscfExpiration: expirationDateISO, 
                        regularRating: regularRating,
                        quickRating: quickRatingString,
                        school: "Independent", district: "None", events: 0, eventIds: []
                    };
                    finalPlayerList.push(playerRecord);
                } catch (e) { 
                    skippedCount++;
                }
            }
        },
        complete: () => {
            console.log(`Worker: Parsing complete. Found ${finalPlayerList.length} players. Skipped ${skippedCount} rows. Now storing in DB...`);
            processAndStoreData(finalPlayerList);
        },
        error: (error: any) => {
            self.postMessage({ error: error.message });
        }
    });
};

export {};
