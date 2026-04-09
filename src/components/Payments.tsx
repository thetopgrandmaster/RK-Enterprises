import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, serverTimestamp, runTransaction, doc } from 'firebase/firestore';
import { Party, Transaction, TransactionType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { IndianRupee, ArrowUpRight, ArrowDownLeft, History } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Payments() {
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    partyId: '',
    type: 'Money Given' as TransactionType,
    amount: 0,
    adjustAgainstAdvance: false,
  });

  useEffect(() => {
    const unsubscribeParties = onSnapshot(collection(db, 'parties'), (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party)));
    });

    const qTrans = query(
      collection(db, 'transactions'), 
      orderBy('date', 'desc')
    );
    
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const allTrans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      // Filter for money transactions only
      setTransactions(allTrans.filter(t => t.type === 'Money Given' || t.type === 'Money Received'));
    });

    return () => {
      unsubscribeParties();
      unsubscribeTrans();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partyId || formData.amount <= 0) {
      toast.error('Please select a party and enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const partyDoc = await transaction.get(doc(db, 'parties', formData.partyId));
        if (!partyDoc.exists()) throw new Error('Party not found');

        const partyData = partyDoc.data() as Party;
        let { currentDebit = 0, currentCredit = 0 } = partyData;

        if (formData.type === 'Money Given') {
          // I pay money -> Increases what they owe me (or reduces what I owe)
          currentDebit += formData.amount;
        } else if (formData.type === 'Money Received') {
          // I receive money -> Increases what I owe them (or reduces what they owe)
          currentCredit += formData.amount;
        }

        // Record the transaction
        const newTransRef = doc(collection(db, 'transactions'));
        transaction.set(newTransRef, {
          partyId: formData.partyId,
          partyName: partyData.name,
          type: formData.type,
          amount: formData.amount,
          totalValue: formData.amount, // Ensure totalValue is present for security rules
          date: serverTimestamp(),
          createdAt: serverTimestamp(),
          adjustAgainstAdvance: formData.adjustAgainstAdvance
        });

        // Update party balance
        transaction.update(doc(db, 'parties', formData.partyId), {
          currentDebit,
          currentCredit,
          lastUpdated: serverTimestamp()
        });
      });

      toast.success('Payment recorded successfully');
      setFormData({ ...formData, amount: 0, adjustAgainstAdvance: false });
    } catch (error) {
      const message = handleFirestoreError(error, OperationType.WRITE, 'transactions');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-primary" />
            Record Payment
          </CardTitle>
          <CardDescription>Enter money given or received</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Party</Label>
              <Select 
                value={formData.partyId} 
                onValueChange={(val) => setFormData({ ...formData, partyId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Party" />
                </SelectTrigger>
                <SelectContent>
                  {parties.map(p => (
                    <SelectItem key={p.id} value={p.id!}>
                      {p.name} ({p.type}) - Bal: {formatCurrency((p.currentDebit || 0) - (p.currentCredit || 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(val: any) => setFormData({ ...formData, type: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Money Given">Money Given (I Pay)</SelectItem>
                  <SelectItem value="Money Received">Money Received (I Receive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                value={formData.amount || ''} 
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="adjust" 
                checked={formData.adjustAgainstAdvance}
                onCheckedChange={(checked) => setFormData({ ...formData, adjustAgainstAdvance: !!checked })}
              />
              <Label htmlFor="adjust" className="text-sm font-normal cursor-pointer">
                Adjust against existing balance
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : 'Record Payment'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent payments found.</p>
            ) : (
              transactions.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === 'Money Given' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                      {t.type === 'Money Given' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{t.partyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.date?.toDate ? format(t.date.toDate(), 'dd/MM/yyyy HH:mm') : t.date || 'Pending...'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${t.type === 'Money Given' ? 'text-orange-600' : 'text-green-600'}`}>
                      {t.type === 'Money Given' ? '-' : '+'}{formatCurrency(t.amount || 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.type}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
