'use client';

import { processBatchedRequestsFlow } from '@/ai/flows/process-batched-requests-flow';

export default function Page() {
  async function handleGet() {
    const result = await processBatchedRequestsFlow('GET');
    // ✅ result: GetResponse
    console.log(result.message);
  }

  async function handlePostWithStrings() {
    const result = await processBatchedRequestsFlow('POST', {
      action: 'process',
      batchId: 'abc123',
      items: ['a', 'b', 'c'], // ✅ typed as string[]
    });
    // ✅ result.received.items is string[]
    console.log(result.received.items[0].toUpperCase());
  }

  async function handlePostWithObjects() {
    const result = await processBatchedRequestsFlow('POST', {
      action: 'process',
      batchId: 'xyz789',
      items: [{ id: 1 }, { id: 2 }], // ✅ typed as {id:number}[]
    });
    // ✅ result.received.items[0].id is number
    console.log(result.received.items[0].id + 10);
  }

  return (
    <div className="space-x-2">
      <button onClick={handleGet}>Run GET</button>
      <button onClick={handlePostWithStrings}>POST strings</button>
      <button onClick={handlePostWithObjects}>POST objects</button>
    </div>
  );
}
