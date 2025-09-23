
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
  dateCreated?: string; // For compatibility
  createdBy?: string;
  dateUpdated?: string; // For compatibility
  updatedBy?: string;
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
export const fullMasterPlayerData: MasterPlayer[] = [];
