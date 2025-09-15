

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
    // Test Data - Explicitly keep only these records
    { "id": "90000001", "uscfId": "90000001", "firstName": "testFname1", "lastName": "testLname1", "middleName": "testMname1", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent1@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000002", "uscfId": "90000002", "firstName": "testFname2", "lastName": "testLname2", "middleName": "testMname2", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent2@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000003", "uscfId": "90000003", "firstName": "testFname3", "lastName": "testLname3", "middleName": "testMname3", "state": "TX", "regularRating": 103, "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent3@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000004", "uscfId": "90000004", "firstName": "testFname4", "lastName": "testLname4", "middleName": "testMname4", "state": "TX", "regularRating": 104, "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent4@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000005", "uscfId": "90000005", "firstName": "testFname5", "lastName": "testLname5", "middleName": "testMname5", "state": "TX", "regularRating": 105, "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent5@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000006", "uscfId": "90000006", "firstName": "testFname6", "lastName": "testLname6", "middleName": "testMname6", "state": "TX", "regularRating": 106, "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent6@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000007", "uscfId": "90000007", "firstName": "testFname7", "lastName": "testLname7", "middleName": "testMname7", "state": "TX", "regularRating": 107, "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent7@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000008", "uscfId": "90000008", "firstName": "testFname8", "lastName": "testLname8", "middleName": "testMname8", "state": "TX", "regularRating": 108, "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent8@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000009", "uscfId": "90000009", "firstName": "testFname9", "lastName": "testLname9", "middleName": "testMname9", "state": "TX", "regularRating": 109, "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent9@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000010", "uscfId": "90000010", "firstName": "testFname10", "lastName": "testLname10", "middleName": "testMname10", "state": "TX", "regularRating": 110, "grade": "9th Grade", "section": "High School K-12", "email": "teststudent10@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] }
];
