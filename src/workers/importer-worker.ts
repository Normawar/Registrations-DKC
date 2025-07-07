
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

    const dbMap = new Map<string, MasterPlayer>();
    
    // Pre-load existing players for efficient merging
    existingPlayers.forEach(p => dbMap.set(p.uscfId, p));

    let skippedCount = 0;

    Papa.parse(file, {
        worker: false, // Run parsing in this worker thread, not another one.
        delimiter: "\t",
        skipEmptyLines: true,
        complete: (results) => {
            const rows = results.data as string[][];
            
            for (const row of rows) {
                try {
                    const uscfId = row[1]?.trim();
                    
                    // A USCF ID is the only absolute requirement.
                    if (!uscfId) {
                        skippedCount++;
                        continue;
                    }

                    const namePart = row[0]?.trim();
                    let lastName = '', firstName = '', middleName = '';
                    
                    // Use a placeholder if name is missing but ID is present.
                    const cleanedName = (namePart || `Player ${uscfId}`).replace(/\s+/g, ' ').trim();
                    
                    if (cleanedName) {
                        if (cleanedName.includes(',')) {
                            // Handles "Last, First Middle" and "Last,"
                            const namePieces = cleanedName.split(',').map(p => p.trim());
                            lastName = namePieces[0] || '';
                            if (namePieces.length > 1 && namePieces[1]) {
                                const firstAndMiddle = namePieces[1].split(' ').filter(Boolean);
                                firstName = firstAndMiddle.shift() || '';
                                middleName = firstAndMiddle.join(' ');
                            }
                        } else {
                            // Handles "First Middle Last" and "First"
                            const namePieces = cleanedName.split(' ').filter(Boolean);
                            if (namePieces.length === 1) {
                                // Assume a single word is a last name.
                                lastName = namePieces[0];
                            } else if (namePieces.length > 1) {
                                lastName = namePieces.pop() || '';
                                firstName = namePieces.shift() || '';
                                middleName = namePieces.join(' ');
                            }
                        }
                    }

                    // Fallback placeholders if parsing fails to populate names.
                    if (cleanedName && !firstName && !lastName) {
                        lastName = cleanedName;
                    }
                    if (cleanedName && !firstName) firstName = '.';
                    if (cleanedName && !lastName) lastName = '.';

                    // Date parsing
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
                        } else {
                            const parsedDate = new Date(expirationDateStr);
                             if (!isNaN(parsedDate.getTime())) {
                                expirationDateISO = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate())).toISOString();
                            }
                        }
                    }
                    
                    const state = row[3]?.trim() || undefined;
                    const regularRatingString = row[4] || '';
                    const quickRatingString = row[5]?.trim() || undefined;
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
                        state: state,
                        expirationDate: expirationDateISO, 
                        regularRating: regularRating,
                        quickRating: quickRatingString,
                    };
                    dbMap.set(uscfId, playerRecord);
                } catch (e) { 
                    console.error("Worker: Error parsing a player row:", row, e); 
                    skippedCount++;
                }
            }
            
            const finalPlayerList = Array.from(dbMap.values());
            self.postMessage({ players: finalPlayerList, skipped: skippedCount });
        },
        error: (error: any) => {
            self.postMessage({ error: error.message, skipped: 0 });
        }
    });
};

// This export is necessary to treat this file as a module.
export {};
