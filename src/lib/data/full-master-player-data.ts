
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
  { "id": "12417823", "uscfId": "12417823", "lastName": "GUERRA", "firstName": "GABRIEL", "middleName": "A", "state": "TX", "uscfExpiration": "2024-12-31T00:00:00.000Z", "regularRating": 1818, "quickRating": "1719", "grade": "11th Grade", "section": "Championship", "school": "SHARYLAND PIONEER H S", "district": "SHARYLAND ISD", "email": "gabriel.guerra@example.com", "dob": "2007-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12731816", "uscfId": "12731816", "lastName": "GUERRA", "firstName": "KALI", "middleName": "A", "state": "TX", "uscfExpiration": "2025-01-31T00:00:00.000Z", "regularRating": 1419, "quickRating": "1349", "grade": "10th Grade", "section": "High School K-12", "school": "SHARYLAND PIONEER H S", "district": "SHARYLAND ISD", "email": "kali.guerra@example.com", "dob": "2008-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12729910", "uscfId": "12729910", "lastName": "CAVAZOS", "firstName": "XIMENA", "middleName": "A", "state": "TX", "uscfExpiration": "2024-10-31T00:00:00.000Z", "regularRating": 1387, "quickRating": "1275", "grade": "9th Grade", "section": "High School K-12", "school": "SHARYLAND PIONEER H S", "district": "SHARYLAND ISD", "email": "ximena.cavazos@example.com", "dob": "2009-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12729909", "uscfId": "12729909", "lastName": "CAVAZOS", "firstName": "LUIS", "middleName": "F", "state": "TX", "uscfExpiration": "2024-10-31T00:00:00.000Z", "regularRating": 1332, "quickRating": "1290", "grade": "9th Grade", "section": "High School K-12", "school": "SHARYLAND PIONEER H S", "district": "SHARYLAND ISD", "email": "luis.cavazos@example.com", "dob": "2009-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12742917", "uscfId": "12742917", "lastName": "SALAZAR", "firstName": "ANTHONY", "middleName": "", "state": "TX", "uscfExpiration": "2024-12-31T00:00:00.000Z", "regularRating": 1289, "quickRating": "1200", "grade": "11th Grade", "section": "Championship", "school": "SHARYLAND PIONEER H S", "district": "SHARYLAND ISD", "email": "anthony.salazar@example.com", "dob": "2007-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12742918", "uscfId": "12742918", "lastName": "GONZALEZ", "firstName": "DIEGO", "middleName": "", "state": "TX", "uscfExpiration": "2025-03-31T00:00:00.000Z", "regularRating": 1100, "quickRating": "1050", "grade": "8th Grade", "section": "Middle School K-8", "school": "B L GRAY J H", "district": "SHARYLAND ISD", "email": "diego.gonzalez@example.com", "dob": "2010-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] },
  { "id": "12742919", "uscfId": "12742919", "lastName": "REYES", "firstName": "SOFIA", "middleName": "", "state": "TX", "uscfExpiration": "2024-08-31T00:00:00.000Z", "regularRating": 950, "quickRating": "900", "grade": "7th Grade", "section": "Middle School K-8", "school": "B L GRAY J H", "district": "SHARYLAND ISD", "email": "sofia.reyes@example.com", "dob": "2011-01-01T00:00:00.000Z", "zipCode": "78572", "events": 0, "eventIds": [] }
];
