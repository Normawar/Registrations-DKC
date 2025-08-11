
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMasterDb, type SearchCriteria, type MasterPlayer } from '@/context/master-db-context';

type UsePlayerSearchProps = {
  initialFilters?: Partial<SearchCriteria>;
  maxResults?: number;
  excludeIds?: string[];
};

export function usePlayerSearch({
  initialFilters = {},
  maxResults, // Removed default value
  excludeIds,
}: UsePlayerSearchProps) {
  const { searchPlayers, isDbLoaded } = useMasterDb();
  const [filters, setFilters] = useState<Partial<SearchCriteria>>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MasterPlayer[]>([]);

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const hasActiveFilters = useMemo(() => {
      // An active filter is anything other than the default initial state.
      // We check if any filter has a value that is not undefined, null, an empty string, or 'ALL'.
      return Object.entries(filters).some(([key, value]) => {
          if (initialFilters.hasOwnProperty(key) && initialFilters[key as keyof SearchCriteria] === value) {
              return false;
          }
          return value !== undefined && value !== null && value !== '' && value !== 'ALL';
      });
  }, [filters, initialFilters]);
  
  useEffect(() => {
    if (!isDbLoaded || !hasActiveFilters) {
        setSearchResults([]);
        return;
    }

    setIsLoading(true);
    const results = searchPlayers({
      ...filters,
      excludeIds,
      maxResults,
    });
    setSearchResults(results);
    setIsLoading(false);

  }, [filters, searchPlayers, isDbLoaded, maxResults, hasActiveFilters, excludeIds]);
  
  const hasResults = searchResults.length > 0;
  
  return {
    filters,
    updateFilter,
    clearFilters,
    searchResults,
    isLoading,
    hasResults,
    hasActiveFilters,
  };
}
