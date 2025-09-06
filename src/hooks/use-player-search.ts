'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMasterDb, type SearchCriteria, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile, type SponsorProfile } from './use-sponsor-profile';

type UsePlayerSearchProps = {
  initialFilters?: Partial<SearchCriteria>;
  maxResults?: number;
  excludeIds?: string[];
  searchUnassigned?: boolean;
  sponsorProfile?: SponsorProfile | null;
  portalType: 'sponsor' | 'organizer' | 'individual';
};

export function usePlayerSearch({
  initialFilters: initialFiltersProp = {},
  maxResults: initialMaxResults = 1000,
  excludeIds,
  searchUnassigned,
  sponsorProfile,
  portalType,
}: UsePlayerSearchProps) {
  const { searchPlayers, isDbLoaded } = useMasterDb();
  
  const [filters, setFilters] = useState<Partial<SearchCriteria>>(initialFiltersProp);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);
  const [maxResults, setMaxResults] = useState<number>(initialMaxResults);

  // Use refs to track the latest values without causing re-renders
  const excludeIdsRef = useRef(excludeIds);
  const searchUnassignedRef = useRef(searchUnassigned);
  const sponsorProfileRef = useRef(sponsorProfile);
  const portalTypeRef = useRef(portalType);

  // Update refs when props change
  useEffect(() => {
    excludeIdsRef.current = excludeIds;
  }, [excludeIds]);

  useEffect(() => {
    searchUnassignedRef.current = searchUnassigned;
  }, [searchUnassigned]);

  useEffect(() => {
    sponsorProfileRef.current = sponsorProfile;
  }, [sponsorProfile]);

  useEffect(() => {
    portalTypeRef.current = portalType;
  }, [portalType]);

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFiltersProp);
  }, [initialFiltersProp]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
        if (key === 'state') {
            return value && value !== 'ALL' && value !== '';
        }
        return value !== undefined && value !== null && value !== '';
    });
  }, [filters]);

  // Stabilize the search with minimal dependencies
  useEffect(() => {
    if (!isDbLoaded || !hasActiveFilters) {
        setSearchResults([]);
        return;
    }
    
    setIsLoading(true);
    
    const handler = setTimeout(() => {
        const searchCriteria: SearchCriteria = {
          ...filters,
          excludeIds: excludeIdsRef.current,
          maxResults,
          searchUnassigned: searchUnassignedRef.current,
          sponsorProfile: sponsorProfileRef.current,
          portalType: portalTypeRef.current,
        };
        
        const results = searchPlayers(searchCriteria);
        setSearchResults(results);
        setIsLoading(false);
    }, 300);
    
    return () => {
        clearTimeout(handler);
    };
  }, [filters, isDbLoaded, maxResults, hasActiveFilters, searchPlayers]); // searchPlayers is now stable
  
  const hasResults = searchResults.length > 0;

  return {
    filters,
    updateFilter,
    clearFilters,
    searchResults,
    isLoading,
    hasResults,
    hasActiveFilters,
    setMaxResults
  };
}
