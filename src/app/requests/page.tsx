'use client';

import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

export default function RequestsPage() {
  async function handleTest() {
    'use server';
    
    try {
      console.log('SERVER: Testing server action...');
      const result = await processBatchedRequests();
      console.log('SERVER: Success!', result);
      return result;
    } catch (error) {
      console.error('SERVER: Error!', error);
      throw error;
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Server Action Test</h1>
      <form action={handleTest}>
        <button 
          type="submit"
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Server Action
        </button>
      </form>
    </div>
  );
}
