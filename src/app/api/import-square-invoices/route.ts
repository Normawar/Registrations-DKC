export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  notifications: string[];
}

export async function POST(request: NextRequest) {
  let body: any;

  try {
    body = await request.json();
  } catch (err) {
    console.error('Failed to parse JSON body:', err);
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const { startInvoiceNumber, endInvoiceNumber } = body ?? {};

  if (startInvoiceNumber === undefined || endInvoiceNumber === undefined) {
    return NextResponse.json(
      { error: 'Missing required parameters: startInvoiceNumber or endInvoiceNumber' },
      { status: 400 }
    );
  }

  const startNum = parseInt(startInvoiceNumber as any, 10);
  const endNum = parseInt(endInvoiceNumber as any, 10);

  if (isNaN(startNum) || isNaN(endNum)) {
    return NextResponse.json(
      { error: 'Parameters must be valid numbers' },
      { status: 400 }
    );
  }

  console.log(`Starting Square invoice import: ${startNum} → ${endNum}`);

  try {
    // Lazy import to avoid build-time execution
    const { importSquareInvoices } = await import('@/ai/flows/import-square-invoices-flow');
    
    const result: ImportResult = await importSquareInvoices({
      startInvoiceNumber: startNum,
      endInvoiceNumber: endNum,
    });

    const errors = Array.isArray(result.errors) ? result.errors : [];
    const notifications = Array.isArray(result.notifications) ? result.notifications : [];

    return NextResponse.json({
      summary: {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        errorsCount: errors.length,
        notificationsCount: notifications.length,
      },
      details: {
        errors,
        notifications,
      },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error?.message || 'Import failed' },
      { status: 500 }
    );
  }
}