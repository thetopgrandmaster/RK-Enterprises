import React, { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, push, set, remove, serverTimestamp } from 'firebase/database';
import { DailyEntry } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { format, isToday, isSameDay } from 'date-fns';
import { handleDatabaseError, OperationType } from '../lib/database-errors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DailyTracker() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [outgoingName, setOutgoingName] = useState('');
  const [outgoingAmount, setOutgoingAmount] = useState('');

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const dailyRef = ref(rtdb, `users/${userId}/dailyEntries`);
    const unsubscribe = onValue(dailyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const entriesList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value,
        })) as DailyEntry[];
        // Sort by date desc client-side
        setEntries(entriesList.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : (typeof a.date === 'number' ? a.date : 0);
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : (typeof b.date === 'number' ? b.date : 0);
          return dateB - dateA;
        }));
      } else {
        setEntries([]);
      }
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
      const userId = auth.currentUser?.uid;
      if (!userId) {
        toast.error('User not authenticated');
        return;
      }

      const newEntryRef = push(ref(rtdb, `users/${userId}/dailyEntries`));
      
      // If adding for today, use serverTimestamp, otherwise use the selected date at current time
      let entryDate;
      if (isToday(selectedDate)) {
        entryDate = serverTimestamp();
      } else {
        const now = new Date();
        const d = new Date(selectedDate);
        d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
        entryDate = d.getTime();
      }

      await set(newEntryRef, {
        type,
        name,
        amount,
        date: entryDate,
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
      const message = handleDatabaseError(error, OperationType.CREATE, 'dailyEntries');
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      await remove(ref(rtdb, `users/${userId}/dailyEntries/${id}`));
      toast.success('Entry deleted');
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.DELETE, `dailyEntries/${id}`);
      toast.error(message);
    }
  };

  const getEntryDate = (date: any) => {
    if (!date) return new Date();
    if (date.toDate) return date.toDate();
    return new Date(date);
  };

  const filteredEntries = entries.filter(e => isSameDay(getEntryDate(e.date), selectedDate));
  
  const incomeEntries = filteredEntries.filter(e => e.type === 'income');
  const outgoingEntries = filteredEntries.filter(e => e.type === 'outgoing');

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
  const totalOutgoing = outgoingEntries.reduce((sum, e) => sum + e.amount, 0);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Daily Cash Tracker</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover>
              <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "h-8 justify-start text-left font-normal w-[180px]", !selectedDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(1)} disabled={isToday(selectedDate)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            {!isToday(selectedDate) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="px-4 py-2 bg-blue-50 border-blue-200">
            <span className="text-xs text-blue-600 font-bold uppercase">
              {isToday(selectedDate) ? "Today's Income" : "Income Total"}
            </span>
            <p className="text-lg font-black text-blue-700">{formatCurrency(totalIncome)}</p>
          </Card>
          <Card className="px-4 py-2 bg-orange-50 border-orange-200">
            <span className="text-xs text-orange-600 font-bold uppercase">
              {isToday(selectedDate) ? "Today's Outgoing" : "Outgoing Total"}
            </span>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <ArrowUpCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm italic">No income recorded for {isToday(selectedDate) ? "today" : format(selectedDate, "PP")}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    incomeEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {e.date?.toDate ? format(e.date.toDate(), 'dd/MM HH:mm') : (typeof e.date === 'number' ? format(new Date(e.date), 'dd/MM HH:mm') : 'Pending...')}
                        </TableCell>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outgoingEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        <ArrowDownCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm italic">No outgoing recorded for {isToday(selectedDate) ? "today" : format(selectedDate, "PP")}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    outgoingEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {e.date?.toDate ? format(e.date.toDate(), 'dd/MM HH:mm') : (typeof e.date === 'number' ? format(new Date(e.date), 'dd/MM HH:mm') : 'Pending...')}
                        </TableCell>
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
