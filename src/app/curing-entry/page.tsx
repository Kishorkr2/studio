
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Save, RotateCcw, Calendar, Plus, X, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CuringLogEntry, SkuPlan, Machine } from '@/lib/types';
import * as actions from '@/app/actions';
import { Loader } from '@/components/ui/loader';

interface CavityItem { sku: string; qty: number; size?: string; }
interface PressEntry { press_no: number; cavity_l_items?: CavityItem[]; cavity_r_items?: CavityItem[]; }

export default function CuringEntryPage() {
  const [allSkus, setAllSkus] = useState<SkuPlan[]>([]);
  const [allPresses, setAllPresses] = useState<Machine[]>([]);
  const [filteredSkus, setFilteredSkus] = useState<SkuPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPress, setSelectedPress] = useState<Machine | null>(null);
  const [entries, setEntries] = useState<Record<number, PressEntry>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [shift, setShift] = useState<'Day' | 'Night' | 'Combined'>('Day');

  // local inputs
  const [cavitySide, setCavitySide] = useState<'L' | 'R'>('L');
  const [skuInput, setSkuInput] = useState('');
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [sizeInput, setSizeInput] = useState('');

  const { toast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const [plan, machines] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('CuringPress'),
      ]);
      const skus = Array.isArray(plan) ? plan.flatMap((p: any) => p.skus || []) : [];
      const uniqueSkus = Array.from(new Map(skus.map((s: any) => [s.sku ?? s.sapCode ?? JSON.stringify(s), s])).values());
      setAllSkus(uniqueSkus);
      setFilteredSkus(uniqueSkus);
      setAllPresses(machines);
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast({ variant: 'destructive', title: 'Failed to load initial data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    if (!searchTerm) return setFilteredSkus(allSkus);
    const q = searchTerm.toLowerCase();
    const filtered = allSkus.filter(sku => ((sku.sku || '') + ' ' + (sku.sapCode || '') + ' ' + (sku.size || '')).toLowerCase().includes(q));
    setFilteredSkus(filtered);
  }, [searchTerm, allSkus]);
  
  const getPressNumber = (pressName: string) => {
    const match = pressName.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const pressGrid = useMemo(() => 
    allPresses.sort((a,b) => getPressNumber(a.name) - getPressNumber(b.name)),
  [allPresses]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); }
        if (e.key === 's') { e.preventDefault(); void handleSaveAll(); }
      }
      if (e.key === 'Escape') { setSelectedPress(null); setSearchTerm(''); }
      if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key) && selectedPress) {
        e.preventDefault();
        const currentIndex = pressGrid.findIndex(p => p.id === selectedPress.id);
        if (currentIndex === -1) {
            if (pressGrid.length > 0) setSelectedPress(pressGrid[0]);
            return;
        }

        let nextIndex = currentIndex;
        const numCols = 7;
        if (e.key === 'ArrowRight') nextIndex = Math.min(pressGrid.length - 1, currentIndex + 1);
        if (e.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
        if (e.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - numCols);
        if (e.key === 'ArrowDown') nextIndex = Math.min(pressGrid.length - 1, currentIndex + numCols);

        setSelectedPress(pressGrid[nextIndex]);
      }
      if (e.key === 'Enter' && selectedPress) {
        document.getElementById('entry-sku-select')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pressGrid, selectedPress]);

  const handleAddPressEntry = () => {
    if (!selectedPress) { toast({ variant: 'destructive', title: 'Select a press first' }); return; }
    if (!skuInput) { toast({ variant: 'destructive', title: 'Enter SKU' }); return; }
    if (!qtyInput || qtyInput <= 0) { toast({ variant: 'destructive', title: 'Enter a valid quantity' }); return; }

    const pressNo = getPressNumber(selectedPress.name);

    setEntries(prev => {
      const existing = prev[pressNo] || { press_no: pressNo } as PressEntry;
      const item: CavityItem = { sku: skuInput, qty: Number(qtyInput), size: sizeInput || undefined };
      const updatedCavityItems = (cavitySide === 'L' ? existing.cavity_l_items : existing.cavity_r_items) || [];
      const newItems = [...updatedCavityItems, item];
      
      return { 
        ...prev, 
        [pressNo]: { 
          ...existing, 
          [cavitySide === 'L' ? 'cavity_l_items' : 'cavity_r_items']: newItems 
        } 
      };
    });

    toast({ title: `Added P${pressNo} ${cavitySide}: ${skuInput} x${qtyInput}` });

    setSkuInput(''); 
    setQtyInput(''); 
    setSizeInput('');
    document.getElementById('entry-sku-select')?.focus();
  };
  
  const handleRemoveItem = (pressNo: number, side: 'L' | 'R', itemIndex: number) => {
    setEntries(prev => {
      const pressEntry = { ...prev[pressNo] };
      if (side === 'L') {
        pressEntry.cavity_l_items = pressEntry.cavity_l_items?.filter((_, i) => i !== itemIndex);
      } else {
        pressEntry.cavity_r_items = pressEntry.cavity_r_items?.filter((_, i) => i !== itemIndex);
      }
      return { ...prev, [pressNo]: pressEntry };
    });
    toast({title: 'Item removed'});
  };

  const handleSkuSelect = (skuStr: string) => {
    const sku = allSkus.find(s => s.sku === skuStr || s.sapCode === skuStr) as any;
    setSkuInput(skuStr);
    if (sku?.size) setSizeInput(sku.size);
    setSearchTerm('');
    setTimeout(() => { const el = document.querySelector<HTMLInputElement>('#final-qty-input'); el?.focus(); el?.select(); }, 50);
  };

  const handleSaveAll = async () => {
    const entriesToSave = Object.values(entries).filter(entry => (entry.cavity_l_items && entry.cavity_l_items.length > 0) || (entry.cavity_r_items && entry.cavity_r_items.length > 0));
    if (entriesToSave.length === 0) { toast({ variant: 'destructive', title: 'No entries to save' }); return; }
    
    setLoading(true);
    try {
      for (const entry of entriesToSave) {
        const curingEntry: CuringLogEntry = {
          press_no: entry.press_no,
          cavity1_items: entry.cavity_l_items || [],
          cavity2_items: entry.cavity_r_items || [],
          date: selectedDate,
          shift
        };
        await actions.saveCuringLogEntry(curingEntry);
      }
      toast({ title: `✅ Saved ${entriesToSave.length} entries successfully` });
      setEntries({});
    } catch (error) {
      console.error('Save failed', error);
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setLoading(false);
    }
  };

  const totalProduction = Object.values(entries).reduce((sum, e) => {
    const l = (e.cavity_l_items || []).reduce((s, it) => s + (it.qty || 0), 0);
    const r = (e.cavity_r_items || []).reduce((s, it) => s + (it.qty || 0), 0);
    return sum + l + r;
  }, 0);

  if (loading && allPresses.length === 0) return <div className="flex justify-center items-center min-h-screen"><Loader /></div>;
  
  const renderCavitySummary = (items?: CavityItem[]) => {
    if (!items || items.length === 0) return <span className="text-gray-400">-</span>;
    return items.map(it => `${it.sku}(${it.qty})`).join('; ');
  };
  
  const selectedPressEntry = selectedPress ? entries[getPressNumber(selectedPress.name)] : null;
  const selectedPressNumber = selectedPress ? getPressNumber(selectedPress.name) : null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Curing Production Entry</h1>
                    <p className="text-muted-foreground mt-1">Select a press to begin data entry.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                     <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="pl-9 h-10 w-44" />
                     </div>
                     <Select value={shift} onValueChange={(v) => setShift(v as any)}>
                        <SelectTrigger className="h-10 w-40"><SelectValue placeholder="Shift" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Day">Day (9→19)</SelectItem>
                            <SelectItem value="Night">Night (21→7)</SelectItem>
                            <SelectItem value="Combined">Combined</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {pressGrid.map(press => {
                    const pressNo = getPressNumber(press.name);
                    const entry = entries[pressNo];
                    const hasData = entry && ((entry.cavity_l_items && entry.cavity_l_items.length > 0) || (entry.cavity_r_items && entry.cavity_r_items.length > 0));
                    const isSelected = selectedPress?.id === press.id;
                    return (
                        <Card 
                            key={press.id} 
                            className={`cursor-pointer transform transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${isSelected ? 'ring-2 ring-indigo-500 shadow-xl' : 'hover:ring-1 hover:ring-indigo-300'} ${hasData ? 'bg-green-50 border-green-200' : 'bg-white'}`} 
                            onClick={() => setSelectedPress(press)}
                        >
                            <CardContent className="p-3 text-center">
                                <p className="font-semibold text-lg">{press.name}</p>
                                <div className="text-xs text-muted-foreground mt-1 min-h-[28px]">
                                    {hasData && (
                                        <>
                                         <div className="flex justify-between"><span className="opacity-70">L:</span><span className="font-medium">{renderCavitySummary(entry?.cavity_l_items)}</span></div>
                                         <div className="flex justify-between"><span className="opacity-70">R:</span><span className="font-medium">{renderCavitySummary(entry?.cavity_r_items)}</span></div>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </main>
        
        <aside className="w-full md:w-96 lg:w-[420px] bg-white border-l flex flex-col shadow-lg">
            <CardHeader className="flex-shrink-0">
                <CardTitle>{selectedPress ? `Editing ${selectedPress.name}` : 'Select a Press'}</CardTitle>
                <CardDescription>{selectedPress ? 'Add production data for each cavity.' : 'Choose a press from the grid to start.'}</CardDescription>
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
                {selectedPress ? (
                    <>
                        {/* Entry Form */}
                        <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                            <h3 className="font-semibold">Add New Item</h3>
                             <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="cavity-side">Cavity</Label>
                                    <Select value={cavitySide} onValueChange={v => setCavitySide(v as any)}>
                                        <SelectTrigger id="cavity-side"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="L">Left</SelectItem>
                                            <SelectItem value="R">Right</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="final-qty-input">Quantity</Label>
                                    <Input id="final-qty-input" type="number" placeholder="Qty" value={qtyInput} onChange={e => setQtyInput(e.target.value === '' ? '' : Number(e.target.value))} />
                                </div>
                             </div>
                              <div className="space-y-1">
                                <Label htmlFor="entry-sku-select">SKU</Label>
                                <Select value={skuInput} onValueChange={v => { setSkuInput(v); const o = allSkus.find(x=>x.sku===v); if(o?.size) setSizeInput(o.size); }}>
                                    <SelectTrigger id="entry-sku-select"><SelectValue placeholder="Select SKU" /></SelectTrigger>
                                    <SelectContent className="max-h-56">
                                    {allSkus.map(s => <SelectItem key={s.sapCode} value={s.sku}>{s.sku} {s.sapCode ? `• ${s.sapCode}`:''}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full" onClick={handleAddPressEntry} disabled={loading}>
                                <Plus className="mr-2 h-4 w-4" /> Add Item
                            </Button>
                        </div>
                        
                        {/* Current Entries for Selected Press */}
                        <div className="space-y-4">
                            <h3 className="font-semibold">Current Entries for {selectedPress.name}</h3>
                            <div className="space-y-3">
                                <Card>
                                    <CardHeader className="p-3 bg-blue-50">
                                        <h4 className="font-medium text-sm text-blue-800">Left Cavity</h4>
                                    </CardHeader>
                                    <CardContent className="p-3 text-sm space-y-2">
                                        {selectedPressEntry?.cavity_l_items && selectedPressEntry.cavity_l_items.length > 0 ? selectedPressEntry.cavity_l_items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-blue-100/50 p-2 rounded-md">
                                                <span>{item.sku} ({item.qty})</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(selectedPressNumber!, 'L', i)}><X className="h-4 w-4" /></Button>
                                            </div>
                                        )) : <p className="text-muted-foreground">No entries</p>}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="p-3 bg-green-50">
                                        <h4 className="font-medium text-sm text-green-800">Right Cavity</h4>
                                    </CardHeader>
                                    <CardContent className="p-3 text-sm space-y-2">
                                         {selectedPressEntry?.cavity_r_items && selectedPressEntry.cavity_r_items.length > 0 ? selectedPressEntry.cavity_r_items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-green-100/50 p-2 rounded-md">
                                                <span>{item.sku} ({item.qty})</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(selectedPressNumber!, 'R', i)}><X className="h-4 w-4" /></Button>
                                            </div>
                                        )) : <p className="text-muted-foreground">No entries</p>}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-muted-foreground pt-16">
                        <div className="flex items-center justify-center">
                            <ArrowLeft className="w-6 h-6 mr-2 animate-pulse"/>
                            <p>Select a press from the grid.</p>
                        </div>
                    </div>
                )}
            </div>
            
            <CardContent className="border-t flex-shrink-0">
                 <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Total Production:</span>
                    <Badge variant="secondary" className="text-lg">{totalProduction.toLocaleString()}</Badge>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEntries({})}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Clear All
                    </Button>
                    <Button className="flex-1" onClick={handleSaveAll} disabled={loading}>
                        <Save className="mr-2 h-4 w-4" /> Save All Entries
                    </Button>
                </div>
            </CardContent>
        </aside>
    </div>
  );
}

    