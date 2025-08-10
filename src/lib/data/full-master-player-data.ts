
export type MasterPlayer = {
  id: string;
  uscfId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  state?: string;
  uscfExpiration?: string; // ISO date string
  regularRating?: number;
  quickRating?: string;
  dob?: string; // ISO date string
  grade: string;
  section: string;
  email: string;
  phone?: string;
  zipCode?: string;
  studentType?: 'gt' | 'independent';
  school: string;
  district: string;
  events: number;
  eventIds: string[];
};

// This is a placeholder for the full master player data.
// In a real application, this would be fetched from a database.
export const fullMasterPlayerData: MasterPlayer[] = [
  {
    "id": "101",
    "uscfId": "30394851",
    "firstName": "Liam",
    "lastName": "Johnson",
    "state": "TX",
    "regularRating": 1850,
    "grade": "10th Grade",
    "section": "High School K-12",
    "email": "liam.johnson@example.com",
    "school": "Sharyland Pioneer H S",
    "district": "SHARYLAND ISD",
    "events": 5,
    "eventIds": ["1", "2", "3", "4", "5"]
  },
  {
    "id": "102",
    "uscfId": "30394852",
    "firstName": "Olivia",
    "lastName": "Smith",
    "state": "TX",
    "regularRating": 2100,
    "grade": "11th Grade",
    "section": "Championship",
    "email": "olivia.smith@example.com",
    "school": "Sharyland H S",
    "district": "SHARYLAND ISD",
    "events": 8,
    "eventIds": ["1", "2", "3", "4", "5", "6", "7", "8"]
  },
  {
    "id": "103",
    "uscfId": "30394853",
    "firstName": "Noah",
    "lastName": "Williams",
    "state": "TX",
    "regularRating": 1500,
    "grade": "9th Grade",
    "section": "High School K-12",
    "email": "noah.williams@example.com",
    "school": "McAllen H S",
    "district": "MCALLEN ISD",
    "events": 3,
    "eventIds": ["1", "3", "5"]
  },
  {
    "id": "104",
    "uscfId": "30394854",
    "firstName": "Emma",
    "lastName": "Brown",
    "state": "TX",
    "regularRating": 1000,
    "grade": "5th Grade",
    "section": "Elementary K-5",
    "email": "emma.brown@example.com",
    "school": "Gonzalez EL",
    "district": "MCALLEN ISD",
    "events": 2,
    "eventIds": ["2", "4"]
  },
  {
    "id": "105",
    "uscfId": "30394855",
    "firstName": "Oliver",
    "lastName": "Jones",
    "state": "TX",
    "regularRating": 1980,
    "grade": "11th Grade",
    "section": "Championship",
    "email": "oliver.jones@example.com",
    "school": "PSJA Memorial Early College H S",
    "district": "PHARR-SAN JUAN-ALAMO ISD",
    "events": 7,
    "eventIds": ["1", "2", "3", "4", "6", "7", "8"]
  },
  {
    "id": "106",
    "uscfId": "30394856",
    "firstName": "Ava",
    "lastName": "Garcia",
    "state": "TX",
    "regularRating": 1650,
    "grade": "9th Grade",
    "section": "High School K-12",
    "email": "ava.garcia@example.com",
    "school": "PSJA North Early College H S",
    "district": "PHARR-SAN JUAN-ALAMO ISD",
    "events": 4,
    "eventIds": ["2", "4", "6", "8"]
  },
  {
    "id": "107",
    "uscfId": "30394857",
    "firstName": "Elijah",
    "lastName": "Martinez",
    "state": "TX",
    "regularRating": 2050,
    "grade": "12th Grade",
    "section": "Championship",
    "email": "elijah.martinez@example.com",
    "school": "Edinburg H S",
    "district": "EDINBURG CISD",
    "events": 9,
    "eventIds": ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
  },
  {
    "id": "108",
    "uscfId": "30394858",
    "firstName": "Sophia",
    "lastName": "Rodriguez",
    "state": "CA",
    "regularRating": 1750,
    "grade": "10th Grade",
    "section": "High School K-12",
    "email": "sophia.rodriguez@example.com",
    "school": "Beverly Hills High School",
    "district": "BEVERLY HILLS USD",
    "events": 6,
    "eventIds": ["1", "2", "4", "5", "7", "8"]
  },
  {
    "id": "109",
    "uscfId": "30394859",
    "firstName": "James",
    "lastName": "Hernandez",
    "state": "FL",
    "regularRating": 1400,
    "grade": "8th Grade",
    "section": "Middle School K-8",
    "email": "james.hernandez@example.com",
    "school": "Pine Crest School",
    "district": "BROWARD COUNTY PUBLIC SCHOOLS",
    "events": 3,
    "eventIds": ["3", "6", "9"]
  },
  {
    "id": "110",
    "uscfId": "30394860",
    "firstName": "Isabella",
    "lastName": "Lopez",
    "state": "NY",
    "regularRating": 1950,
    "grade": "11th Grade",
    "section": "Championship",
    "email": "isabella.lopez@example.com",
    "school": "Stuyvesant High School",
    "district": "NEW YORK CITY GEOGRAPHIC DISTRICT # 2",
    "events": 8,
    "eventIds": ["1", "2", "3", "4", "5", "6", "7", "9"]
  },
  {
    "id": "111",
    "uscfId": "30394861",
    "firstName": "Benjamin",
    "lastName": "Gonzalez",
    "state": "TX",
    "regularRating": 1200,
    "grade": "7th Grade",
    "section": "Middle School K-8",
    "email": "benjamin.gonzalez@example.com",
    "school": "Cathey Middle",
    "district": "MCALLEN ISD",
    "events": 4,
    "eventIds": ["1", "4", "7", "9"]
  },
  {
    "id": "112",
    "uscfId": "30394862",
    "firstName": "Mia",
    "lastName": "Perez",
    "state": "TX",
    "regularRating": 900,
    "grade": "4th Grade",
    "section": "Elementary K-5",
    "email": "mia.perez@example.com",
    "school": "Garza EL",
    "district": "MCALLEN ISD",
    "events": 2,
    "eventIds": ["5", "8"]
  },
  {
    "id": "113",
    "uscfId": "30394863",
    "firstName": "Lucas",
    "lastName": "Sanchez",
    "state": "TX",
    "regularRating": 2200,
    "grade": "12th Grade",
    "section": "Championship",
    "email": "lucas.sanchez@example.com",
    "school": "Vela H S",
    "district": "EDINBURG CISD",
    "events": 10,
    "eventIds": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
  },
  {
    "id": "114",
    "uscfId": "30394864",
    "firstName": "Amelia",
    "lastName": "Rivera",
    "state": "TX",
    "regularRating": 1350,
    "grade": "8th Grade",
    "section": "Middle School K-8",
    "email": "amelia.rivera@example.com",
    "school": "B L Garza Middle",
    "district": "EDINBURG CISD",
    "events": 5,
    "eventIds": ["1", "3", "5", "7", "9"]
  },
  {
    "id": "115",
    "uscfId": "30394865",
    "firstName": "Henry",
    "lastName": "Gomez",
    "state": "TX",
    "regularRating": 1100,
    "grade": "6th Grade",
    "section": "Middle School K-8",
    "email": "henry.gomez@example.com",
    "school": "Memorial Middle",
    "district": "EDINBURG CISD",
    "events": 3,
    "eventIds": ["2", "6", "10"]
  },
  {
    "id": "116",
    "uscfId": "30394866",
    "firstName": "Evelyn",
    "lastName": "Diaz",
    "state": "TX",
    "regularRating": 800,
    "grade": "3rd Grade",
    "section": "Primary K-3",
    "email": "evelyn.diaz@example.com",
    "school": "Dr William Long EL",
    "district": "PHARR-SAN JUAN-ALAMO ISD",
    "events": 1,
    "eventIds": ["4"]
  },
  {
    "id": "117",
    "uscfId": "30394867",
    "firstName": "Alexander",
    "lastName": "Reyes",
    "state": "CA",
    "regularRating": 2000,
    "grade": "11th Grade",
    "section": "Championship",
    "email": "alexander.reyes@example.com",
    "school": "Whitney High School",
    "district": "ABC UNIFIED SCHOOL DISTRICT",
    "events": 7,
    "eventIds": ["1", "3", "4", "6", "7", "8", "10"]
  },
  {
    "id": "118",
    "uscfId": "30394868",
    "firstName": "Harper",
    "lastName": "Cruz",
    "state": "FL",
    "regularRating": 1550,
    "grade": "9th Grade",
    "section": "High School K-12",
    "email": "harper.cruz@example.com",
    "school": "American Heritage School",
    "district": "BROWARD COUNTY PUBLIC SCHOOLS",
    "events": 5,
    "eventIds": ["2", "4", "6", "8", "10"]
  },
  {
    "id": "119",
    "uscfId": "30394869",
    "firstName": "Sebastian",
    "lastName": "Morales",
    "state": "NY",
    "regularRating": 1800,
    "grade": "10th Grade",
    "section": "High School K-12",
    "email": "sebastian.morales@example.com",
    "school": "Bronx High School of Science",
    "district": "NEW YORK CITY GEOGRAPHIC DISTRICT #10",
    "events": 6,
    "eventIds": ["1", "3", "5", "7", "9", "10"]
  },
  {
    "id": "120",
    "uscfId": "30394870",
    "firstName": "Abigail",
    "lastName": "Gutierrez",
    "state": "TX",
    "regularRating": 1250,
    "grade": "7th Grade",
    "section": "Middle School K-8",
    "email": "abigail.gutierrez@example.com",
    "school": "Stillman Middle",
    "district": "BROWNSVILLE ISD",
    "events": 4,
    "eventIds": ["2", "5", "8", "10"]
  },
  {
    "id": "121",
    "uscfId": "30394871",
    "firstName": "Michael",
    "lastName": "Ortiz",
    "state": "TX",
    "regularRating": 1050,
    "grade": "5th Grade",
    "section": "Elementary K-5",
    "email": "michael.ortiz@example.com",
    "school": "Gonzalez EL",
    "district": "BROWNSVILLE ISD",
    "events": 2,
    "eventIds": ["1", "9"]
  },
  {
    "id": "122",
    "uscfId": "30394872",
    "firstName": "Emily",
    "lastName": "Castillo",
    "state": "TX",
    "regularRating": 1900,
    "grade": "11th Grade",
    "section": "Championship",
    "email": "emily.castillo@example.com",
    "school": "Los Fresnos H S",
    "district": "LOS FRESNOS CISD",
    "events": 8,
    "eventIds": ["1", "2", "3", "5", "6", "7", "8", "10"]
  },
  {
    "id": "123",
    "uscfId": "30394873",
    "firstName": "Daniel",
    "lastName": "Jimenez",
    "state": "TX",
    "regularRating": 1600,
    "grade": "9th Grade",
    "section": "High School K-12",
    "email": "daniel.jimenez@example.com",
    "school": "Harlingen H S",
    "district": "HARLINGEN CISD",
    "events": 5,
    "eventIds": ["2", "4", "6", "8", "10"]
  }
]
