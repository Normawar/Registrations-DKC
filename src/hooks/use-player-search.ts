
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useMasterDb, type SearchCriteria } from '@/context/master-db-context';

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

  const updateFilter = useCallback((key: keyof SearchCriteria, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const searchResults = useMemo(() => {
    setIsLoading(true);
    if (!isDbLoaded) return [];
    
    // Ensure there's at least one text-based filter to avoid overly broad initial searches
    const hasTextSearch = filters.firstName || filters.lastName || filters.uscfId;
    if (!hasTextSearch && !filters.state && !filters.school && !filters.district) {
        setIsLoading(false);
        return [];
    }

    const results = searchPlayers({
      ...filters,
      excludeIds,
      maxResults,
    });
    setIsLoading(false);
    return results;
  }, [filters, searchPlayers, isDbLoaded, excludeIds, maxResults]);
  
  const hasResults = searchResults.length > 0;
  const hasActiveFilters = Object.values(filters).some(val => val && val !== 'ALL');

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
