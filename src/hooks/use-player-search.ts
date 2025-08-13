
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMasterDb, type SearchCriteria, type MasterPlayer } from '@/context/master-db-context';
import type { SponsorProfile } from './use-sponsor-profile';

type UsePlayerSearchProps = {
  initialFilters?: Partial<SearchCriteria>;
  maxResults?: number;
  excludeIds?: string[];
  searchUnassigned?: boolean;
  sponsorProfile?: SponsorProfile | null;
};

export function usePlayerSearch({
  initialFilters = {},
  maxResults: initialMaxResults,
  excludeIds,
  searchUnassigned,
  sponsorProfile,
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

  // Determine if there are any active, user-input filters, ignoring defaults.
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => value !== undefined && value !== null && value !== '' && value !== 'ALL');
  }, [filters]);
  
  useEffect(() => {
    if (!isDbLoaded) return;
    
    // Only trigger a search if there's an active filter from user input.
    if (!hasActiveFilters) {
        setSearchResults([]);
        return;
    }

    setIsLoading(true);

    const searchCriteria: SearchCriteria = {
      ...filters,
      excludeIds,
      maxResults,
      searchUnassigned,
      sponsorProfile,
    };
    
    // Using a timeout to debounce the search execution
    const handler = setTimeout(() => {
        const results = searchPlayers(searchCriteria);
        setSearchResults(results);
        setIsLoading(false);
    }, 300); // 300ms debounce delay

    return () => {
        clearTimeout(handler);
    };

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
