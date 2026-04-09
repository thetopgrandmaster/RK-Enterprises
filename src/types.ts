export type MaterialType = 'AA' | 'CK' | 'AW' | 'AC' | 'LS' | 'BC' | 'AWC';

export interface Party {
  id?: string;
  name: string;
  type: 'seller' | 'buyer';
  openingBalance: number; // Debit - Credit
  currentDebit: number;
  currentCredit: number;
  createdAt: any;
}

export interface DailyPrice {
  id?: string;
  date: string; // YYYY-MM-DD
  material: MaterialType;
  price: number;
}

export type TransactionType = 'Money Given' | 'Money Received' | 'Material Sent' | 'Material Received';

export interface Transaction {
  id?: string;
  date: any;
  partyId: string;
  type: TransactionType;
  material?: MaterialType;
  weight?: number;
  price?: number;
  totalValue: number;
  amount?: number;
  partyName?: string;
  isDirectTrade?: boolean;
  relatedPartyId?: string;
  packagingType?: 'Gunny Bags' | 'Loose';
}

export interface StockEntry {
  id?: string;
  date: any;
  material: MaterialType;
  weightRaw: string; // e.g., "35 x 150"
  weightKg: number; // e.g., 35.150
  sourcePartyId: string;
  packagingType: 'Gunny Bags' | 'Loose';
  transactionId?: string;
}

export interface DailyEntry {
  id?: string;
  date: any;
  type: 'income' | 'outgoing';
  name: string;
  amount: number;
}
