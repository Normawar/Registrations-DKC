'use server';

import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

export async function testBatchAction() {
  try {
    console.log('SERVER: Testing server action...');
    const result = await processBatchedRequests();
    console.log('SERVER: Success!', result);
    return { success: true, data: result };
  } catch (error) {
    console.error('SERVER: Error!', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
