
import { MasterPlayer } from '@/lib/data/full-master-player-data';
import { format, isValid } from 'date-fns';

/**
 * Sanitizes a player object to ensure it's safe for Firestore.
 * - Converts Date objects to ISO strings.
 * - Removes properties with `undefined` values.
 * - Ensures all data is serializable.
 */
export function sanitizePlayerForFirebase(player: Partial<MasterPlayer>): Partial<MasterPlayer> {
  const sanitized: Partial<MasterPlayer> = {};

  for (const key in player) {
    const value = player[key as keyof MasterPlayer];

    if (value === undefined) {
      continue; // Skip undefined values
    }
    
    if (key === 'dob' || key === 'uscfExpiration' || key === 'createdAt' || key === 'updatedAt') {
        if (value instanceof Date && isValid(value)) {
            (sanitized as any)[key] = value.toISOString();
        } else if (typeof value === 'string' && isValid(new Date(value))) {
            (sanitized as any)[key] = new Date(value).toISOString();
        } else if (value) {
            (sanitized as any)[key] = value;
        }
        continue;
    }

    if (value !== undefined) {
      (sanitized as any)[key] = value;
    }
  }

  return sanitized;
}
