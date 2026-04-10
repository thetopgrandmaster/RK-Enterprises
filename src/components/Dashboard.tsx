import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, runTransaction, where, limit } from 'firebase/firestore';
import { Transaction, Party, MaterialType, DailyPrice, TransactionType, StockEntry, DailyEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet, Package, History, Warehouse as GodownIcon } from 'lucide-react';
import { formatCurrency, formatWeight } from '../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const MATERIALS: MaterialType[] = ['AA', 'CK', 'AW', 'AC', 'LS', 'BC', 'AWC'];

export default function Dashboard() {
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    partyId: '',
    type: 'Material Received' as TransactionType,
    material: 'AA' as MaterialType,
    weight: 0,
    price: 0,
    amount: 0,
    isDirectTrade: false,
    relatedPartyId: '',
    packagingType: 'Gunny Bags' as 'Gunny Bags' | 'Loose',
  });

  useEffect(() => {
    const unsubscribeParties = onSnapshot(collection(db, 'parties'), (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party)));
    });

    const qTrans = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(10));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    const unsubscribeStock = onSnapshot(collection(db, 'stockEntries'), (snapshot) => {
      setStockEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockEntry)));
    });

    const unsubscribeDaily = onSnapshot(collection(db, 'dailyEntries'), (snapshot) => {
      setDailyEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyEntry)));
    });

    return () => {
      unsubscribeParties();
      unsubscribeTrans();
      unsubscribeStock();
      unsubscribeDaily();
    };
  }, []);

  const totalGodownWeight = stockEntries.reduce((sum, e) => sum + e.weightKg, 0) - 
    transactions.filter(t => t.type === 'Material Sent' && !t.isDirectTrade).reduce((sum, t) => sum + (t.weight || 0), 0);

  const totalDailyIncome = dailyEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalDailyOutgoing = dailyEntries.filter(e => e.type === 'outgoing').reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partyId) {
      toast.error('Please select a party');
      return;
    }

    setLoading(true);
    const price = (formData.type === 'Material Received' || formData.type === 'Material Sent') 
      ? formData.price 
      : 0;

    const totalValue = (formData.type === 'Material Received' || formData.type === 'Material Sent')
      ? formData.weight * price
      : formData.amount;

    if (isNaN(totalValue)) {
      toast.error('Invalid amount or weight. Please check your inputs.');
      setLoading(false);
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const partyRef = doc(db, 'parties', formData.partyId);
        const partyDoc = await transaction.get(partyRef);
        if (!partyDoc.exists()) throw new Error("Party does not exist!");

        const partyData = partyDoc.data() as Party;
        let newDebit = partyData.currentDebit || 0;
        let newCredit = partyData.currentCredit || 0;

        // Debit = Increases what they owe me (Material Sent, Money Given)
        // Credit = Increases what I owe them (Material Received, Money Received)

        if (formData.type === 'Money Given') {
          newDebit += totalValue;
        } else if (formData.type === 'Money Received') {
          newCredit += totalValue;
        } else if (formData.type === 'Material Received') {
          newCredit += totalValue;
        } else if (formData.type === 'Material Sent') {
          newDebit += totalValue;
        }

        // Record the transaction
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          partyId: formData.partyId,
          type: formData.type,
          material: (formData.type === 'Material Received' || formData.type === 'Material Sent') ? formData.material : null,
          weight: (formData.type === 'Material Received' || formData.type === 'Material Sent') ? formData.weight : null,
          price: price,
          totalValue: totalValue,
          isDirectTrade: formData.isDirectTrade,
          relatedPartyId: formData.relatedPartyId,
          packagingType: (formData.type === 'Material Received' || formData.type === 'Material Sent') ? formData.packagingType : null,
          date: serverTimestamp(),
        });

        // Automatically add to Godown if Material Received and NOT direct trade
        if (formData.type === 'Material Received' && !formData.isDirectTrade) {
          const stockRef = doc(collection(db, 'stockEntries'));
          transaction.set(stockRef, {
            material: formData.material,
            weightRaw: formData.weight.toString(), // Using weight as raw for now
            weightKg: formData.weight,
            sourcePartyId: formData.partyId,
            packagingType: formData.packagingType,
            transactionId: transRef.id,
            date: serverTimestamp(),
          });
        }

        // Update party balances
        transaction.update(partyRef, {
          currentDebit: newDebit,
          currentCredit: newCredit,
        });

        // If direct trade, update the other party too
        if (formData.isDirectTrade && formData.relatedPartyId) {
          const relatedRef = doc(db, 'parties', formData.relatedPartyId);
          const relatedDoc = await transaction.get(relatedRef);
          if (relatedDoc.exists()) {
            const relatedData = relatedDoc.data() as Party;
            let relDebit = relatedData.currentDebit || 0;
            let relCredit = relatedData.currentCredit || 0;

            // If I'm receiving material from Seller and sending to Buyer directly:
            // Seller (partyId) gets Credit (I owe them)
            // Buyer (relatedPartyId) gets Debit (They owe me)
            if (formData.type === 'Material Received') {
              relDebit += totalValue;
            } else if (formData.type === 'Material Sent') {
              relCredit += totalValue;
            }

            transaction.update(relatedRef, {
              currentDebit: relDebit,
              currentCredit: relCredit,
            });
          }
        }
      });

      toast.success('Transaction recorded successfully');
      setFormData({
        ...formData,
        weight: 0,
        amount: 0,
        isDirectTrade: false,
        relatedPartyId: '',
      });
    } catch (error) {
      const message = handleFirestoreError(error, OperationType.WRITE, 'transactions');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle>New Transaction</CardTitle>
          <CardDescription>Record money or material movement</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Party Name</Label>
              <Select value={formData.partyId} onValueChange={val => setFormData({...formData, partyId: val})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select party" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map(p => (
                    <SelectItem key={p.id} value={p.id!}>{p.name} ({p.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={formData.type} onValueChange={(val: TransactionType) => setFormData({...formData, type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Material Received">Material Received</SelectItem>
                  <SelectItem value="Material Sent">Material Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.type === 'Material Received' || formData.type === 'Material Sent') ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Material</Label>
                    <Select value={formData.material} onValueChange={(val: MaterialType) => setFormData({...formData, material: val})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (Kg)</Label>
                    <Input type="number" step="0.001" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: Number(e.target.value)})} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Price (₹ per Kg)</Label>
                  <Input type="number" step="0.01" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} required />
                </div>

                <div className="space-y-2">
                  <Label>Packaging Type</Label>
                  <Select 
                    value={formData.packagingType} 
                    onValueChange={(val: 'Gunny Bags' | 'Loose') => setFormData({...formData, packagingType: val})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select packaging" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gunny Bags">Gunny Bags</SelectItem>
                      <SelectItem value="Loose">Loose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="direct" checked={formData.isDirectTrade} onCheckedChange={(val: boolean) => setFormData({...formData, isDirectTrade: val})} />
                    <Label htmlFor="direct" className="text-sm font-medium leading-none">
                      Direct Seller-to-Buyer Trade
                    </Label>
                  </div>
                </div>

                {formData.isDirectTrade && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label>Related Party ({formData.type === 'Material Received' ? 'Buyer' : 'Seller'})</Label>
                    <Select value={formData.relatedPartyId} onValueChange={val => setFormData({...formData, relatedPartyId: val})}>
                      <SelectTrigger><SelectValue placeholder="Select related party" /></SelectTrigger>
                      <SelectContent>
                        {parties
                          .filter(p => p.id !== formData.partyId && (formData.type === 'Material Received' ? p.type === 'buyer' : p.type === 'seller'))
                          .map(p => <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} required />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Record Transaction'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-blue-600 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Total Debit (Parties)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(parties.reduce((sum, p) => sum + (p.currentDebit || 0), 0))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-green-600 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4" />
                Total Credit (Parties)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(parties.reduce((sum, p) => sum + (p.currentCredit || 0), 0))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-orange-600 flex items-center gap-2">
                <GodownIcon className="w-4 h-4" />
                Godown Weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatWeight(Math.max(0, totalGodownWeight))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-indigo-50 border-indigo-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-indigo-600 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Daily Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(totalDailyIncome)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 border-rose-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-rose-600 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4" />
                Daily Total Outgoing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {formatCurrency(totalDailyOutgoing)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Transactions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="pl-6 text-xs">
                        {t.date?.toDate ? format(t.date.toDate(), 'dd/MM HH:mm') : 'Pending...'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {parties.find(p => p.id === t.partyId)?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.type.includes('Material') ? 'secondary' : 'outline'} className="text-[10px]">
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(t.totalValue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
