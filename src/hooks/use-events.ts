
'use client';

import { useState, useEffect, useCallback } from 'react';

export type Event = {
  id: string;
  name: string;
  date: string; // ISO 8601 string format
  location: string;
  rounds: number;
  regularFee: number;
  lateFee: number;
  veryLateFee: number;
  imageUrl?: string;
  pdfUrl?: string;
};

const initialEvents: Event[] = [
    {
        id: '1',
        name: "Spring Open 2024",
        date: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
        location: "City Convention Center",
        rounds: 5,
        regularFee: 20,
        lateFee: 25,
        veryLateFee: 30,
        imageUrl: "https://placehold.co/100x100.png",
        pdfUrl: "#",
    },
    {
        id: '2',
        name: "Summer Championship",
        date: new Date(new Date().setDate(new Date().getDate() + 40)).toISOString(),
        location: "Grand Hotel Ballroom",
        rounds: 7,
        regularFee: 25,
        lateFee: 30,
        veryLateFee: 35,
    },
    {
        id: '3',
        name: "Autumn Classic",
        date: new Date("2024-03-10").toISOString(),
        location: "Community Chess Club",
        rounds: 5,
        regularFee: 20,
        lateFee: 25,
        veryLateFee: 30,
        pdfUrl: "#",
    },
    {
        id: '4',
        name: "Winter Scholastic",
        date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
        location: "North High School",
        rounds: 4,
        regularFee: 20,
        lateFee: 25,
        veryLateFee: 30,
    },
    {
        id: '5',
        name: "New Year Blitz",
        date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
        location: "Online",
        rounds: 9,
        regularFee: 15,
        lateFee: 20,
        veryLateFee: 25,
        imageUrl: "https://placehold.co/100x100.png",
    },
];

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedEvents = localStorage.getItem('chess_events');
      if (storedEvents) {
        setEvents(JSON.parse(storedEvents));
      } else {
        setEvents(initialEvents);
      }
    } catch (error) {
      console.error("Failed to load events from localStorage", error);
      setEvents(initialEvents);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('chess_events', JSON.stringify(events));
      } catch (error) {
        console.error("Failed to save events to localStorage", error);
      }
    }
  }, [events, isLoaded]);

  const addEvent = useCallback((event: Event) => {
    setEvents(prev => [...prev, event]);
  }, []);

  const updateEvent = useCallback((updatedEvent: Event) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  return { events, addEvent, updateEvent, deleteEvent };
}
