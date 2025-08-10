
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
  maxResults = 100,
  excludeIds = [],
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
      return Object.values(filters).some(val => val && val !== 'ALL' && val !== '');
  }, [filters]);
  
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

  }, [filters, searchPlayers, isDbLoaded, excludeIds, maxResults, hasActiveFilters]);
  
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
