import React, { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, push, set, update, remove, query, orderByChild, equalTo, serverTimestamp } from 'firebase/database';
import { Party, Transaction } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';
import { formatCurrency, customRound } from '../lib/utils';
import { format } from 'date-fns';
import { handleDatabaseError, OperationType } from '../lib/database-errors';

export default function Parties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'seller' as 'seller' | 'buyer',
    openingBalance: 0,
  });

  const [selectedPartyForHistory, setSelectedPartyForHistory] = useState<Party | null>(null);
  const [partyTransactions, setPartyTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const partiesRef = ref(rtdb, `users/${userId}/parties`);
    const unsubscribe = onValue(partiesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const partiesList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value,
        })) as Party[];
        // Sort by name client-side for simplicity
        setParties(partiesList.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setParties([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId || !selectedPartyForHistory?.id) {
      setPartyTransactions([]);
      return;
    }

    const transactionsRef = ref(rtdb, `users/${userId}/transactions`);
    const q = query(transactionsRef, orderByChild('partyId'), equalTo(selectedPartyForHistory.id));
    
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value,
        })) as Transaction[];
        // Sort by date desc client-side
        setPartyTransactions(transList.sort((a, b) => (b.date || 0) - (a.date || 0)));
      } else {
        setPartyTransactions([]);
      }
    });

    return () => unsubscribe();
  }, [selectedPartyForHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }

      if (editingParty) {
        await update(ref(rtdb, `users/${userId}/parties/${editingParty.id}`), {
          name: formData.name,
          type: formData.type,
          openingBalance: Number(formData.openingBalance),
        });
        toast.success('Party updated successfully');
      } else {
        const newPartyRef = push(ref(rtdb, `users/${userId}/parties`));
        await set(newPartyRef, {
          ...formData,
          openingBalance: Number(formData.openingBalance),
          currentDebit: 0,
          currentCredit: 0,
          createdAt: serverTimestamp(),
        });
        toast.success('Party added successfully');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      const message = handleDatabaseError(error, editingParty ? OperationType.UPDATE : OperationType.CREATE, 'parties');
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'seller', openingBalance: 0 });
    setEditingParty(null);
  };

  const handleEdit = (party: Party) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      type: party.type,
      openingBalance: party.openingBalance,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }
      await remove(ref(rtdb, `users/${userId}/parties/${id}`));
      toast.success('Party deleted successfully');
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.DELETE, `parties/${id}`);
      toast.error(message);
    }
  };

  const filteredParties = parties
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const balA = a.openingBalance + (a.currentDebit || 0) - (a.currentCredit || 0);
      const balB = b.openingBalance + (b.currentDebit || 0) - (b.currentCredit || 0);

      const getPriority = (bal: number) => {
        if (bal > 0) return 1;
        if (bal < 0) return 2;
        return 3;
      };

      const priA = getPriority(balA);
      const priB = getPriority(balB);

      if (priA !== priB) {
        return priA - priB;
      }

      // Within the same group, sort by balance amount descending
      return Math.abs(balB) - Math.abs(balA);
    });

  if (selectedPartyForHistory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPartyForHistory(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Transaction History: {selectedPartyForHistory.name}</h2>
            <Badge variant="outline" className={`text-lg px-4 py-1 ${
              (selectedPartyForHistory.openingBalance || 0) + 
              (selectedPartyForHistory.currentDebit || 0) - 
              (selectedPartyForHistory.currentCredit || 0) >= 0 
              ? 'text-blue-600 border-blue-200 bg-blue-50' 
              : 'text-orange-600 border-orange-200 bg-orange-50'
            }`}>
              Bal: {formatCurrency(
                (selectedPartyForHistory.openingBalance || 0) + 
                (selectedPartyForHistory.currentDebit || 0) - 
                (selectedPartyForHistory.currentCredit || 0)
              )}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Party Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="font-bold capitalize">{selectedPartyForHistory.type}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Opening Balance</span>
                <span className="font-mono font-bold">{formatCurrency(selectedPartyForHistory.openingBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Total Debit (+)</span>
                <span className="font-mono font-bold text-blue-600">{formatCurrency(selectedPartyForHistory.currentDebit || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed">
                <span className="text-sm text-muted-foreground">Total Credit (-)</span>
                <span className="font-mono font-bold text-orange-600">{formatCurrency(selectedPartyForHistory.currentCredit || 0)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right pr-6">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partyTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        No transactions found for this party.
                      </TableCell>
                    </TableRow>
                  ) : (
                    partyTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 text-xs whitespace-nowrap">
                          {t.date?.toDate ? format(t.date.toDate(), 'dd/MM/yy HH:mm') : t.date || 'Pending...'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.type.includes('Material') ? 'secondary' : 'outline'} className="text-[10px] whitespace-nowrap">
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.material && <span className="font-bold">{t.material} </span>}
                          {t.weight && <span>{t.weight} Kg </span>}
                          {t.price && <span className="text-muted-foreground">@ ₹{t.price}</span>}
                          {t.amount && <span>₹{t.amount}</span>}
                          {t.taxName && <span className="font-bold text-blue-600 italic">({t.taxName})</span>}
                          {t.paymentDetails && <span className="text-muted-foreground italic block">Note: {t.paymentDetails}</span>}
                        </TableCell>
                        <TableCell className={`text-right pr-6 font-mono font-bold ${
                          t.type === 'Material Sent' || t.type === 'Money Given' || t.type === 'Tax' ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {t.type === 'Material Sent' || t.type === 'Money Given' || t.type === 'Tax' ? '+' : '-'}
                          {formatCurrency(t.totalValue || t.amount || 0)}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Party Ledgers</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={<Button className="flex items-center gap-2" />}>
            <Plus className="w-4 h-4" />
            Add Party
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingParty ? 'Edit Party' : 'Add New Party'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Party Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Party Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val: 'seller' | 'buyer') => setFormData({...formData, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Seller</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingBalance">Opening Balance (Debit - Credit)</Label>
                <Input 
                  id="openingBalance" 
                  type="number" 
                  value={formData.openingBalance} 
                  onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} 
                  required 
                />
                <p className="text-xs text-muted-foreground">Positive: They owe you. Negative: You owe them.</p>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">
                  {editingParty ? 'Update Party' : 'Create Party'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search parties..." 
              className="pl-10" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Opening Bal</TableHead>
                  <TableHead className="text-right">Debit (+)</TableHead>
                  <TableHead className="text-right">Credit (-)</TableHead>
                  <TableHead className="text-right font-bold">Running Bal</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No parties found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParties.map((party) => {
                    const rawBalance = party.openingBalance + (party.currentDebit || 0) - (party.currentCredit || 0);
                    const runningBalance = customRound(rawBalance);
                    return (
                      <TableRow key={party.id}>
                        <TableCell 
                          className="font-medium cursor-pointer hover:text-primary hover:underline"
                          onClick={() => setSelectedPartyForHistory(party)}
                        >
                          {party.name}
                        </TableCell>
                        <TableCell className="capitalize">{party.type}</TableCell>
                        <TableCell className="text-right">{formatCurrency(party.openingBalance)}</TableCell>
                        <TableCell className="text-right text-blue-600">{formatCurrency(party.currentDebit || 0)}</TableCell>
                        <TableCell className="text-right text-orange-600">{formatCurrency(party.currentCredit || 0)}</TableCell>
                        <TableCell className={`text-right font-bold ${runningBalance > 0 ? 'text-blue-600' : runningBalance < 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {formatCurrency(rawBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                            runningBalance > 0 ? 'bg-blue-100 text-blue-700' : 
                            runningBalance < 0 ? 'bg-orange-100 text-orange-700' : 
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {runningBalance > 0 ? 'They Owe' : runningBalance < 0 ? 'I Owe' : 'Settled'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(party)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(party.id!)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
