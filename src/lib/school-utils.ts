
import type { School } from './data/school-data';

/**
 * Generates a team code for a school based on its district and name.
 * The code is formed by:
 * - The first 2 letters of the district.
 * - A shortened version of the school name.
 * 
 * Example:
 * School: "B L GARZA MIDDLE", District: "EDINBURG CISD" -> "EDBLGARZA"
 * School: "KENNEDY MIDDLE", District: "PHARR-SAN JUAN-ALAMO ISD" -> "PSKENNEDY"
 */
export function generateTeamCode(options: { schoolName?: string; district?: string; studentType?: 'gt' | 'independent' }): string {
  const { schoolName, district, studentType } = options;

  if (!district || !schoolName) {
    return '';
  }

  const districtCode = district.substring(0, 2).toUpperCase();
  
  // Specific overrides from the image
  if (district === 'PHARR-SAN JUAN-ALAMO ISD' && schoolName === 'PSJA HIGH' && studentType === 'independent') {
    return 'PSJAHIGH';
  }
  if (district === 'PHARR-SAN JUAN-ALAMO ISD' && schoolName === 'PSJA Southwest HS' && studentType === 'gt') {
    return 'PSJASWECHS';
  }
   if (district === 'PHARR-SAN JUAN-ALAMO ISD' && schoolName === 'PSJA Southwest HS' && studentType === 'independent') {
    return 'PSJASWECHS';
  }

  // General logic based on the image pattern
  const exclusionList = ["EL", "ELEMENTARY", "MIDDLE", "HIGH", "SCHOOL", "H", "S", "J", "SR", "JR", "ISD", "ELEM", "MS", "HS"];

  const schoolCode = schoolName
    .split(' ')
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(w => w && !exclusionList.includes(w.toUpperCase()))
    .join('')
    .toUpperCase();

  return `${districtCode}${schoolCode}`;
}
