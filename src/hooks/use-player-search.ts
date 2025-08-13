'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMasterDb, type SearchCriteria, type MasterPlayer } from '@/context/master-db-context';
import { useSponsorProfile, type SponsorProfile } from './use-sponsor-profile';

type UsePlayerSearchProps = {
  initialFilters?: Partial<SearchCriteria>;
  maxResults?: number;
  excludeIds?: string[];
  searchUnassigned?: boolean;
  sponsorProfile?: SponsorProfile | null;
};

export function usePlayerSearch({
  initialFilters: initialFiltersProp = {},
  maxResults: initialMaxResults = 1000, // Set a higher default
  excludeIds,
  searchUnassigned,
  sponsorProfile,
}: UsePlayerSearchProps) {
  const { searchPlayers, isDbLoaded } = useMasterDb();
  
  const [filters, setFilters] = useState<Partial<SearchCriteria>>(initialFiltersProp);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);
  const [maxResults, setMaxResults] = useState<number>(initialMaxResults); // Remove undefined

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFiltersProp);
  }, [initialFiltersProp]);

  // Determine if there are any active, user-input filters.
  // We ignore default state filter for this check.
  const hasActiveFilters = useMemo(() => {
    const { state, ...restOfFilters } = filters;
    if (Object.keys(restOfFilters).length > 0) {
        return Object.values(restOfFilters).some(value => value !== undefined && value !== null && value !== '');
    }
    return false;
  }, [filters]);

  useEffect(() => {
    if (!isDbLoaded) return;
    
    if (!hasActiveFilters) {
        setSearchResults([]);
        return;
    }

    setIsLoading(true);

    const searchCriteria: SearchCriteria = {
      ...filters,
      excludeIds,
      maxResults, // This will now have a proper default value
      searchUnassigned,
      sponsorProfile,
    };
    
    console.log('Search criteria:', searchCriteria); // Add debugging
    
    // Using a timeout to debounce the search execution
    const handler = setTimeout(() => {
        const results = searchPlayers(searchCriteria);
        console.log('Raw search results count:', results.length); // Add debugging
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
