
'use client';

import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

export default function RequestsTestPage() {
  async function handleTest() {
    try {
      console.log('CLIENT: About to call function...');
      const result = await processBatchedRequests();
      console.log('CLIENT: Success!', result);
      alert(`Success: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error('CLIENT: Error!', error);
      alert(`Error: ${error}`);
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Server Action Test</h1>
      <button onClick={handleTest} style={{ padding: '10px 20px', fontSize: '16px' }}>
        Test Server Action
      </button>
    </div>
  );
}
