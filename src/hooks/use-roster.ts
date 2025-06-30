
'use client';

import { useState, useEffect, useCallback } from 'react';

// Consistent Player type
export type Player = {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  uscfId: string;
  uscfExpiration?: Date;
  rating?: number;
  grade: string;
  section: string;
  email: string;
  phone: string;
  dob: Date;
  zipCode: string;
  studentType?: 'gt' | 'independent';
};

const initialPlayers: Player[] = [
  { id: "1", firstName: "Alex", middleName: "Michael", lastName: "Ray", uscfId: "12345678", rating: 1850, uscfExpiration: new Date('2025-12-31'), grade: "10th Grade", section: 'High School K-12', email: 'alex.ray@example.com', phone: '956-111-1111', dob: new Date('2008-05-10'), zipCode: '78501'},
  { id: "2", firstName: "Jordan", lastName: "Lee", uscfId: "87654321", rating: 2100, uscfExpiration: new Date('2023-01-15'), grade: "11th Grade", section: 'Championship', email: 'jordan.lee@example.com', phone: '956-222-2222', dob: new Date('2007-09-15'), zipCode: '78504', studentType: 'independent' },
];

export function useRoster() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedPlayers = localStorage.getItem('roster_players');
      if (storedPlayers) {
        // Need to parse dates correctly from JSON
        const parsedPlayers = JSON.parse(storedPlayers).map((p: any) => ({
          ...p,
          dob: new Date(p.dob),
          uscfExpiration: p.uscfExpiration ? new Date(p.uscfExpiration) : undefined,
        }));
        setPlayers(parsedPlayers);
      } else {
        setPlayers(initialPlayers);
      }
    } catch (error) {
      console.error("Failed to load players from localStorage", error);
      setPlayers(initialPlayers);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('roster_players', JSON.stringify(players));
      } catch (error) {
        console.error("Failed to save players to localStorage", error);
      }
    }
  }, [players, isLoaded]);

  const addPlayer = useCallback((player: Player) => {
    setPlayers(prev => [...prev, player]);
  }, []);

  const updatePlayer = useCallback((updatedPlayer: Player) => {
    setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
  }, []);

  const deletePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  }, []);

  return { players, addPlayer, updatePlayer, deletePlayer, isLoaded };
}
