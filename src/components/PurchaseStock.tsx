import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { Party, StockEntry } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, ShoppingBag, ArrowLeft } from 'lucide-react';
import { formatWeight } from '../lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function PurchaseStock() {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyStock, setPartyStock] = useState<StockEntry[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'parties'), where('type', '==', 'seller'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setParties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedParty?.id) {
      setPartyStock([]);
      return;
    }

    const q = query(
      collection(db, 'stockEntries'),
      where('sourcePartyId', '==', selectedParty.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPartyStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockEntry)));
    });

    return () => unsubscribe();
  }, [selectedParty]);

  const filteredParties = parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (selectedParty) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedParty(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">Stock from {selectedParty.name}</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Weight (Raw)</TableHead>
                  <TableHead className="text-right">Weight (Kg)</TableHead>
                  <TableHead>Packaging</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partyStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No stock entries found for this party.
                    </TableCell>
                  </TableRow>
                ) : (
                  partyStock.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-6 text-sm">
                        {entry.date?.toDate ? format(entry.date.toDate(), 'dd/MM/yyyy HH:mm') : 'Pending...'}
                      </TableCell>
                      <TableCell className="font-bold">{entry.material}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.weightRaw}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatWeight(entry.weightKg)}</TableCell>
                      <TableCell className="text-xs">{entry.packagingType}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
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
        <h2 className="text-2xl font-bold tracking-tight">Purchase Stock</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search sellers..." 
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
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Click to view stock history</p>
            </CardContent>
          </Card>
        ))}
        {filteredParties.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            No sellers found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
