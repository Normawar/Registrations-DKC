
import type { School } from './data/school-data';

/**
 * Generates a team code for a school based on its district and name.
 * The code is formed by:
 * - The first 2 letters of the district.
 * - The initials of each significant word in the school name (excluding the last one).
 * - The first 4 letters of the last significant word in the school name.
 * 
 * For PHARR-SAN JUAN-ALAMO ISD, if a student is "Independent", the code is overridden.
 * 
 * Example:
 * School: "A M OCHOA EL", District: "DONNA ISD"
 * Result: "DOAMOCHO"
 * 
 * Example (Independent):
 * School: "KELLY-PHARR EL", District: "PHARR-SAN JUAN-ALAMO ISD", Type: "independent"
 * Result: "PHINDKPKELL"
 */
export function generateTeamCode(options: { schoolName: string; district: string; studentType?: 'gt' | 'independent' }): string {
  const { schoolName, district, studentType } = options;
  const districtCode = district.substring(0, 2).toUpperCase();
  
  const exclusionList = ["EL", "ELEMENTARY", "MIDDLE", "HIGH", "SCHOOL", "H", "S", "J", "SR", "JR", "ISD"];

  const significantWords = schoolName
    .split(' ')
    .map(w => w.replace(/[^a-zA-Z0-9]/g, '')) // Remove punctuation
    .filter(w => w) // Remove empty strings from punctuation removal
    .filter(w => !exclusionList.includes(w.toUpperCase()));

  if (significantWords.length === 0) {
    // Fallback if all words are excluded or name is empty
    const fallbackWords = schoolName.split(' ').filter(w => w);
    if (fallbackWords.length === 0) return `${districtCode}SCH`; // Ultimate fallback
    return `${districtCode}${fallbackWords[0].substring(0, 4)}`.toUpperCase();
  }
  
  const initialsPart = significantWords.slice(0, -1).map(w => w.charAt(0)).join('');
  const lastWordPart = significantWords[significantWords.length - 1].substring(0, 4);

  if (district === 'PHARR-SAN JUAN-ALAMO ISD' && studentType === 'independent') {
    return `${districtCode}IND${initialsPart}${lastWordPart}`.toUpperCase();
  }

  return `${districtCode}${initialsPart}${lastWordPart}`.toUpperCase();
}
