import React, { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, query, orderByChild, equalTo, push, serverTimestamp, update, get } from 'firebase/database';
import { Party, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, ShoppingBag, ArrowLeft, Plus, Percent } from 'lucide-react';
import { formatWeight, formatCurrency, customRound, cn } from '../lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { handleDatabaseError, OperationType } from '../lib/database-errors';

export default function SalesStock() {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [taxName, setTaxName] = useState<string>('');
  const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const partiesRef = ref(rtdb, `users/${userId}/parties`);
    const q = query(partiesRef, orderByChild('type'), equalTo('buyer'));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) as Party[];
        setParties(list.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setParties([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId || !selectedParty?.id) {
      setTransactions([]);
      return;
    }

    const transRef = ref(rtdb, `users/${userId}/transactions`);
    const unsubscribe = onValue(transRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) as Transaction[];
        // Filter transactions where partyId is selectedParty.id OR relatedPartyId is selectedParty.id
        const filtered = list.filter(t => t.partyId === selectedParty.id || t.relatedPartyId === selectedParty.id);
        setTransactions(filtered.sort((a, b) => (a.date || 0) - (b.date || 0)));
      } else {
        setTransactions([]);
      }
    });

    return () => unsubscribe();
  }, [selectedParty]);

  const handleAddTax = async () => {
    if (!selectedParty || taxAmount <= 0) return;
    setLoading(true);

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');

      const partyRef = ref(rtdb, `users/${userId}/parties/${selectedParty.id}`);
      const partySnapshot = await get(partyRef);
      if (!partySnapshot.exists()) throw new Error('Party not found');

      const partyData = partySnapshot.val() as Party;
      const currentDebit = (partyData.currentDebit || 0) + taxAmount;

      const updates: any = {};
      const transId = push(ref(rtdb, `users/${userId}/transactions`)).key;
      
      updates[`/users/${userId}/transactions/${transId}`] = {
        partyId: selectedParty.id,
        partyName: selectedParty.name,
        type: 'Tax',
        amount: taxAmount,
        totalValue: taxAmount,
        taxName: taxName || 'Tax',
        date: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      updates[`/users/${userId}/parties/${selectedParty.id}/currentDebit`] = currentDebit;
      updates[`/users/${userId}/parties/${selectedParty.id}/lastUpdated`] = serverTimestamp();

      await update(ref(rtdb), updates);
      toast.success('Tax added successfully');
      setIsTaxDialogOpen(false);
      setTaxAmount(0);
      setTaxName('');
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.WRITE, 'transactions');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredParties = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (selectedParty) {
    let runningBalance = selectedParty.openingBalance;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedParty(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Sales Stock: {selectedParty.name}</h2>
              <p className="text-sm text-muted-foreground">Opening Balance: {formatCurrency(selectedParty.openingBalance)}</p>
            </div>
          </div>
          
          <Dialog open={isTaxDialogOpen} onOpenChange={setIsTaxDialogOpen}>
            <DialogTrigger render={<Button className="flex items-center gap-2" />}>
              <Percent className="w-4 h-4" />
              Add Tax
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Tax for {selectedParty.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="taxName">Tax Name</Label>
                  <Input 
                    id="taxName" 
                    value={taxName} 
                    onChange={e => setTaxName(e.target.value)}
                    placeholder="e.g. GST, Service Tax"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax">Tax Amount (₹)</Label>
                  <Input 
                    id="tax" 
                    type="number" 
                    value={taxAmount} 
                    onChange={e => setTaxAmount(Number(e.target.value))}
                    placeholder="Enter amount"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTaxDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTax} disabled={loading || taxAmount <= 0}>
                  {loading ? 'Adding...' : 'Add Tax'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Price (per kg)</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Total Price</TableHead>
                  <TableHead className="text-right pr-6">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No transactions found for this party.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => {
                    const isPayment = t.type === 'Money Received';
                    const isTax = t.type === 'Tax';
                    
                    // Calculate effect on balance
                    // For a buyer:
                    // Material Sent (Debit) -> +
                    // Tax (Debit) -> +
                    // Money Received (Credit) -> -
                    // Material Received (Credit) -> -
                    // Money Given (Debit) -> +
                    
                    let effect = 0;
                    if (t.type === 'Material Sent' || t.type === 'Tax' || t.type === 'Money Given') {
                      effect = t.totalValue || t.amount || 0;
                    } else if (t.type === 'Money Received' || t.type === 'Material Received') {
                      effect = -(t.totalValue || t.amount || 0);
                    }
                    
                    runningBalance += effect;

                    return (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 text-sm">
                          {t.date ? format(new Date(t.date), 'dd/MM/yyyy') : 'Pending...'}
                        </TableCell>
                        <TableCell>
                          {t.price ? `₹${t.price}` : '-'}
                        </TableCell>
                        <TableCell>
                          {t.weight ? (
                            <div className="flex flex-col">
                              <span className="font-bold">{formatWeight(t.weight)}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{t.material}</span>
                            </div>
                          ) : (
                            <span className={isTax ? "text-red-600 font-bold" : isPayment ? "text-blue-600 font-bold" : ""}>
                              {isTax ? (t.taxName || 'Tax') : t.type}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold",
                          isTax ? "text-red-600" : isPayment ? "text-blue-600" : ""
                        )}>
                          {formatCurrency(t.totalValue || t.amount || 0)}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono font-bold">
                          {formatCurrency(runningBalance)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              <tfoot className="bg-muted/30">
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold pl-6">Current Balance:</TableCell>
                  <TableCell className="text-right pr-6 font-mono font-bold text-lg">
                    {formatCurrency(runningBalance)}
                  </TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">Sales Stock</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search buyers..." 
          className="pl-10" 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredParties.map(party => (
          <Card 
            key={party.id} 
            className="cursor-pointer hover:border-primary transition-colors group"
            onClick={() => setSelectedParty(party)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">{party.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Click to view sales history</p>
            </CardContent>
          </Card>
        ))}
        {filteredParties.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No buyers found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
