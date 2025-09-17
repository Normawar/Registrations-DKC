

export type SchoolNote = {
  id: string;
  type: 'lesson' | 'general';
  title: string;
  content: string;
  timestamp: string; // ISO date string
  poFileUrl?: string;
  poFileName?: string;
};

export type School = {
  district: string;
  schoolName: string;
  streetAddress: string;
  city: string;
  zip: string;
  zip4: string;
  phone: string;
  charter: string;
  students: string;
  state: string;
  county: string;
  notes?: SchoolNote[];
  teamCode?: string;
};

export const schoolData: School[] = [
  { "district": "TestShary", "schoolName": "Test B L GRAY J H", "streetAddress": "1106 N SHARY RD", "city": "MISSION", "zip": "78572", "zip4": "4652", "phone": "(956)580-5333", "charter": "No", "students": "743", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestShary", "schoolName": "Test DONNA WERNECKE EL", "streetAddress": "1106 N SHARY RD", "city": "MISSION", "zip": "78572", "zip4": "", "phone": "(956)928-1063", "charter": "No", "students": "672", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestMcAllen", "schoolName": "Test ACHIEVE EARLY COLLEGE H S", "streetAddress": "1601 N 27TH ST", "city": "MCALLEN", "zip": "78501", "zip4": "2000", "phone": "(956)971-4200", "charter": "No", "students": "410", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestMcAllen", "schoolName": "Test Alvarez EL", "streetAddress": "2606 GUMWOOD AVE", "city": "MCALLEN", "zip": "78501", "zip4": "7554", "phone": "(956)971-4471", "charter": "No", "students": "450", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestECISD", "schoolName": "Test HIDALGO CO J J A E P", "streetAddress": "3100 S HWY 281 P O BOX 267", "city": "EDINBURG", "zip": "78540", "zip4": "267", "phone": "(956)381-8600", "charter": "No", "students": "2", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestECISD", "schoolName": "Test Alfonso Ramirez EL", "streetAddress": "P O BOX 990", "city": "EDINBURG", "zip": "78540", "zip4": "990", "phone": "(956)289-2425", "charter": "No", "students": "719", "state": "TX", "county": "Hidalgo County" },
  { "district": "TestMcAllen", "schoolName": "TestMcAllen", "streetAddress": "123 Test St", "city": "McAllen", "zip": "78501", "zip4": "", "phone": "(555)555-5555", "charter": "No", "students": "0", "state": "TX", "county": "Test" },
  { "district": "TestECISD", "schoolName": "Test Carmen Avila Elementary", "streetAddress": "123 Test St", "city": "Edinburg", "zip": "78540", "zip4": "", "phone": "(555)555-5555", "charter": "No", "students": "0", "state": "TX", "county": "Test" }
]
