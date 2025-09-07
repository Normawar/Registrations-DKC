'use client';

import React, { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Papa from 'papaparse';

export const SimpleTestUpload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleUpload = async () => {
    console.log('Direct test upload starting...');
    
    if (!selectedFile) {
      alert('No file selected');
      return;
    }

    if (!db) {
      alert('Database not initialized');
      return;
    }

    setUploading(true);

    try {
      // Read file
      const csvText = await selectedFile.text();
      console.log('File read, length:', csvText.length);

      // Parse CSV
      const result = await new Promise<Papa.ParseResult<any>>((resolve) => {
        Papa.parse(csvText, {
          header: true,
          complete: resolve
        });
      });

      console.log('Parsed rows:', result.data.length);

      // Test with just 3 records
      const testRecords = result.data.slice(0, 3);
      const batch = writeBatch(db);

      testRecords.forEach((row: any, index: number) => {
        const docRef = doc(db, 'players', `test-${Date.now()}-${index}`);
        batch.set(docRef, {
          id: `test-${Date.now()}-${index}`,
          firstName: row.firstName || row['First Name'] || 'Test',
          lastName: row.lastName || row['Last Name'] || 'Player',
          uscfId: row.uscfId || row.id || `test-${index}`,
          state: 'TX',
          grade: '',
          section: '',
          email: '',
          school: '',
          district: '',
          events: 0,
          eventIds: []
        });
      });

      await batch.commit();
      console.log('Upload successful!');
      alert(`Success! Uploaded ${testRecords.length} test records`);

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed: ' + (error instanceof Error ? error.message : 'Unknown'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 bg-yellow-100 border rounded">
      <h3 className="font-bold mb-2">Simple Test Upload</h3>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        className="block w-full mb-2 p-2 border"
      />
      {selectedFile && (
        <div className="mb-2">
          <p>Selected: {selectedFile.name}</p>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {uploading ? 'Testing...' : 'Test Upload (3 records)'}
          </button>
        </div>
      )}
    </div>
  );
};
