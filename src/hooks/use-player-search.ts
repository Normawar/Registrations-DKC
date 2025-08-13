
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMasterDb, type SearchCriteria, type MasterPlayer } from '@/context/master-db-context';
import type { SponsorProfile } from './use-sponsor-profile';

type UsePlayerSearchProps = {
  initialFilters?: Partial<SearchCriteria>;
  maxResults?: number;
  excludeIds?: string[];
  searchUnassigned?: boolean; // New prop for sponsor search
  sponsorProfile?: SponsorProfile | null;
};

export function usePlayerSearch({
  initialFilters = {},
  maxResults: initialMaxResults,
  excludeIds,
  searchUnassigned = false,
  sponsorProfile = null,
}: UsePlayerSearchProps) {
  const { searchPlayers, isDbLoaded } = useMasterDb();
  const [filters, setFilters] = useState<Partial<SearchCriteria>>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);
  const [maxResults, setMaxResults] = useState<number | undefined>(initialMaxResults);

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const hasActiveFilters = useMemo(() => {
      return Object.entries(filters).some(([key, value]) => {
          if (initialFilters.hasOwnProperty(key) && initialFilters[key as keyof SearchCriteria] === value) {
              return false;
          }
          return value !== undefined && value !== null && value !== '' && value !== 'ALL';
      });
  }, [filters, initialFilters]);
  
  useEffect(() => {
    if (!isDbLoaded) return;
    
    // De-activate search if no active filters are present.
    if (!hasActiveFilters) {
        setSearchResults([]);
        return;
    }

    setIsLoading(true);
    const results = searchPlayers({
      ...filters,
      excludeIds,
      maxResults,
      searchUnassigned: searchUnassigned,
      sponsorProfile: sponsorProfile,
    });
    setSearchResults(results);
    setIsLoading(false);

  }, [filters, searchPlayers, isDbLoaded, maxResults, hasActiveFilters, excludeIds, searchUnassigned, sponsorProfile]);
  
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
