
import type { MasterPlayer } from './full-master-player-data';
import type { SponsorProfile } from '@/hooks/use-sponsor-profile';
import { type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

export type SearchCriteria = {
  // Search filters
  firstName?: string;
  lastName?: string;
  middleName?: string;
  uscfId?: string;
  school?: string;
  district?: string;
  grade?: string;
  section?: string;
  state?: string;
  minRating?: number;
  maxRating?: number;
  
  // Search options
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
  excludeIds?: string[];
  searchUnassigned?: boolean;
  sponsorProfile?: SponsorProfile | null;
  portalType?: 'sponsor' | 'organizer' | 'individual';
};

export type SearchResult = {
  players: MasterPlayer[];
  hasMore: boolean;
  totalFound: number;
  message?: string;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
};
