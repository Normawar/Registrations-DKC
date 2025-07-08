
export type MasterPlayer = {
  id: string;
  uscfId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  state?: string;
  uscfExpiration?: string;
  regularRating?: number;
  quickRating?: string;
  school: string;
  district: string;
  events: number;
  eventIds: string[];
};

export const initialMasterPlayerData: MasterPlayer[] = [
  { id: "p-12345678", uscfId: "12345678", firstName: "Liam", middleName: "J", lastName: "Johnson", regularRating: 1850, quickRating: '1900/10', uscfExpiration: '2025-12-31T00:00:00.000Z', state: 'TX', school: "Independent", district: "None", events: 2, eventIds: ['e2'] },
  { id: "p-87654321", uscfId: "87654321", firstName: "Olivia", middleName: "K", lastName: "Smith", regularRating: 2100, quickRating: '2120/5', uscfExpiration: '2026-06-30T00:00:00.000Z', state: 'CA', school: "City Chess Club", district: "None", events: 3, eventIds: ['e1', 'e3'] },
  { id: "p-11223344", uscfId: "11223344", firstName: "Noah", middleName: "L", lastName: "Williams", regularRating: 1600, quickRating: '1650/12', uscfExpiration: '2025-01-01T00:00:00.000Z', state: 'NY', school: "Scholastic Stars", district: "None", events: 1, eventIds: ['e1'] },
  { id: "p-44332211", uscfId: "44332211", firstName: "Emma", middleName: "M", lastName: "Brown", regularRating: 1950, quickRating: '2000/20', uscfExpiration: '2025-03-15T00:00:00.000Z', state: 'FL', school: "Independent", district: "None", events: 1, eventIds: ['e2'] },
  { id: "p-55667788", uscfId: "55667788", firstName: "James", middleName: "N", lastName: "Jones", regularRating: 2200, quickRating: '2250/15', uscfExpiration: '2024-11-20T00:00:00.000Z', state: 'IL', school: "Grandmasters Inc.", district: "None", events: 4, eventIds: ['e1', 'e2', 'e3'] },
  { id: "p-98765432", uscfId: "98765432", firstName: "Alex", middleName: "S", lastName: "Ray", regularRating: 1750, quickRating: '1780/8', uscfExpiration: '2025-08-01T00:00:00.000Z', state: 'TX', school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 2, eventIds: ['e1'] },
  { id: "p-23456789", uscfId: "23456789", firstName: "Jordan", middleName: "T", lastName: "Lee", regularRating: 2050, quickRating: '2080/7', uscfExpiration: '2024-09-09T00:00:00.000Z', state: 'TX', school: "SHARYLAND PIONEER H S", district: "SHARYLAND ISD", events: 3, eventIds: ['e1', 'e2'] },
];
