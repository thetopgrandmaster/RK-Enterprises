import { useState, useEffect } from 'react';
import { rtdb } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { StockEntry, MaterialType } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { formatWeight } from '../lib/utils';

const MATERIALS: MaterialType[] = ['AA', 'CK', 'AW', 'AC', 'LS', 'BC', 'AWC'];

export default function LoadSheet() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stockRef = ref(rtdb, 'stockEntries');
    const unsubscribeEntries = onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) as StockEntry[];
        setEntries(list.sort((a, b) => (b.date || 0) - (a.date || 0)));
      } else {
        setEntries([]);
      }
    });

    const settingsRef = ref(rtdb, 'settings/loadSheet');
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSelectedIds(data.selectedIds || {});
      } else {
        setSelectedIds({});
      }
    });

    return () => {
      unsubscribeEntries();
      unsubscribeSettings();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Filter entries that are selected
  const selectedEntries = entries.filter(e => selectedIds[e.id!]);

  // Group selected entries by material
  const groupedEntries: Record<MaterialType, StockEntry[]> = MATERIALS.reduce((acc, m) => {
    acc[m] = selectedEntries.filter(e => e.material === m);
    return acc;
  }, {} as Record<MaterialType, StockEntry[]>);

  // Only show materials that have entries
  const activeMaterials = MATERIALS.filter(m => groupedEntries[m].length > 0);

  // Find the maximum number of entries for any material to determine row count, but at least 25 as requested
  const maxRows = Math.max(25, ...activeMaterials.map(m => groupedEntries[m].length));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold tracking-tight">Load Sheet</h2>
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Print Load Sheet
        </Button>
      </div>

      <Card className="print:shadow-none print:border-none print:m-0 print:p-0">
        <CardHeader className="text-center border-b pb-6 print:pb-4">
          <CardTitle className="text-4xl font-black uppercase tracking-widest text-primary print:text-black">RK Enterprises</CardTitle>
          <p className="text-sm font-bold mt-1 tracking-widest uppercase">Load Sheet</p>
          <div className="flex justify-start mt-6 text-sm font-bold uppercase">
            <span>Date: {new Date().toLocaleDateString()}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/50 print:bg-transparent">
                {activeMaterials.map(m => (
                  <TableHead key={m} className="border-2 border-black text-center font-black text-black py-2 text-lg">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(maxRows)].map((_, rowIndex) => (
                <TableRow key={rowIndex} className="h-8 border-0">
                  {activeMaterials.map(m => {
                    const entry = groupedEntries[m][rowIndex];
                    return (
                      <TableCell key={m} className="border-0 text-center font-mono font-bold text-base py-1 px-2">
                        {entry ? `${formatWeight(entry.weightKg)}${entry.packagingType === 'Loose' ? ' L' : ''}` : ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-black h-12 print:bg-transparent">
                {activeMaterials.map(m => {
                  const total = groupedEntries[m].reduce((sum, e) => sum + e.weightKg, 0);
                  return (
                    <TableCell key={m} className="border-0 text-center text-black text-xs font-black">
                      {total > 0 ? `${total.toFixed(3)} Kg` : ''}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>

          <div className="mt-8 px-8 pb-8 text-xs italic text-muted-foreground print:hidden">
            * Only items selected in the Godown Stock page are shown here.
          </div>
        </CardContent>
      </Card>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none, .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          @page {
            margin: 0.5cm;
            size: portrait;
          }
          .h-8 { height: 2rem !important; }
          .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
        }
      `}} />
    </div>
  );
}
