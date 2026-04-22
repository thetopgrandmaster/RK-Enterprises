export type MaterialType = 'AA' | 'CK' | 'AW' | 'AC' | 'LS' | 'BC' | 'AWC' | '3 mm' | '4 mm' | 'CT Plate';

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

export type TransactionType = 'Money Given' | 'Money Received' | 'Material Sent' | 'Material Received' | 'Tax';

export interface Transaction {
  id?: string;
  date: any;
  partyId: string;
  type: TransactionType;
  material?: MaterialType;
  weight?: number;
  stockWeight?: number;
  price?: number;
  totalValue: number;
  amount?: number;
  partyName?: string;
  isDirectTrade?: boolean;
  relatedPartyId?: string;
  packagingType?: 'Gunny Bags' | 'Loose';
  bagCount?: number;
  taxName?: string;
  paymentDetails?: string;
}

export interface StockEntry {
  id?: string;
  date: any;
  material: MaterialType;
  weightRaw: string; // e.g., "35 x 150"
  weightKg: number; // e.g., 35.150
  originalWeight?: number;
  sourcePartyId?: string;
  packagingType: 'Gunny Bags' | 'Loose';
  bagCount?: number;
  transactionId?: string;
  isDirectAdd?: boolean;
}

export interface DailyEntry {
  id?: string;
  date: any;
  type: 'income' | 'outgoing';
  name: string;
  amount: number;
}
