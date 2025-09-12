'use server';

// Generic payload
export type RequestPayload<TItems = unknown> = {
  action: string;
  batchId: string;
  items: TItems[];
};

// GET response shape
export type GetResponse = {
  method: 'GET';
  success: true;
  timestamp: string;
  message: string;
};

// POST response shape
export type PostResponse<TItems = unknown> = {
  method: 'POST';
  success: true;
  timestamp: string;
  received: RequestPayload<TItems>;
};

// --- Function overloads --- //
export async function processBatchedRequestsFlow(
  method: 'GET'
): Promise<GetResponse>;

export async function processBatchedRequestsFlow<TItems>(
  method: 'POST',
  payload: RequestPayload<TItems>
): Promise<PostResponse<TItems>>;

export async function processBatchedRequestsFlow<TItems>(
  method: 'GET' | 'POST',
  payload?: RequestPayload<TItems>
): Promise<GetResponse | PostResponse<TItems>> {
  try {
    const options: RequestInit = { method };

    if (method === 'POST') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }

    const res = await fetch('/api/requests', options);

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('processBatchedRequestsFlow failed:', err);
    throw err;
  }
}
