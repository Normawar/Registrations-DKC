'use client';

import { useState } from 'react';
import { recreateInvoiceFromRoster } from '@/lib/services/invoice-service';

interface Player {
  playerName: string;
  uscfId?: string;
  baseRegistrationFee: number;
  lateFee?: number | null;
  uscfAction: boolean;
  isGtPlayer: boolean;
  waiveLateFee?: boolean;
  lateFeeOverride?: number;
  registrationDate?: string;
}

interface PreviewPlayer {
  playerName: string;
  baseFee: number;
  lateFee: number;
  uscfActionFee: number;
  totalPerPlayer: number;
}

interface InvoicePreview {
  players: PreviewPlayer[];
  invoiceTotal: number;
  uscfFee: number;
}

export function useInvoiceFlow() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);

  const STANDARD_LATE_FEE = 5;
  const GT_LATE_FEE = 10;

  function calculateLateFee(player: Player) {
    if (player.waiveLateFee) return 0;
    if (typeof player.lateFeeOverride === 'number') return player.lateFeeOverride;
    return player.isGtPlayer ? GT_LATE_FEE : STANDARD_LATE_FEE;
  }

  function sanitizePlayers(players: Player[]): Player[] {
    return players
      .filter(p => p.playerName && p.playerName !== 'undefined undefined')
      .map(p => ({
        ...p,
        lateFee: calculateLateFee(p),
        registrationDate: p.registrationDate || new Date().toISOString(),
      }));
  }

  function previewInvoice(uscfFee: number) {
    const sanitized = sanitizePlayers(players);

    const previewPlayers: PreviewPlayer[] = sanitized.map(p => {
      const totalPerPlayer = p.baseRegistrationFee + (p.lateFee || 0) + (p.uscfAction ? uscfFee : 0);
      return {
        playerName: p.playerName,
        baseFee: p.baseRegistrationFee,
        lateFee: p.lateFee || 0,
        uscfActionFee: p.uscfAction ? uscfFee : 0,
        totalPerPlayer,
      };
    });

    const invoiceTotal = previewPlayers.reduce((sum, p) => sum + p.totalPerPlayer, 0);

    const invoicePreview: InvoicePreview = {
      players: previewPlayers,
      invoiceTotal,
      uscfFee,
    };

    setPreview(invoicePreview);
    return invoicePreview;
  }

  async function generateInvoice(data: any) {
    const sanitizedPlayers = sanitizePlayers(data.players);

    const invoiceData = {
      ...data,
      players: sanitizedPlayers,
    };

    return await recreateInvoiceFromRoster(invoiceData);
  }

  return {
    players,
    setPlayers,
    preview,
    previewInvoice,
    generateInvoice,
  };
}
