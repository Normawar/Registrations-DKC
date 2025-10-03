
import type { School } from './data/school-data';

// Overrides from the provided image
const teamCodeOverrides: Record<string, string> = {
  "EDINBURG CISD|AVILA": "EDAVILA",
  "EDINBURG CISD|Barrientes MS": "EDBARRIENTES",
  "EDINBURG CISD|Betts Elementary": "EDBETTS",
  "EDINBURG CISD|BL Garza Middle School": "EDBLGARZA",
  "EDINBURG CISD|Brewster School": "EDBREWSTER",
  "EDINBURG CISD|Canterbury Elementary": "EDCANTERBURY",
  "EDINBURG CISD|Canterbury ES": "EDCANTERBURY",
  "EDINBURG CISD|Crawford Elementary": "EDCRAWFORD",
  "EDINBURG CISD|Zavala Elementary": "EDDEZAVALA",
  "EDINBURG CISD|ED Zavala": "EDDEZAVALA",
  "EDINBURG CISD|Esparza": "EDESPARZA",
  "EDINBURG CISD|Gorena Elementary": "EDGORENA",
  "EDINBURG CISD|Guerra Elem.": "EDGUERRA",
  "EDINBURG CISD|E. B Guerra Elementary": "EDGUERRA",
  "EDINBURG CISD|Harwell MS": "EDHARWELL",
  "EDINBURG CISD|Edinburg High School": "EDHIGH",
  "EDINBURG CISD|Edinburg HS": "EDHIGH",
  "EDINBURG CISD|Edinburg Highschool": "EDHIGH",
  "EDINBURG CISD|Jefferson Elem.": "EDJEFFERSON",
  "EDINBURG CISD|LBJ": "EDLBJ",
  "EDINBURG CISD|Ramirez Elementary": "EDRAMIREZ",
  "EDINBURG CISD|South Middle School": "EDSMS",
  "EDINBURG CISD|SMS": "EDSMS",
  "EDINBURG CISD|Truman": "EDTRUMAN",
  "EDINBURG CISD|Robert Vela HS": "EDVELA",
  "IDEA PUBLIC SCHOOLS|College Prep": "IDEANM",
  "IDEA PUBLIC SCHOOLS|IDEA Owassa": "IDEAOWASSA",
  "IDEA PUBLIC SCHOOLS|Idea Owassa Academy": "IDEAOWASSA",
  "IDEA PUBLIC SCHOOLS|Prep": "IDEAOWASSA",
  "IDEA PUBLIC SCHOOLS|IDEAOWASSA": "IDEAOWASSA",
  "IDEA PUBLIC SCHOOLS|IDEA Pharr College Prep": "IDEAPHARR",
  "INDEPENDENT|Independent": "INDEPENDENT",
  "LA JOYA ISD|LJ Camarena Elem.": "LJCAMARENA",
  "LA JOYA ISD|LA JOYA HIGH SCHOOL": "LJHIGH",
  "LA JOYA ISD|Elementary": "LJMENDIOLA",
  "LA JOYA ISD|Thelma Salinas ECHS": "LJSALINAS",
  "LA JOYA ISD|Thelma R. Salinas": "LJBALINAS",
  "MCALLEN ISD|AECHS": "MCACHEVE",
  "MCALLEN ISD|Castaneda": "MCCASTANEDA",
  "MCALLEN ISD|Cathey MS": "MCCATHEY",
  "MCALLEN ISD|McFossum": "MCFOSSUM",
  "MCALLEN ISD|Fossum Middle School": "MCFOSSUM",
  "MCALLEN ISD|Garza": "MCGARZA",
  "MCALLEN ISD|Gonzalez elementary": "MCGONZALEZ",
  "MCALLEN ISD|gonzalez": "MCGONZALEZ",
  "MCALLEN ISD|McHi": "MCHI",
  "MCALLEN ISD|Jackson Elementary": "MCJACKSON",
  "MCALLEN ISD|Lamar Academy": "MCLAMAR",
  "MCALLEN ISD|McAuliffe": "MCMCAULIFFE",
  "MCALLEN ISD|McAllen Memorial": "MCMEMORIAL",
  "MCALLEN ISD|Milam": "MCMILAM",
  "MCALLEN ISD|Morris": "MCMORRIS",
  "MCALLEN ISD|Perez Elem": "MCPEREZ",
  "MCALLEN ISD|Rayburn": "MCRAYDURN",
  "MCALLEN ISD|Roosevelt Elementary": "MCROOSEVELT",
  "MCALLEN ISD|Rowe High School": "MCROWE",
  "MCALLEN ISD|Blanca E Sanchez": "MCSANCHEZ",
  "MCALLEN ISD|Sanchez": "MCSANCHEZ",
  "MCALLEN ISD|Sanchez Elementary": "MCSANCHEZ",
  "MCALLEN ISD|SEGUIN ELEM.": "MCSEGUIN",
  "MCALLEN ISD|Sequin Elementary": "MCSEGUIN",
  "MISSION CISD|Mission Junior High": "MIJHS",
  "MISSION CISD|Mims Elem": "MIMIMS",
  "PHARR-SAN JUAN-ALAMO ISD|pending PO": "PSCARMAN",
  "PHARR-SAN JUAN-ALAMO ISD|Carman Elementary": "PSCARMAN",
  "PHARR-SAN JUAN-ALAMO ISD|of Health Professions": "PSCOLLEGIATE",
  "PHARR-SAN JUAN-ALAMO ISD|Collegiate School": "PSCOLLEGIATE",
  "PHARR-SAN JUAN-ALAMO ISD|Guerra": "PSGUERRA",
  "PHARR-SAN JUAN-ALAMO ISD|PSJA HIGH-Independent": "PSJAHIGH",
  "PHARR-SAN JUAN-ALAMO ISD|PSJA Southwest HS GT": "PSJASWECHS",
  "PHARR-SAN JUAN-ALAMO ISD|Independent team": "PSJASWECHS",
  "PHARR-SAN JUAN-ALAMO ISD|Kennedy Middle School": "PSKENNEDY",
  "PHARR-SAN JUAN-ALAMO ISD|Liberty INDep": "PSLIBERTY",
  "PHARR-SAN JUAN-ALAMO ISD|Liberty": "PSLIBERTY",
  "PHARR-SAN JUAN-ALAMO ISD|Elementary": "PSLIVAS",
  "PHARR-SAN JUAN-ALAMO ISD|R.Longoria": "PSLONGORIA",
  "PHARR-SAN JUAN-ALAMO ISD|Palmer Elementary": "PSPALMER",
  "PHARR-SAN JUAN-ALAMO ISD|Geraldine Palmer": "PSPALMER",
  "PHARR-SAN JUAN-ALAMO ISD|PSJA": "PSTREVINO",
  "PHARR-SAN JUAN-ALAMO ISD|INDTREVINO": "PSTREVINO",
  "PHARR-SAN JUAN-ALAMO ISD|T-STEM ECHS": "PSTSTEM",
  "PHARR-SAN JUAN-ALAMO ISD|T-STEM ECHS IND": "PSTSTEM",
  "SHARYLAND ISD|Bentsen Elementary": "SHBENTSEN",
  "SHARYLAND ISD|Bentsen": "SHBENTSEN",
  "SHARYLAND ISD|BL GRAY": "SHBLGRAY",
  "SHARYLAND ISD|BL Gray Middle school": "SHBLGRAY",
  "SHARYLAND ISD|Ruben Hinojosa": "SHHINOJOSA",
  "SHARYLAND ISD|Rubin Hinojosa": "SHHINOJOSA",
  "SHARYLAND ISD|Jessie Jensen": "SHJENSEN",
  "SHARYLAND ISD|Shary North Jr High": "SHNORTH",
  "SHARYLAND ISD|High": "SHNORTH",
  "SHARYLAND ISD|O. Garza Elem": "SHOGARZA",
  "SHARYLAND ISD|Sharyland Pioneer": "SHPIONEER",
  "SHARYLAND ISD|Romulo Martinez": "SHRDMARTINEZ",
  "SHARYLAND ISD|SA3": "SHSA3",
  "SHARYLAND ISD|SHS": "SHSA3",
  "SHARYLAND ISD|John H shary": "SHSHARY",
  "SHARYLAND ISD|John H. Shary": "SHSHARY",
  "SHARYLAND ISD|Shimotsu": "SHSHIMOTSU",
  "SHARYLAND ISD|Shimotsu Elem.": "SHSHIMOTSU",
  "SHARYLAND ISD|SHS": "SHSHS",
  "SOUTH TEXAS ISD|Med High - STISD": "STHEALTHPRO",
  "SOUTH TEXAS ISD|St. Johns": "STJOHNS",
  "SOUTH TEXAS ISD|Science Academy": "STSCIENCE",
  "SOUTH TEXAS ISD|STPA": "STSTPA",
  "SOUTH TEXAS ISD|South Texas Prepatory": "STSTPA",
  "SOUTH TEXAS ISD|World Scholars": "STWORLD",
  "VABEETHOVEN|vanguard beethoven": "VABEETHOVEN",
  "VABEETHOVEN|Beethoven": "VABEETHOVEN",
};


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

  // Check for specific overrides first
  const overrideKey = `${district}|${schoolName}`;
  if (teamCodeOverrides[overrideKey]) {
    return teamCodeOverrides[overrideKey];
  }
  
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

  const districtCode = district.substring(0, 2).toUpperCase();
  
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
