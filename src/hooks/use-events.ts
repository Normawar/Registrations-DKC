
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, writeBatch, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';

export type Event = {
  id: string;
  name: string;
  date: string; // ISO 8601 string format
  registrationDeadline?: string; // ISO 8601 string format
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
        setIsLoaded(true); // Stop loading even if db is not available
        return;
    }
    setIsLoaded(false);
    try {
      const eventsCol = collection(db, 'events');
      const eventSnapshot = await getDocs(eventsCol);
      const eventList = eventSnapshot.docs.map(doc => doc.data() as Event);
      setEvents(eventList);
    } catch (error) {
      console.error("Failed to load events from Firestore:", error);
      setEvents([]); // Set to empty array on error
    } finally {
      setIsLoaded(true);
    }
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
    await loadEvents();
  }, [loadEvents]);

  return { events, addEvent, addBulkEvents, updateEvent, deleteEvent, clearAllEvents, isLoaded };
}
