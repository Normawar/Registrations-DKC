
'use client';

import React, { useState } from 'react';
import { useMasterDb } from '@/context/master-db-context';
import { Progress } from '@/components/ui/progress';

export const CSVUploadComponent: React.FC = () => {
  const { bulkUploadCSV } = useMasterDb();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<{ uploaded: number; errors: string[] } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setUploading(true);
    setResults(null);
    setProgress(null);

    try {
      const confirmed = confirm(`Upload CSV file "${file.name}"? This may take several minutes for large files.`);
      if (!confirmed) {
        setUploading(false);
        return;
      }

      const result = await bulkUploadCSV(file, (progressUpdate) => {
        setProgress(progressUpdate);
      });

      setResults(result);
      
      if (result.uploaded > 0) {
        alert(`Successfully uploaded ${result.uploaded} players!`);
      }
      
      if (result.errors.length > 0) {
        console.warn('Upload errors:', result.errors);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bulk Upload Players (CSV)
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
      </div>

      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center mb-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-700 font-medium">Uploading CSV... Please wait</span>
          </div>
          {progress && (
            <div>
              <Progress value={(progress.current / progress.total) * 100} className="w-full h-2" />
              <p className="text-xs text-blue-600 mt-1 text-center">
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()} players uploaded
              </p>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className={`border rounded-md p-4 ${results.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-medium mb-2">Upload Results</h3>
          <p className="text-sm">Successfully uploaded: {results.uploaded} players</p>
          {results.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-yellow-700 font-medium">Errors encountered:</p>
              <ul className="text-xs text-yellow-600 mt-1 space-y-1">
                {results.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p><strong>CSV Format Requirements:</strong></p>
        <ul className="mt-1 space-y-1">
          <li>• Required columns: uscfId, firstName, lastName</li>
          <li>• Optional columns: state, grade, section, school, district, email, phone, regularRating</li>
          <li>• Files are uploaded in batches of 500 with 1-second delays to prevent rate limiting</li>
        </ul>
      </div>
    </div>
  );
};
