
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
  dayOfFee: number;
  imageUrl?: string;
  imageName?: string;
  pdfUrl?: string;
  pdfName?: string;
  isClosed?: boolean;
  isPsjaOnly?: boolean;
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
        dayOfFee: 35,
        imageUrl: "https://placehold.co/100x100.png",
        imageName: "Event Banner",
        pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        pdfName: "Spring Flyer",
        isClosed: false,
        isPsjaOnly: false,
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
        dayOfFee: 40,
        isClosed: false,
        isPsjaOnly: false,
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
        dayOfFee: 35,
        pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        pdfName: "Autumn Classic PDF",
        isClosed: true,
        isPsjaOnly: false,
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
        dayOfFee: 35,
        isClosed: false,
        isPsjaOnly: false,
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
        dayOfFee: 30,
        imageUrl: "https://placehold.co/100x100.png",
        imageName: "Blitz Image",
        isClosed: false,
        isPsjaOnly: true,
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

  const addBulkEvents = useCallback((eventsToAdd: Event[]) => {
    setEvents(prev => [...prev, ...eventsToAdd]);
  }, []);

  const updateEvent = useCallback((updatedEvent: Event) => {
    setEvents(prevEvents => {
      const newEvents = prevEvents.map(event =>
        event.id === updatedEvent.id ? updatedEvent : event
      );
      // Persist the new state to localStorage immediately after setting it
      try {
        localStorage.setItem('chess_events', JSON.stringify(newEvents));
      } catch (error) {
        console.error("Failed to save updated events to localStorage", error);
      }
      return newEvents;
    });
  }, []);

  const deleteEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);
  
  const clearAllEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, addEvent, addBulkEvents, updateEvent, deleteEvent, clearAllEvents };
}
