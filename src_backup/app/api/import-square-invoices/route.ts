import { NextRequest, NextResponse } from 'next/server';
import { importSquareInvoices } from '@/ai/flows/import-square-invoices-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startInvoiceNumber, endInvoiceNumber } = body;

    if (!startInvoiceNumber || !endInvoiceNumber) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await importSquareInvoices({
      startInvoiceNumber: parseInt(startInvoiceNumber, 10),
      endInvoiceNumber: parseInt(endInvoiceNumber, 10),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}