'use client';

import { processBatchedRequests } from '@/ai/flows/process-batched-requests-flow';

export default function Page() {
  async function handleGet() {
    const result = await processBatchedRequests('GET');
    console.log('Client got:', result);
  }

  async function handlePostWithStrings() {
    const result = await processBatchedRequests('POST', {
      action: 'process',
      batchId: 'abc123',
      items: ['a', 'b', 'c'],
    });
    console.log('Client got:', result);
  }

  async function handlePostWithObjects() {
    const result = await processBatchedRequests('POST', {
      action: 'process',
      batchId: 'xyz789',
      items: [{ id: 1 }, { id: 2 }],
    });
    console.log('Client got:', result);
  }

  return (
    <div className="space-x-2">
      <button onClick={handleGet}>Run GET</button>
      <button onClick={handlePostWithStrings}>POST strings</button>
      <button onClick={handlePostWithObjects}>POST objects</button>
    </div>
  );
}
