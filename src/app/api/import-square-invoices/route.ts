import { NextRequest, NextResponse } from 'next/server';
import { importSquareInvoices } from '@/ai/flows/import-square-invoices-flow';

interface ImportResult {
  imported: any[];
  skipped: any[];
  errors: any[];
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    // Safely parse the request body
    body = await request.json();
  } catch (err) {
    console.error('Failed to parse JSON body:', err);
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const { startInvoiceNumber, endInvoiceNumber } = body ?? {};

  if (
    startInvoiceNumber === undefined ||
    endInvoiceNumber === undefined
  ) {
    return NextResponse.json(
      { error: 'Missing required parameters: startInvoiceNumber or endInvoiceNumber' },
      { status: 400 }
    );
  }

  const startNum = parseInt(startInvoiceNumber, 10);
  const endNum = parseInt(endInvoiceNumber, 10);

  if (isNaN(startNum) || isNaN(endNum)) {
    return NextResponse.json(
      { error: 'Parameters must be valid numbers' },
      { status: 400 }
    );
  }

  try {
    // Call the import flow
    const result: ImportResult = await importSquareInvoices({
      startInvoiceNumber: startNum,
      endInvoiceNumber: endNum,
    });

    // Ensure result object has arrays
    const imported = Array.isArray(result.imported) ? result.imported : [];
    const skipped = Array.isArray(result.skipped) ? result.skipped : [];
    const errors = Array.isArray(result.errors) ? result.errors : [];

    return NextResponse.json({
      summary: {
        importedCount: imported.length,
        skippedCount: skipped.length,
        errorsCount: errors.length,
      },
      details: { imported, skipped, errors },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error?.message || 'Import failed' },
      { status: 500 }
    );
  }
}
