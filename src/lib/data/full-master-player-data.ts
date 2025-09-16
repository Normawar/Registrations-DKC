

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
    { "id": "90000010", "uscfId": "90000010", "firstName": "testFname10", "lastName": "testLname10", "middleName": "testMname10", "state": "TX", "regularRating": 110, "grade": "9th Grade", "section": "High School K-12", "email": "teststudent10@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000011", "uscfId": "90000011", "firstName": "Liam", "lastName": "TestSmith", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent11@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000012", "uscfId": "90000012", "firstName": "Olivia", "lastName": "TestJohnson", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent12@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000013", "uscfId": "90000013", "firstName": "Noah", "lastName": "TestWilliams", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent13@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000014", "uscfId": "90000014", "firstName": "Emma", "lastName": "TestBrown", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent14@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000015", "uscfId": "90000015", "firstName": "Oliver", "lastName": "TestJones", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent15@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000016", "uscfId": "90000016", "firstName": "Ava", "lastName": "TestGarcia", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent16@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000017", "uscfId": "90000017", "firstName": "Elijah", "lastName": "TestMiller", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent17@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000018", "uscfId": "90000018", "firstName": "Charlotte", "lastName": "TestDavis", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent18@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000019", "uscfId": "90000019", "firstName": "William", "lastName": "TestRodriguez", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent19@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000020", "uscfId": "90000020", "firstName": "Sophia", "lastName": "TestMartinez", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent20@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000021", "uscfId": "90000021", "firstName": "James", "lastName": "TestSmith", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent21@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000022", "uscfId": "90000022", "firstName": "Amelia", "lastName": "TestJohnson", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent22@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000023", "uscfId": "90000023", "firstName": "Benjamin", "lastName": "TestWilliams", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent23@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000024", "uscfId": "90000024", "firstName": "Isabella", "lastName": "TestBrown", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent24@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000025", "uscfId": "90000025", "firstName": "Lucas", "lastName": "TestJones", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent25@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000026", "uscfId": "90000026", "firstName": "Mia", "lastName": "TestGarcia", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent26@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000027", "uscfId": "90000027", "firstName": "Henry", "lastName": "TestMiller", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent27@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000028", "uscfId": "90000028", "firstName": "Evelyn", "lastName": "TestDavis", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent28@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000029", "uscfId": "90000029", "firstName": "Alexander", "lastName": "TestRodriguez", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent29@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000030", "uscfId": "90000030", "firstName": "Harper", "lastName": "TestMartinez", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent30@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000031", "uscfId": "90000031", "firstName": "Liam", "lastName": "TestSmith", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent31@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000032", "uscfId": "90000032", "firstName": "Olivia", "lastName": "TestJohnson", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent32@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000033", "uscfId": "90000033", "firstName": "Noah", "lastName": "TestWilliams", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent33@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000034", "uscfId": "90000034", "firstName": "Emma", "lastName": "TestBrown", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent34@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000035", "uscfId": "90000035", "firstName": "Oliver", "lastName": "TestJones", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent35@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000036", "uscfId": "90000036", "firstName": "Ava", "lastName": "TestGarcia", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent36@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000037", "uscfId": "90000037", "firstName": "Elijah", "lastName": "TestMiller", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent37@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000038", "uscfId": "90000038", "firstName": "Charlotte", "lastName": "TestDavis", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent38@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000039", "uscfId": "90000039", "firstName": "William", "lastName": "TestRodriguez", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent39@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000040", "uscfId": "90000040", "firstName": "Sophia", "lastName": "TestMartinez", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent40@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000041", "uscfId": "90000041", "firstName": "James", "lastName": "TestSmith", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent41@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000042", "uscfId": "90000042", "firstName": "Amelia", "lastName": "TestJohnson", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent42@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000043", "uscfId": "90000043", "firstName": "Benjamin", "lastName": "TestWilliams", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent43@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000044", "uscfId": "90000044", "firstName": "Isabella", "lastName": "TestBrown", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent44@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000045", "uscfId": "90000045", "firstName": "Lucas", "lastName": "TestJones", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent45@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000046", "uscfId": "90000046", "firstName": "Mia", "lastName": "TestGarcia", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent46@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000047", "uscfId": "90000047", "firstName": "Henry", "lastName": "TestMiller", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent47@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000048", "uscfId": "90000048", "firstName": "Evelyn", "lastName": "TestDavis", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent48@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000049", "uscfId": "90000049", "firstName": "Alexander", "lastName": "TestRodriguez", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent49@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000050", "uscfId": "90000050", "firstName": "Harper", "lastName": "TestMartinez", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent50@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000051", "uscfId": "90000051", "firstName": "Liam", "lastName": "TestSmith", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent51@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000052", "uscfId": "90000052", "firstName": "Olivia", "lastName": "TestJohnson", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent52@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000053", "uscfId": "90000053", "firstName": "Noah", "lastName": "TestWilliams", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent53@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000054", "uscfId": "90000054", "firstName": "Emma", "lastName": "TestBrown", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent54@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000055", "uscfId": "90000055", "firstName": "Oliver", "lastName": "TestJones", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent55@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000056", "uscfId": "90000056", "firstName": "Ava", "lastName": "TestGarcia", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent56@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000057", "uscfId": "90000057", "firstName": "Elijah", "lastName": "TestMiller", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent57@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000058", "uscfId": "90000058", "firstName": "Charlotte", "lastName": "TestDavis", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent58@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000059", "uscfId": "90000059", "firstName": "William", "lastName": "TestRodriguez", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent59@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000060", "uscfId": "90000060", "firstName": "Sophia", "lastName": "TestMartinez", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent60@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000061", "uscfId": "90000061", "firstName": "James", "lastName": "TestSmith", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent61@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000062", "uscfId": "90000062", "firstName": "Amelia", "lastName": "TestJohnson", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent62@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000063", "uscfId": "90000063", "firstName": "Benjamin", "lastName": "TestWilliams", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent63@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000064", "uscfId": "90000064", "firstName": "Isabella", "lastName": "TestBrown", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent64@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000065", "uscfId": "90000065", "firstName": "Lucas", "lastName": "TestJones", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent65@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000066", "uscfId": "90000066", "firstName": "Mia", "lastName": "TestGarcia", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent66@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000067", "uscfId": "90000067", "firstName": "Henry", "lastName": "TestMiller", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent67@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000068", "uscfId": "90000068", "firstName": "Evelyn", "lastName": "TestDavis", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent68@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000069", "uscfId": "90000069", "firstName": "Alexander", "lastName": "TestRodriguez", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent69@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000070", "uscfId": "90000070", "firstName": "Harper", "lastName": "TestMartinez", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent70@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000071", "uscfId": "90000071", "firstName": "Liam", "lastName": "TestSmith", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent71@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000072", "uscfId": "90000072", "firstName": "Olivia", "lastName": "TestJohnson", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent72@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000073", "uscfId": "90000073", "firstName": "Noah", "lastName": "TestWilliams", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent73@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000074", "uscfId": "90000074", "firstName": "Emma", "lastName": "TestBrown", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent74@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000075", "uscfId": "90000075", "firstName": "Oliver", "lastName": "TestJones", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent75@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000076", "uscfId": "90000076", "firstName": "Ava", "lastName": "TestGarcia", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent76@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000077", "uscfId": "90000077", "firstName": "Elijah", "lastName": "TestMiller", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent77@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000078", "uscfId": "90000078", "firstName": "Charlotte", "lastName": "TestDavis", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent78@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000079", "uscfId": "90000079", "firstName": "William", "lastName": "TestRodriguez", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent79@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000080", "uscfId": "90000080", "firstName": "Sophia", "lastName": "TestMartinez", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent80@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000081", "uscfId": "90000081", "firstName": "James", "lastName": "TestSmith", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent81@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000082", "uscfId": "90000082", "firstName": "Amelia", "lastName": "TestJohnson", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent82@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000083", "uscfId": "90000083", "firstName": "Benjamin", "lastName": "TestWilliams", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent83@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000084", "uscfId": "90000084", "firstName": "Isabella", "lastName": "TestBrown", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent84@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000085", "uscfId": "90000085", "firstName": "Lucas", "lastName": "TestJones", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent85@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000086", "uscfId": "90000086", "firstName": "Mia", "lastName": "TestGarcia", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent86@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000087", "uscfId": "90000087", "firstName": "Henry", "lastName": "TestMiller", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent87@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000088", "uscfId": "90000088", "firstName": "Evelyn", "lastName": "TestDavis", "state": "TX", "grade": "9th Grade", "section": "High School K-12", "email": "teststudent88@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000089", "uscfId": "90000089", "firstName": "Alexander", "lastName": "TestRodriguez", "state": "TX", "grade": "10th Grade", "section": "High School K-12", "email": "teststudent89@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000090", "uscfId": "90000090", "firstName": "Harper", "lastName": "TestMartinez", "state": "TX", "grade": "11th Grade", "section": "High School K-12", "email": "teststudent90@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000091", "uscfId": "90000091", "firstName": "Liam", "lastName": "TestSmith", "state": "TX", "grade": "12th Grade", "section": "High School K-12", "email": "teststudent91@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000092", "uscfId": "90000092", "firstName": "Olivia", "lastName": "TestJohnson", "state": "TX", "grade": "Kindergarten", "section": "Kinder-1st", "email": "teststudent92@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000093", "uscfId": "90000093", "firstName": "Noah", "lastName": "TestWilliams", "state": "TX", "grade": "1st Grade", "section": "Kinder-1st", "email": "teststudent93@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000094", "uscfId": "90000094", "firstName": "Emma", "lastName": "TestBrown", "state": "TX", "grade": "2nd Grade", "section": "Primary K-3", "email": "teststudent94@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000095", "uscfId": "90000095", "firstName": "Oliver", "lastName": "TestJones", "state": "TX", "grade": "3rd Grade", "section": "Primary K-3", "email": "teststudent95@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000096", "uscfId": "90000096", "firstName": "Ava", "lastName": "TestGarcia", "state": "TX", "grade": "4th Grade", "section": "Elementary K-5", "email": "teststudent96@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000097", "uscfId": "90000097", "firstName": "Elijah", "lastName": "TestMiller", "state": "TX", "grade": "5th Grade", "section": "Elementary K-5", "email": "teststudent97@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000098", "uscfId": "90000098", "firstName": "Charlotte", "lastName": "TestDavis", "state": "TX", "grade": "6th Grade", "section": "Middle School K-8", "email": "teststudent98@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000099", "uscfId": "90000099", "firstName": "William", "lastName": "TestRodriguez", "state": "TX", "grade": "7th Grade", "section": "Middle School K-8", "email": "teststudent99@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] },
    { "id": "90000100", "uscfId": "90000100", "firstName": "Sophia", "lastName": "TestMartinez", "state": "TX", "grade": "8th Grade", "section": "Middle School K-8", "email": "teststudent100@test.com", "school": "Test School", "district": "Test District", "events": 0, "eventIds": [] }
];
