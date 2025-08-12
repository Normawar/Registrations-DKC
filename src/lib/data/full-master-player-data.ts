
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

export const fullMasterPlayerData: MasterPlayer[] = [];
