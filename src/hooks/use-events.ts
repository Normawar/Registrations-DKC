
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

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

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!db) {
        console.error("Firestore not initialized.");
        // Fallback to mock data if db is not available
        const mockEvents = [
          {
            "id": "evt-1757125186611-0.05756934987789575",
            "name": "Test PSJA South West Early College on February 28th, 2026",
            "date": "2026-02-28T06:00:00.000Z",
            "location": "PSJA South West Early College",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt1/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": true
          },
          {
            "id": "evt-1757125186611-0.9133269389279093",
            "name": "Test Wernecke on November 1st, 2025",
            "date": "2025-11-01T05:00:00.000Z",
            "location": "Wernecke",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt2/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": false
          },
          {
            "id": "evt-20250920-late-fee-test",
            "name": "Late Fee Test Event",
            "date": "2025-09-20T06:00:00.000Z",
            "location": "Test Location",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt3/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": false
          },
        ];
        setEvents(mockEvents);
        setIsLoaded(true);
        return;
    }
    setIsLoaded(false);
    const eventsCol = collection(db, 'events');
    const eventSnapshot = await getDocs(eventsCol);
    const eventList = eventSnapshot.docs.map(doc => doc.data() as Event);

    // Add mock data if the collection is empty
    if (eventList.length === 0) {
      const mockEvents = [
          {
            "id": "evt-1757125186611-0.05756934987789575",
            "name": "Test PSJA South West Early College on February 28th, 2026",
            "date": "2026-02-28T06:00:00.000Z",
            "location": "PSJA South West Early College",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt1/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": true
          },
          {
            "id": "evt-1757125186611-0.9133269389279093",
            "name": "Test Wernecke on November 1st, 2025",
            "date": "2025-11-01T05:00:00.000Z",
            "location": "Wernecke",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt2/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": false
          },
          {
            "id": "evt-20250920-late-fee-test",
            "name": "Late Fee Test Event",
            "date": "2025-09-20T06:00:00.000Z",
            "location": "Test Location",
            "rounds": 5,
            "regularFee": 20,
            "lateFee": 25,
            "veryLateFee": 30,
            "dayOfFee": 35,
            "imageUrl": "https://picsum.photos/seed/evt3/600/400",
            "pdfUrl": "#",
            "isClosed": false,
            "isPsjaOnly": false
          },
      ];
      const batch = writeBatch(db);
      mockEvents.forEach(event => {
          const docRef = doc(db, 'events', event.id);
          batch.set(docRef, event);
      });
      await batch.commit();
      setEvents(mockEvents);
    } else {
      setEvents(eventList);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const addEvent = useCallback(async (event: Event) => {
    if (!db) return;
    const eventRef = doc(db, 'events', event.id);
    await setDoc(eventRef, event);
    await loadEvents();
  }, [loadEvents]);

  const addBulkEvents = useCallback(async (eventsToAdd: Event[]) => {
    if (!db) return;
    const batch = writeBatch(db);
    eventsToAdd.forEach(event => {
        const docRef = doc(db, 'events', event.id);
        batch.set(docRef, event);
    });
    await batch.commit();
    await loadEvents();
  }, [loadEvents]);

  const updateEvent = useCallback(async (updatedEvent: Event) => {
    if (!db) return;
    const eventRef = doc(db, 'events', updatedEvent.id);
    await setDoc(eventRef, updatedEvent, { merge: true });
    await loadEvents();
  }, [loadEvents]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'events', eventId));
    await loadEvents();
  }, [loadEvents]);
  
  const clearAllEvents = useCallback(async () => {
    if (!db) return;
    const eventsCol = collection(db, 'events');
    const eventSnapshot = await getDocs(eventsCol);
    const batch = writeBatch(db);
    eventSnapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    setEvents([]);
  }, []);

  return { events, addEvent, addBulkEvents, updateEvent, deleteEvent, clearAllEvents, isLoaded };
}
