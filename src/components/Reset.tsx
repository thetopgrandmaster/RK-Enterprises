import React, { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { Party } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { handleDatabaseError, OperationType } from '../lib/database-errors';

export default function Reset() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const partiesRef = ref(rtdb, `users/${userId}/parties`);
    const unsubscribeParties = onValue(partiesRef, (snapshot) => {
      const data = snapshot.val();
      setParties(data ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) : []);
    });

    return () => unsubscribeParties();
  }, []);

  const handleSystemReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      toast.info('Click again to confirm full system reset');
      setTimeout(() => setResetConfirm(false), 5000);
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
      const updates: any = {};
      
      // Reset all party balances
      parties.forEach(party => {
        updates[`/users/${userId}/parties/${party.id}/currentDebit`] = 0;
        updates[`/users/${userId}/parties/${party.id}/currentCredit`] = 0;
      });

      // Clear all other collections
      updates[`/users/${userId}/transactions`] = null;
      updates[`/users/${userId}/stockEntries`] = null;
      updates[`/users/${userId}/dailyEntries`] = null;

      await update(ref(rtdb), updates);
      toast.success('System reset successful. All data cleared.');
      setResetConfirm(false);
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.WRITE, 'system-reset');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <RefreshCcw className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">System Reset</h2>
      </div>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="w-6 h-6" />
            <CardTitle>Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-base">
            This action is permanent and cannot be undone. Please read carefully what will happen:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>All <strong>Transaction History</strong> will be permanently deleted.</li>
            <li>All <strong>Godown Stock</strong> entries will be cleared.</li>
            <li>All <strong>Daily Cash Tracker</strong> records will be removed.</li>
            <li>All <strong>Party Balances</strong> (Debit & Credit) will be reset to ₹0.</li>
            <li><span className="font-bold text-foreground">Note:</span> Your list of Parties will remain, but their balances will be zeroed out.</li>
          </ul>

          <div className="pt-6">
            <Button 
              variant={resetConfirm ? "destructive" : "outline"} 
              className="w-full py-6 text-lg font-bold"
              onClick={handleSystemReset}
              disabled={loading}
            >
              {loading ? 'Processing...' : (resetConfirm ? "CONFIRM FULL SYSTEM RESET" : "Reset All System Data")}
            </Button>
            {resetConfirm && (
              <p className="text-center text-xs text-destructive mt-2 animate-pulse font-medium">
                Warning: Clicking again will immediately wipe all data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
