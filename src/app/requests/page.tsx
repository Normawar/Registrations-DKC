'use client';

import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

export default function RequestsPage() {
  async function handleTest() {
    try {
      console.log('CLIENT: Testing server action...');
      const result = await processBatchedRequests();
      console.log('CLIENT: Success!', result);
      alert(`Success: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error('CLIENT: Error!', error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Server Action Test</h1>
      <button 
        onClick={handleTest} 
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
    </div>
  );
}
