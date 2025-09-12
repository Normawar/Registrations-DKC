'use server';

// Minimal version to test basic functionality
console.log('Module loading started');

// Test basic types first
type ProcessBatchInput = {
  requestIds: string[];
  decision: 'Approved' | 'Denied';
  waiveFees?: boolean;
  processingUser: {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

type ProcessBatchOutput = {
  processedCount: number;
  failedCount: number;
  errors?: string[];
};

console.log('Types defined successfully');

// Test basic function export
export async function processBatchedRequests(input: ProcessBatchInput): Promise<ProcessBatchOutput> {
  console.log('Function called with:', input);
  
  // Return basic response without any complex operations
  return {
    processedCount: 0,
    failedCount: input.requestIds.length,
    errors: ['Function is in debug mode - no actual processing performed']
  };
}

console.log('=== MODULE LOADED SUCCESSFULLY ===');
console.log('Function exported at:', new Date().toISOString());
