'use server';

console.log('SERVER: File loaded at', new Date().toISOString());

export async function processBatchedRequests(method?: string, data?: any) {
  console.log('SERVER: Function called at', new Date().toISOString());
  console.log('SERVER: Method:', method);
  console.log('SERVER: Data:', data);
  
  if (method === 'GET') {
    return { message: "GET request processed successfully" };
  }
  
  const result = { 
    success: true, 
    timestamp: new Date().toISOString(),
    received: data || {},
    method
  };
  console.log('SERVER: Returning result:', result);
  return result;
}
