

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
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
  changeHistory?: {
    timestamp: string;
    userId: string;
    userName: string;
    changes: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  }[];

  // Add these new fields for potential matches
  potentialUscfMatch?: {
    uscfId: string;
    confidence: 'high' | 'medium' | 'low';
    matchedOn: string[];
    flaggedDate: string;
    reviewedBy?: string;
    reviewStatus?: 'pending' | 'confirmed' | 'rejected';
    uscfHistoryUrl?: string;
  };
};

// This is a placeholder for a much larger dataset.
// In a real application, this would be fetched from a server.
export const fullMasterPlayerData: MasterPlayer[] = [
    // This array will be programmatically expanded to include 11,324 players.
    // The following is just a small sample of the structure.
    {
        "id": "p1",
        "uscfId": "12345678",
        "firstName": "Alex",
        "lastName": "Ray",
        "state": "TX",
        "uscfExpiration": "2025-12-31T00:00:00.000Z",
        "regularRating": 1850,
        "grade": "10th Grade",
        "section": "High School K-12",
        "email": "alex.ray@example.com",
        "school": "SHARYLAND PIONEER H S",
        "district": "SHARYLAND ISD",
        "dob": "2008-05-10T00:00:00.000Z",
        "zipCode": "78572",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p2",
        "uscfId": "87654321",
        "firstName": "Jordan",
        "lastName": "Lee",
        "state": "TX",
        "uscfExpiration": "2023-01-15T00:00:00.000Z",
        "regularRating": 2100,
        "grade": "11th Grade",
        "section": "Championship",
        "email": "jordan.lee@example.com",
        "school": "MCALLEN H S",
        "district": "MCALLEN ISD",
        "dob": "2007-08-22T00:00:00.000Z",
        "zipCode": "78501",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p3",
        "uscfId": "11223344",
        "firstName": "Casey",
        "lastName": "Becker",
        "state": "TX",
        "uscfExpiration": "2025-06-01T00:00:00.000Z",
        "regularRating": 1500,
        "grade": "9th Grade",
        "section": "High School K-12",
        "email": "casey.becker@example.com",
        "school": "PSJA NORTH EARLY COLLEGE H S",
        "district": "PHARR-SAN JUAN-ALAMO ISD",
        "dob": "2009-02-14T00:00:00.000Z",
        "zipCode": "78577",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p4",
        "uscfId": "NEW",
        "firstName": "Morgan",
        "lastName": "Taylor",
        "state": "TX",
        "regularRating": 1000,
        "grade": "5th Grade",
        "section": "Elementary K-5",
        "email": "morgan.taylor@example.com",
        "school": "DR R E MARGO EL",
        "district": "WESLACO ISD",
        "dob": "2013-11-30T00:00:00.000Z",
        "zipCode": "78596",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p5",
        "uscfId": "55667788",
        "firstName": "Riley",
        "lastName": "Quinn",
        "state": "TX",
        "uscfExpiration": "2024-11-30T00:00:00.000Z",
        "regularRating": 1980,
        "grade": "11th Grade",
        "section": "Championship",
        "email": "riley.quinn@example.com",
        "school": "ECONOMEDES H S",
        "district": "EDINBURG CISD",
        "dob": "2007-03-25T00:00:00.000Z",
        "zipCode": "78540",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p6",
        "uscfId": "99887766",
        "firstName": "Skyler",
        "lastName": "Jones",
        "state": "TX",
        "uscfExpiration": "2025-02-28T00:00:00.000Z",
        "regularRating": 1650,
        "grade": "9th Grade",
        "section": "High School K-12",
        "email": "skyler.jones@example.com",
        "school": "HARLINGEN H S - SOUTH",
        "district": "HARLINGEN CISD",
        "dob": "2009-07-19T00:00:00.000Z",
        "zipCode": "78550",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p7",
        "uscfId": "11122233",
        "firstName": "Drew",
        "lastName": "Smith",
        "state": "TX",
        "uscfExpiration": "2023-10-01T00:00:00.000Z",
        "regularRating": 2050,
        "grade": "12th Grade",
        "section": "Championship",
        "email": "drew.smith@example.com",
        "school": "VETERANS MEMORIAL H S",
        "district": "BROWNSVILLE ISD",
        "dob": "2006-01-01T00:00:00.000Z",
        "zipCode": "78521",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p8",
        "uscfId": "22334455",
        "firstName": "Cameron",
        "lastName": "Williams",
        "state": "TX",
        "uscfExpiration": "2026-04-12T00:00:00.000Z",
        "regularRating": 1400,
        "grade": "8th Grade",
        "section": "Middle School K-8",
        "email": "cameron.w@example.com",
        "school": "B L GARZA MIDDLE",
        "district": "EDINBURG CISD",
        "dob": "2010-09-05T00:00:00.000Z",
        "zipCode": "78540",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p9",
        "uscfId": "33445566",
        "firstName": "Avery",
        "lastName": "Garcia",
        "state": "TX",
        "uscfExpiration": "2024-08-20T00:00:00.000Z",
        "regularRating": 1250,
        "grade": "7th Grade",
        "section": "Middle School K-8",
        "email": "avery.garcia@example.com",
        "school": "CATHEY MIDDLE",
        "district": "MCALLEN ISD",
        "dob": "2011-06-15T00:00:00.000Z",
        "zipCode": "78501",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p10",
        "uscfId": "44556677",
        "firstName": "Peyton",
        "lastName": "Martinez",
        "state": "TX",
        "uscfExpiration": "2025-05-05T00:00:00.000Z",
        "regularRating": 900,
        "grade": "4th Grade",
        "section": "Elementary K-5",
        "email": "peyton.m@example.com",
        "school": "JOHN H SHARY EL",
        "district": "SHARYLAND ISD",
        "dob": "2014-04-04T00:00:00.000Z",
        "zipCode": "78572",
        "events": 0,
        "eventIds": []
    },
    {
        "id": "p11",
        "uscfId": "12815593",
        "firstName": "ANTHONY",
        "middleName": "J",
        "lastName": "GUERRA",
        "state": "TX",
        "uscfExpiration": "2026-01-31T00:00:00.000Z",
        "regularRating": 1107,
        "grade": "8th Grade",
        "section": "Middle School K-8",
        "email": "anthony.guerra@example.com",
        "school": "MEMORIAL MIDDLE",
        "district": "EDINBURG CISD",
        "dob": "2010-02-18T00:00:00.000Z",
        "zipCode": "78540",
        "events": 0,
        "eventIds": []
    },
    // Test Data
    { "id": "90000001", "uscfId": "90000001", "firstName": "testFname1", "lastName": "testLname1", "middleName": "testMname1", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent1@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000002", "uscfId": "90000002", "firstName": "testFname2", "lastName": "testLname2", "middleName": "testMname2", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent2@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000003", "uscfId": "90000003", "firstName": "testFname3", "lastName": "testLname3", "middleName": "testMname3", "state": "TX", "regularRating": 103, "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent3@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000004", "uscfId": "90000004", "firstName": "testFname4", "lastName": "testLname4", "middleName": "testMname4", "state": "TX", "regularRating": 104, "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent4@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000005", "uscfId": "90000005", "firstName": "testFname5", "lastName": "testLname5", "middleName": "testMname5", "state": "TX", "regularRating": 105, "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent5@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000006", "uscfId": "90000006", "firstName": "testFname6", "lastName": "testLname6", "middleName": "testMname6", "state": "TX", "regularRating": 106, "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent6@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000007", "uscfId": "90000007", "firstName": "testFname7", "lastName": "testLname7", "middleName": "testMname7", "state": "TX", "regularRating": 107, "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent7@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000008", "uscfId": "90000008", "firstName": "testFname8", "lastName": "testLname8", "middleName": "testMname8", "state": "TX", "regularRating": 108, "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent8@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000009", "uscfId": "90000009", "firstName": "testFname9", "lastName": "testLname9", "middleName": "testMname9", "state": "TX", "regularRating": 109, "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent9@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] },
    { "id": "90000010", "uscfId": "90000010", "firstName": "testFname10", "lastName": "testLname10", "middleName": "testMname10", "state": "TX", "regularRating": 110, "grade": "9th Grade", "section": "High School K-12", "email": "teststudent10@test.com", "school": "TestMcAllen", "district": "TestMcAllen", "events": 0, "eventIds": [] }
];
