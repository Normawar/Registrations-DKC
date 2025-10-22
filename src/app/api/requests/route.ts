
import { NextResponse } from 'next/server';

type RequestBody = {
  action: string;
  batchId: string;
  items: unknown[];
};

// ✅ Utility: validate body
function validateBody(body: any): body is RequestBody {
  if (!body || typeof body !== 'object') return false;

  const { action, batchId, items } = body;

  if (typeof action !== 'string' || action.trim() === '') return false;
  if (typeof batchId !== 'string' || batchId.trim() === '') return false;
  if (!Array.isArray(items)) return false;

  return true;
}

// Handle GET requests
export async function GET() {
  console.log('SERVER: GET /requests at', new Date().toISOString());

  return NextResponse.json({
    method: 'GET',
    success: true,
    timestamp: new Date().toISOString(),
    message: 'Fetched successfully',
  });
}

// Handle POST requests
export async function POST(req: Request) {
  console.log('SERVER: POST /requests at', new Date().toISOString());

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // ✅ Validate body
  if (!validateBody(body)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Invalid request. Expected { action: string, batchId: string, items: [] }',
      },
      { status: 400 }
    );
  }

  // ✅ If valid
  const result = {
    method: 'POST',
    success: true,
    timestamp: new Date().toISOString(),
    received: body,
  };

  return NextResponse.json(result);
}
