import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { DailyEntry } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function DailyTracker() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [outgoingName, setOutgoingName] = useState('');
  const [outgoingAmount, setOutgoingAmount] = useState('');

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // We'll show all entries for now, or maybe just today's? 
    // The user said "Daily", usually implies today's entries.
    // Let's fetch all and sort by date desc.
    const q = query(collection(db, 'dailyEntries'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyEntry)));
    });
    return () => unsubscribe();
  }, []);

  const handleAddEntry = async (type: 'income' | 'outgoing') => {
    const name = type === 'income' ? incomeName : outgoingName;
    const amount = type === 'income' ? Number(incomeAmount) : Number(outgoingAmount);

    if (!name || !amount) {
      toast.error('Please enter both name and amount');
      return;
    }

    try {
      await addDoc(collection(db, 'dailyEntries'), {
        type,
        name,
        amount,
        date: serverTimestamp(),
      });
      
      if (type === 'income') {
        setIncomeName('');
        setIncomeAmount('');
      } else {
        setOutgoingName('');
        setOutgoingAmount('');
      }
      toast.success(`${type === 'income' ? 'Income' : 'Outgoing'} recorded`);
    } catch (error) {
      const message = handleFirestoreError(error, OperationType.CREATE, 'dailyEntries');
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'dailyEntries', id));
      toast.success('Entry deleted');
    } catch (error) {
      const message = handleFirestoreError(error, OperationType.DELETE, `dailyEntries/${id}`);
      toast.error(message);
    }
  };

  const incomeEntries = entries.filter(e => e.type === 'income');
  const outgoingEntries = entries.filter(e => e.type === 'outgoing');

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalOutgoing = outgoingEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Daily Cash Tracker</h2>
        <div className="flex gap-4">
          <Card className="px-4 py-2 bg-blue-50 border-blue-200">
            <span className="text-xs text-blue-600 font-bold uppercase">Total Income</span>
            <p className="text-lg font-black text-blue-700">{formatCurrency(totalIncome)}</p>
          </Card>
          <Card className="px-4 py-2 bg-orange-50 border-orange-200">
            <span className="text-xs text-orange-600 font-bold uppercase">Total Outgoing</span>
            <p className="text-lg font-black text-orange-700">{formatCurrency(totalOutgoing)}</p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Income Column */}
        <Card className="border-t-4 border-t-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-blue-500" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Name" 
                value={incomeName} 
                onChange={e => setIncomeName(e.target.value)}
                className="flex-1"
              />
              <Input 
                type="number" 
                placeholder="Amount" 
                value={incomeAmount} 
                onChange={e => setIncomeAmount(e.target.value)}
                className="w-32"
              />
              <Button onClick={() => handleAddEntry('income')} size="icon" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm italic">
                        No income recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomeEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600">{formatCurrency(e.amount)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(e.id!)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Outgoing Column */}
        <Card className="border-t-4 border-t-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-orange-500" />
              Outgoing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Name" 
                value={outgoingName} 
                onChange={e => setOutgoingName(e.target.value)}
                className="flex-1"
              />
              <Input 
                type="number" 
                placeholder="Amount" 
                value={outgoingAmount} 
                onChange={e => setOutgoingAmount(e.target.value)}
                className="w-32"
              />
              <Button onClick={() => handleAddEntry('outgoing')} size="icon" className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outgoingEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm italic">
                        No outgoing recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    outgoingEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-right font-bold text-orange-600">{formatCurrency(e.amount)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(e.id!)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
