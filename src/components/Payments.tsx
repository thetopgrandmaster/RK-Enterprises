import React, { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, push, set, update, query, orderByChild, limitToLast, serverTimestamp, get } from 'firebase/database';
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
import { handleDatabaseError, OperationType } from '../lib/database-errors';
import { PartySearch } from './PartySearch';

export default function Payments() {
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    partyId: '',
    type: 'Money Given' as TransactionType,
    amount: 0,
  });

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const partiesRef = ref(rtdb, `users/${userId}/parties`);
    const unsubscribeParties = onValue(partiesRef, (snapshot) => {
      const data = snapshot.val();
      setParties(data ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) : []);
    });

    const transRef = ref(rtdb, `users/${userId}/transactions`);
    const qTrans = query(transRef, limitToLast(50));
    
    const unsubscribeTrans = onValue(qTrans, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allTrans = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) as Transaction[];
        // Filter for money transactions only and sort desc
        setTransactions(
          allTrans
            .filter(t => t.type === 'Money Given' || t.type === 'Money Received')
            .sort((a, b) => (b.date || 0) - (a.date || 0))
        );
      } else {
        setTransactions([]);
      }
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
    const userId = auth.currentUser?.uid;
    if (!userId) {
      toast.error('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      const partyRef = ref(rtdb, `users/${userId}/parties/${formData.partyId}`);
      const partySnapshot = await get(partyRef);
      if (!partySnapshot.exists()) throw new Error('Party not found');

      const partyData = partySnapshot.val() as Party;
      let { currentDebit = 0, currentCredit = 0 } = partyData;

      if (formData.type === 'Money Given') {
        currentDebit += formData.amount;
      } else if (formData.type === 'Money Received') {
        currentCredit += formData.amount;
      }

      const updates: any = {};
      const transId = push(ref(rtdb, `users/${userId}/transactions`)).key;
      
      updates[`/users/${userId}/transactions/${transId}`] = {
        partyId: formData.partyId,
        partyName: partyData.name,
        type: formData.type,
        amount: formData.amount,
        totalValue: formData.amount,
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      updates[`/users/${userId}/parties/${formData.partyId}/currentDebit`] = currentDebit;
      updates[`/users/${userId}/parties/${formData.partyId}/currentCredit`] = currentCredit;
      updates[`/users/${userId}/parties/${formData.partyId}/lastUpdated`] = serverTimestamp();

      // Add to daily entries
      const dailyId = push(ref(rtdb, `users/${userId}/dailyEntries`)).key;
      updates[`/users/${userId}/dailyEntries/${dailyId}`] = {
        type: formData.type === 'Money Given' ? 'outgoing' : 'income',
        amount: formData.amount,
        name: partyData.name,
        date: serverTimestamp(),
      };

      await update(ref(rtdb), updates);

      toast.success('Payment recorded successfully');
      setFormData({ ...formData, amount: 0 });
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.WRITE, 'transactions');
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
              <PartySearch
                parties={parties}
                value={formData.partyId}
                onValueChange={(val) => setFormData({ ...formData, partyId: val })}
                placeholder="Select Party"
              />
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
                        {t.date?.toDate ? format(t.date.toDate(), 'dd/MM/yyyy HH:mm') : (typeof t.date === 'number' ? format(new Date(t.date), 'dd/MM/yyyy HH:mm') : 'Pending...')}
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
