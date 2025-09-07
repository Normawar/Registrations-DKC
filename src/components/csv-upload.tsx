
'use client';

import React, { useState } from 'react';
import { useMasterDb, type UploadProgress } from '@/context/master-db-context';
import { Progress } from '@/components/ui/progress';

export const CSVUploadComponent: React.FC = () => {
  const { bulkUploadCSV } = useMasterDb();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
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

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'parsing': return '📄';
      case 'uploading': return '⬆️';
      case 'refreshing': return '🔄';
      case 'complete': return '✅';
      default: return '🚀';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'parsing': return 'text-blue-600';
      case 'uploading': return 'text-orange-600';
      case 'refreshing': return 'text-purple-600';
      case 'complete': return 'text-green-600';
      default: return 'text-gray-600';
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

      {uploading && progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xl">{getStageIcon(progress.stage)}</span>
              <span className={`font-medium capitalize ${getStageColor(progress.stage)}`}>
                {progress.stage}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {progress.percentage}%
            </span>
          </div>

          <Progress value={progress.percentage} className="w-full h-3" />

          <div className="space-y-2">
            <p className="text-sm text-blue-700 font-medium">
              {progress.message}
            </p>
            
            {progress.stage === 'uploading' && (
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                <div>
                  <span className="font-medium">Batch Progress:</span>
                  <br />
                  {progress.currentBatch} of {progress.totalBatches} batches
                </div>
                <div>
                  <span className="font-medium">Records Uploaded:</span>
                  <br />
                  {progress.uploadedRecords.toLocaleString()} of {progress.totalRecords.toLocaleString()}
                </div>
              </div>
            )}
          </div>
          
          {progress.stage === 'uploading' && progress.currentBatch > 1 && (
            <div className="text-xs text-gray-500">
              Estimated time remaining: ~{Math.ceil((progress.totalBatches - progress.currentBatch) * 1)} seconds
            </div>
          )}
        </div>
      )}

      {results && !uploading && (
        <div className={`border rounded-md p-4 ${results.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-medium mb-2 flex items-center">
            <span className="mr-2">🎉</span>
            Upload Results
          </h3>
          <p className="text-sm">
            <span className="font-medium">Successfully uploaded:</span> {results.uploaded.toLocaleString()} players
          </p>
          {results.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-yellow-700 font-medium">Errors encountered:</p>
              <ul className="text-xs text-yellow-600 mt-1 space-y-1 max-h-32 overflow-y-auto">
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
          <li>• Large files are processed in batches with progress tracking</li>
        </ul>
      </div>
    </div>
  );
};

    