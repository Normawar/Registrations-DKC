'use client';

import React, { useState } from 'react';
import { useMasterDb, type UploadProgress } from '@/context/master-db-context';
import { Progress } from '@/components/ui/progress';

export const EnhancedCSVUpload: React.FC = () => {
  const { bulkUploadCSVWithProgress } = useMasterDb();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [results, setResults] = useState<{ uploaded: number; errors: string[] } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file?.name);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      event.target.value = ''; // Clear the input
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setResults(null); // Clear previous results
  };

  const handleUpload = async () => {
    console.log('🎯 handleUpload called');
    
    if (!selectedFile) {
      alert('Please select a CSV file first');
      return;
    }
  
    // Check if the function exists
    if (!bulkUploadCSVWithProgress) {
      console.error('❌ bulkUploadCSVWithProgress function not found in context');
      alert('Upload function not available. Please refresh the page and try again.');
      return;
    }
  
    console.log('✅ bulkUploadCSVWithProgress function found');
  
    setUploading(true);
    setProgress(null);
  
    try {
      const confirmed = confirm(
        `Upload CSV file "${selectedFile.name}"?\n\n` +
        `This enhanced upload includes:\n` +
        `• Real-time progress tracking\n` +
        `• Rate limiting protection\n` +
        `• Batch processing\n\n` +
        `Large files may take several minutes.`
      );
      
      if (!confirmed) {
        console.log('User cancelled upload');
        setUploading(false);
        return;
      }
  
      console.log('🚀 Starting enhanced CSV upload with file:', selectedFile.name);
      
      const result = await bulkUploadCSVWithProgress(selectedFile, (progressUpdate) => {
        console.log('📊 Progress update received:', progressUpdate);
        setProgress(progressUpdate);
      });
      
      console.log('✅ Upload completed:', result);
      setResults(result);
      
      if (result.uploaded > 0) {
        alert(`Successfully uploaded ${result.uploaded.toLocaleString()} players!`);
      }
      
      if (result.errors.length > 0) {
        console.warn('Upload errors:', result.errors);
      }
  
      // Clear the file selection after successful upload
      setSelectedFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
  
    } catch (error) {
      console.error('💥 Upload failed with error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 Upload process finished');
      setUploading(false);
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

  const getProgressBarColor = (stage: string) => {
    switch (stage) {
      case 'parsing': return 'bg-blue-500';
      case 'uploading': return 'bg-orange-500';
      case 'refreshing': return 'bg-purple-500';
      case 'complete': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          🚀 Enhanced CSV Upload
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Advanced upload with progress tracking, rate limiting, and batch processing
        </p>
        
        <div className="space-y-4">
          {/* File Selection */}
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelection}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
            
            {selectedFile && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-700">
                  <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          {selectedFile && !uploading && (
             <div className="space-y-2">
              <button
                onClick={() => {
                  console.log('🔴 Button clicked!');
                  handleUpload();
                }}
                disabled={uploading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Start Enhanced Upload'}
              </button>
              
              {/* Debug button */}
              <button
                onClick={() => {
                  console.log('DEBUG: Function exists:', !!bulkUploadCSVWithProgress);
                  console.log('DEBUG: Context value:', { bulkUploadCSVWithProgress });
                  alert(`Function available: ${!!bulkUploadCSVWithProgress}`);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
              >
                Test Context
              </button>
            </div>
          )}
        </div>
      </div>

      {uploading && progress && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6 space-y-4">
          {/* Stage Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getStageIcon(progress.stage)}</span>
              <div>
                <span className={`font-semibold text-lg capitalize ${getStageColor(progress.stage)}`}>
                  {progress.stage.replace('_', ' ')}
                </span>
                {progress.stage === 'uploading' && (
                  <div className="text-xs text-gray-500">
                    Batch {progress.currentBatch} of {progress.totalBatches}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-700">
                {progress.percentage}%
              </div>
              {progress.stage === 'uploading' && (
                <div className="text-xs text-gray-500">
                  {progress.uploadedRecords.toLocaleString()} / {progress.totalRecords.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
              className={`h-4 rounded-full transition-all duration-500 ease-out ${getProgressBarColor(progress.stage)}`}
              style={{ width: `${progress.percentage}%` }}
            >
              <div className="w-full h-full bg-gradient-to-r from-white/20 to-transparent"></div>
            </div>
          </div>

          {/* Progress Message */}
          <div className="bg-white/50 rounded-md p-3">
            <p className="text-sm font-medium text-gray-700">
              {progress.message}
            </p>
          </div>

          {/* Detailed Stats for Upload Stage */}
          {progress.stage === 'uploading' && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-lg p-3">
                <div className="text-lg font-bold text-blue-600">
                  {progress.currentBatch}
                </div>
                <div className="text-xs text-gray-500">Current Batch</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-lg font-bold text-orange-600">
                  {progress.uploadedRecords.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Records Uploaded</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-lg font-bold text-green-600">
                  ~{Math.max(0, (progress.totalBatches - progress.currentBatch))}s
                </div>
                <div className="text-xs text-gray-500">Est. Remaining</div>
              </div>
            </div>
          )}
        </div>
      )}

      {results && !uploading && (
        <div className={`border rounded-lg p-4 ${results.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h4 className="font-semibold mb-2 flex items-center">
            <span className="mr-2 text-xl">🎉</span>
            Upload Complete!
          </h4>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Successfully uploaded:</span> 
              <span className="text-lg font-bold text-green-600 ml-2">
                {results.uploaded.toLocaleString()}
              </span> players
            </p>
            
            {results.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-yellow-700 font-medium mb-2">
                  ⚠️ Errors encountered ({results.errors.length}):
                </p>
                <div className="bg-yellow-100 rounded p-2 max-h-32 overflow-y-auto">
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {results.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-3">
        <p className="font-medium mb-2">📋 Enhanced Features:</p>
        <ul className="space-y-1">
          <li>• Real-time progress tracking with visual feedback</li>
          <li>• Automatic rate limiting (500 records/batch, 1s delays)</li>
          <li>• Error recovery and retry logic</li>
          <li>• Detailed batch processing information</li>
          <li>• Optimized for large files (100K+ records)</li>
        </ul>
      </div>
    </div>
  );
};
