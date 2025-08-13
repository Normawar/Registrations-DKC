
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
  maxResults: initialMaxResults = 1000,
  excludeIds,
  searchUnassigned,
  sponsorProfile,
}: UsePlayerSearchProps) {
  const { searchPlayers, isDbLoaded } = useMasterDb();
  
  const [filters, setFilters] = useState<Partial<SearchCriteria>>(initialFiltersProp);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);
  const [maxResults, setMaxResults] = useState<number>(initialMaxResults);

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFiltersProp);
  }, [initialFiltersProp]);

  const hasActiveFilters = useMemo(() => {
    // Check if any filter has a meaningful value (not empty, undefined, null, or default 'ALL')
    return Object.entries(filters).some(([key, value]) => {
        if (key === 'state') {
            // State is active if it's not empty, undefined, null, or 'ALL'
            return value && value !== 'ALL' && value !== '';
        }
        // For other filters, they're active if they have any non-empty value
        return value !== undefined && value !== null && value !== '';
    });
  }, [filters]);

  useEffect(() => {
    console.log('🔍 useEffect triggered');
    console.log('isDbLoaded:', isDbLoaded);
    console.log('hasActiveFilters:', hasActiveFilters);
    console.log('filters:', filters);
    
    if (!isDbLoaded) {
        console.log('❌ Exiting: DB not loaded');
        return;
    }
    
    if (!hasActiveFilters) {
        console.log('❌ Exiting: No active filters');
        setSearchResults([]);
        return;
    }

    console.log('✅ About to run search');
    setIsLoading(true);

    const searchCriteria: SearchCriteria = {
      ...filters,
      excludeIds,
      maxResults,
      searchUnassigned,
      sponsorProfile,
    };
    
    const handler = setTimeout(() => {
        const results = searchPlayers(searchCriteria);
        setSearchResults(results);
        setIsLoading(false);
    }, 300);

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
