'use client';

import { testBatchAction } from './actions';

export default function RequestsPage() {
  async function handleTest() {
    try {
      console.log('CLIENT: Calling server action...');
      const result = await testBatchAction();
      
      if (result.success) {
        console.log('CLIENT: Success!', result.data);
        alert(`Success: ${JSON.stringify(result.data)}`);
      } else {
        throw new Error(result.error);
      }
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
