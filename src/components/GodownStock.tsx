import { useState, useEffect } from 'react';
import { rtdb, auth } from '../firebase';
import { ref, onValue, set, update, remove, push, serverTimestamp } from 'firebase/database';
import { StockEntry, MaterialType, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatWeight, parseWeight } from '../lib/utils';
import { Warehouse, FileText, CheckSquare, Square, Trash2, ExternalLink, ArrowRight, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { handleDatabaseError, OperationType } from '../lib/database-errors';

const MATERIALS: MaterialType[] = ['AA', 'CK', 'AW', 'AC', 'LS', 'BC', 'AWC', '3 mm', '4 mm', 'CT Plate', 'Hard wire', 'Roofing sheet'];

export default function GodownStock() {
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, boolean>>({});
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [newStock, setNewStock] = useState({
    material: 'AA' as MaterialType,
    weight: '',
    packagingType: 'Gunny Bags' as 'Gunny Bags' | 'Loose',
    bagCount: 1
  });
  
  // States for confirmation dialogs
  const [unselectConfirm, setUnselectConfirm] = useState<{ id: string, type: 'single' | 'material' | 'all', material?: MaterialType } | null>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const stockRef = ref(rtdb, `users/${userId}/stockEntries`);
    const unsubscribeEntries = onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      setEntries(data ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) : []);
    });

    const transRef = ref(rtdb, `users/${userId}/transactions`);
    const unsubscribeTransactions = onValue(transRef, (snapshot) => {
      const data = snapshot.val();
      setTransactions(data ? Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val })) : []);
    });

    const settingsRef = ref(rtdb, `users/${userId}/settings/loadSheet`);
    const unsubscribeLoadSheet = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSelectedEntries(data.selectedIds || {});
      } else {
        setSelectedEntries({});
      }
    });

    return () => {
      unsubscribeEntries();
      unsubscribeTransactions();
      unsubscribeLoadSheet();
    };
  }, []);

  const toggleEntry = async (id: string, checked?: boolean) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !id) return;

    const isCurrentlySelected = !!selectedEntries[id];
    // If incoming checked state is same as current, do nothing
    if (checked !== undefined && checked === isCurrentlySelected) return;

    const targetChecked = checked !== undefined ? checked : !isCurrentlySelected;
    
    // If we are unselecting, ask for confirmation via dialog
    if (isCurrentlySelected && !targetChecked) {
      setUnselectConfirm({ id, type: 'single' });
      return;
    }

    await performToggle(id, targetChecked);
  };

  const performToggle = async (id: string, targetChecked: boolean) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const newSelected = { ...selectedEntries, [id]: targetChecked };
    setSelectedEntries(newSelected);
    
    try {
      await update(ref(rtdb, `users/${userId}/settings/loadSheet`), { selectedIds: newSelected });
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.UPDATE, 'settings/loadSheet');
      toast.error(message);
    }
  };

  const selectAllForMaterial = async (material: MaterialType) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const materialEntries = entries.filter(e => (e.material || '').toLowerCase().trim() === (material || '').toLowerCase().trim());
    const newSelected = { ...selectedEntries };
    materialEntries.forEach(e => {
      newSelected[e.id!] = true;
    });
    setSelectedEntries(newSelected);
    await update(ref(rtdb, `users/${userId}/settings/loadSheet`), { selectedIds: newSelected });
  };

  const deselectAllForMaterial = (material: MaterialType) => {
    setUnselectConfirm({ id: '', type: 'material', material });
  };

  const performDeselectAllForMaterial = async (material: MaterialType) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const materialEntries = entries.filter(e => (e.material || '').toLowerCase().trim() === (material || '').toLowerCase().trim());
    const newSelected = { ...selectedEntries };
    materialEntries.forEach(e => {
      newSelected[e.id!] = false;
    });
    setSelectedEntries(newSelected);
    await update(ref(rtdb, `users/${userId}/settings/loadSheet`), { selectedIds: newSelected });
    setUnselectConfirm(null);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<MaterialType | null>(null);

  const deleteEntry = async (id: string) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      await remove(ref(rtdb, `users/${userId}/stockEntries/${id}`));
      toast.success('Entry deleted');
      setDeletingId(null);
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.DELETE, `stockEntries/${id}`);
      toast.error(message);
    }
  };
    
  const clearAllSelections = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      setSelectedEntries({});
      await update(ref(rtdb, `users/${userId}/settings/loadSheet`), { selectedIds: {} });
      toast.success('All selections cleared');
      setUnselectConfirm(null);
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.UPDATE, 'settings/loadSheet');
      toast.error(message);
    }
  };

  const deleteMaterialStock = async (material: MaterialType) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const materialEntries = entries.filter(e => e.material === material);
      if (materialEntries.length === 0) {
        toast.error('No stock found for this material');
        setDeletingMaterial(null);
        return;
      }
      
      const updates: any = {};
      materialEntries.forEach(e => {
        updates[`/users/${userId}/stockEntries/${e.id}`] = null;
      });
      await update(ref(rtdb), updates);
      toast.success(`All ${material} stock deleted`);
      setDeletingMaterial(null);
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.DELETE, 'stockEntries');
      toast.error(message);
    }
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightKg = parseWeight(newStock.weight);
    if (!weightKg || weightKg <= 0) {
      toast.error('Please enter a valid weight');
      return;
    }

    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const stockId = push(ref(rtdb, `users/${userId}/stockEntries`)).key;
      await set(ref(rtdb, `users/${userId}/stockEntries/${stockId}`), {
        material: newStock.material,
        weightRaw: newStock.weight || weightKg.toString(),
        weightKg: weightKg,
        packagingType: newStock.packagingType,
        bagCount: newStock.packagingType === 'Gunny Bags' ? (newStock.bagCount || 1) : null,
        date: serverTimestamp(),
        isDirectAdd: true
      });

      toast.success('Stock added directly to godown');
      setIsAddingStock(false);
      setNewStock({
        material: 'AA',
        weight: '',
        packagingType: 'Gunny Bags',
        bagCount: 1
      });
    } catch (error) {
      const message = handleDatabaseError(error, OperationType.WRITE, 'stockEntries');
      toast.error(message);
    }
  };

  const getStockForMaterial = (material: MaterialType) => {
    const materialLower = (material || '').toLowerCase().trim();
    
    const additions = entries
      .filter(e => (e.material || '').toLowerCase().trim() === materialLower)
      .map(e => ({ 
        id: e.id,
        weightKg: Number(e.weightKg), 
        raw: e.weightRaw,
        packaging: e.packagingType,
        bagCount: e.bagCount
      }));

    return {
      entries: additions
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Warehouse className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight text-primary">RK Enterprises - Godown Stock</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 hidden sm:flex">
            Select items for Load Sheet
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setUnselectConfirm({ id: '', type: 'all' })}
          >
            Clear All
          </Button>
          <Dialog open={isAddingStock} onOpenChange={setIsAddingStock}>
            <DialogTrigger render={<Button size="sm" className="flex items-center gap-2" />}>
              <Plus className="w-4 h-4" />
              Add Stock Directly
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Physical Stock Directly</DialogTitle>
                <DialogDescription>
                  This adds weight directly to the godown without creating a party transaction.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleDirectAdd} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Material</Label>
                  <Select 
                    value={newStock.material} 
                    onValueChange={(val: MaterialType) => setNewStock({...newStock, material: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIALS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Weight (e.g. 64 x 950)</Label>
                  <Input 
                    type="text" 
                    value={newStock.weight} 
                    onChange={e => setNewStock({...newStock, weight: e.target.value})} 
                    placeholder="64 x 950"
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Packaging Type</Label>
                    <Select 
                      value={newStock.packagingType} 
                      onValueChange={(val: 'Gunny Bags' | 'Loose') => setNewStock({...newStock, packagingType: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gunny Bags">Gunny Bags</SelectItem>
                        <SelectItem value="Loose">Loose</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newStock.packagingType === 'Gunny Bags' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label>No. of Bags</Label>
                      <Input 
                        type="number" 
                        min="1"
                        value={newStock.bagCount || ''} 
                        onChange={e => setNewStock({...newStock, bagCount: Number(e.target.value)})} 
                        placeholder="1"
                      />
                    </div>
                  )}
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddingStock(false)}>Cancel</Button>
                  <Button type="submit">Add to Godown</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <FileText className="w-4 h-4" />
            Load Sheet Ready
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MATERIALS.map(material => {
          const { entries: materialEntries } = getStockForMaterial(material);
          if (materialEntries.length === 0) return null;

          const allSelected = materialEntries.length > 0 && materialEntries.every(e => selectedEntries[e.id!]);

          return (
            <Card key={material} className="overflow-hidden border-l-4 border-l-primary shadow-md">
              <CardHeader className="bg-muted/30 pb-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{material}</CardTitle>
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 hover:bg-primary/10"
                          title="Select All for Load Sheet"
                          onClick={() => allSelected ? deselectAllForMaterial(material) : selectAllForMaterial(material)}
                        >
                          {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </Button>
                        {deletingMaterial === material ? (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 px-2 text-[10px]"
                              onClick={() => deleteMaterialStock(material)}
                            >
                              Confirm
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => setDeletingMaterial(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            title="Delete All Material Stock"
                            onClick={() => setDeletingMaterial(material)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {materialEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No physical stock</p>
                ) : (
                  <div className="space-y-1">
                    {materialEntries.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0 border-dashed group">
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            id={`entry-${entry.id}`} 
                            checked={!!selectedEntries[entry.id!]}
                            onCheckedChange={(checked) => toggleEntry(entry.id!, checked === true)}
                          />
                          <label 
                            htmlFor={`entry-${entry.id}`}
                            className="font-mono text-lg cursor-pointer flex items-center gap-1"
                          >
                            {formatWeight(entry.weightKg)}
                            {entry.packaging === 'Loose' ? ' L' : ''}
                            {entry.packaging === 'Gunny Bags' && entry.bagCount && entry.bagCount > 1 ? ` (${entry.bagCount} bgs)` : ''}
                          </label>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {selectedEntries[entry.id!] && (
                            <Badge variant="secondary" className="text-[10px] h-4 mr-1">Selected</Badge>
                          )}
                          {deletingId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-7 px-2 text-[10px]"
                                onClick={() => deleteEntry(entry.id!)}
                              >
                                Confirm
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                onClick={() => setDeletingId(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingId(entry.id!)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {MATERIALS.every(m => getStockForMaterial(m).entries.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Godown is currently empty. Add stock via the Dashboard.
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog for Unselecting */}
      <Dialog open={unselectConfirm !== null} onOpenChange={(open) => !open && setUnselectConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unselect</DialogTitle>
            <DialogDescription>
              {unselectConfirm?.type === 'single' && "Are you sure you want to unselect this item from the load sheet?"}
              {unselectConfirm?.type === 'material' && `Are you sure you want to unselect all ${unselectConfirm.material} items?`}
              {unselectConfirm?.type === 'all' && "Are you sure you want to clear ALL selections from the load sheet?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUnselectConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (unselectConfirm?.type === 'single') performToggle(unselectConfirm.id, false).then(() => setUnselectConfirm(null));
                else if (unselectConfirm?.type === 'material') performDeselectAllForMaterial(unselectConfirm.material!);
                else if (unselectConfirm?.type === 'all') clearAllSelections();
              }}
            >
              Unselect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
