
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, Calendar as CalendarIcon, Plus, X, List, Factory, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CuringLogEntry, SkuPlan, Machine } from '@/lib/types';
import * as actions from '@/app/actions';
import { Loader } from '@/components/ui/loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface NewEntry {
  id: number;
  pressId: string;
  pressName: string;
  cavity: 'L' | 'R';
  sku: string;
  sapCode: string;
  quantity: number;
}

export default function CuringEntryPage() {
  const [allSkus, setAllSkus] = useState<SkuPlan[]>([]);
  const [allPresses, setAllPresses] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [shift, setShift] = useState<'Day' | 'Night' | 'Combined'>('Day');
  const [entries, setEntries] = useState<NewEntry[]>([]);

  // Form states
  const [pressId, setPressId] = useState('');
  const [cavity, setCavity] = useState<'L' | 'R' | ''>('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { toast } = useToast();

  const loadInitialData = useCallback(async () => {
    try {
      const [plan, machines] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('CuringPress'),
      ]);
      const skus = Array.isArray(plan) ? plan.flatMap((p: any) => p.skus || []) : [];
      const uniqueSkus = Array.from(new Map(skus.map((s: any) => [s.sku ?? s.sapCode ?? JSON.stringify(s), s])).values());
      setAllSkus(uniqueSkus);
      setAllPresses(machines.filter(m => m.isAvailable));
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast({ variant: 'destructive', title: 'Failed to load initial data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);


  const handleAddEntry = () => {
    if (!pressId || !cavity || !sku || !quantity || quantity <= 0) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill all fields with valid data.' });
      return;
    }
    const selectedSku = allSkus.find(s => s.sku === sku);
    const selectedPress = allPresses.find(p => p.id === pressId);

    const newEntry: NewEntry = {
      id: Date.now(),
      pressId: pressId,
      pressName: selectedPress?.name || pressId,
      cavity: cavity as 'L' | 'R',
      sku: sku,
      sapCode: selectedSku?.sapCode || '',
      quantity: Number(quantity),
    };
    
    setEntries(prev => [...prev, newEntry]);

    // Reset form
    setSku('');
    setQuantity('');
    toast({ title: 'Entry Added', description: `${sku} x${quantity} for ${selectedPress?.name} (${cavity})` });
  };
  
  const handleRemoveItem = (id: number) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
    toast({title: 'Item removed'});
  };

  const handleSaveAll = async () => {
    if (entries.length === 0) { toast({ variant: 'destructive', title: 'No entries to save' }); return; }
    if (!selectedDate || !shift) { toast({ variant: 'destructive', title: 'Date or Shift not selected' }); return; }

    setLoading(true);
    
    // Group entries by press
    const entriesByPress = entries.reduce((acc, entry) => {
      if (!acc[entry.pressId]) {
        acc[entry.pressId] = { press_no: parseInt(entry.pressName.match(/\d+/)![0], 10), cavity1_items: [], cavity2_items: [] };
      }
      const item = { sku: entry.sku, qty: entry.quantity };
      if (entry.cavity === 'L') {
        acc[entry.pressId].cavity1_items.push(item);
      } else {
        acc[entry.pressId].cavity2_items.push(item);
      }
      return acc;
    }, {} as Record<string, { press_no: number; cavity1_items: {sku: string, qty: number}[]; cavity2_items: {sku: string, qty: number}[] }>);
    
    try {
      for (const pressData of Object.values(entriesByPress)) {
        const curingEntry: CuringLogEntry = {
          press_no: pressData.press_no,
          cavity1_items: pressData.cavity1_items,
          cavity2_items: pressData.cavity2_items,
          date: format(selectedDate, 'yyyy-MM-dd'),
          shift: shift
        };
        await actions.saveCuringLogEntry(curingEntry);
      }
      
      toast({ title: `✅ Saved ${entries.length} entries successfully` });
      setEntries([]);
    } catch (error) {
      console.error('Save failed', error);
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDateChange = (date: Date | undefined) => {
      setSelectedDate(date);
      setIsDatePickerOpen(false);
  }

  const totalProduction = entries.reduce((sum, e) => sum + e.quantity, 0);

  if (loading) return <div className="flex justify-center items-center min-h-screen"><Loader /></div>;
  
  return (
    <div className="p-4 md:p-8 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Curing Production Entry</h1>
                <p className="text-muted-foreground mt-1">Log production data for curing presses.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-[240px] justify-start text-left font-normal',
                          !selectedDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                 <Select value={shift} onValueChange={(v) => setShift(v as any)}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Shift" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Day">Day (9→19)</SelectItem>
                        <SelectItem value="Night">Night (21→7)</SelectItem>
                        <SelectItem value="Combined">Combined</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </header>

        <Card>
            <CardHeader>
                <CardTitle>Add Production Entry</CardTitle>
                <CardDescription>Fill the form below to log a production quantity for a specific press and cavity.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="press-select">Press No.</Label>
                        <Select value={pressId} onValueChange={setPressId}>
                            <SelectTrigger id="press-select"><SelectValue placeholder="Select Press"/></SelectTrigger>
                            <SelectContent>
                                {allPresses.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="cavity-select">Cavity</Label>
                        <Select value={cavity} onValueChange={(v) => setCavity(v as any)}>
                            <SelectTrigger id="cavity-select"><SelectValue placeholder="Select Cavity"/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="L">Left Cavity</SelectItem>
                                <SelectItem value="R">Right Cavity</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="sku-select">SKU</Label>
                        <Select value={sku} onValueChange={setSku}>
                            <SelectTrigger id="sku-select"><SelectValue placeholder="Select SKU"/></SelectTrigger>
                            <SelectContent>
                                {allSkus.map(s => <SelectItem key={s.sapCode} value={s.sku}>{s.sku} ({s.sapCode})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="qty-input">Quantity</Label>
                        <Input id="qty-input" type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleAddEntry} disabled={loading}>
                    <Plus className="mr-2 h-4 w-4" /> Add Entry
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Current Batch Entries</CardTitle>
                        <CardDescription>Review the entries below before saving them all.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">Total Production:</span>
                        <Badge variant="secondary" className="text-lg">{totalProduction.toLocaleString()}</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Press No.</TableHead>
                                <TableHead>Cavity</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>SAP Code</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No entries added yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {entries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{entry.pressName}</TableCell>
                                    <TableCell>
                                        <Badge variant={entry.cavity === 'L' ? 'outline' : 'secondary'}>
                                            {entry.cavity === 'L' ? 'Left' : 'Right'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{entry.sku}</TableCell>
                                    <TableCell>{entry.sapCode}</TableCell>
                                    <TableCell className="text-right font-semibold">{entry.quantity.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveItem(entry.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
                 <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setEntries([])} disabled={loading || entries.length === 0}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Clear All Entries
                </Button>
                <Button className="flex-1 md:flex-none" onClick={handleSaveAll} disabled={loading || entries.length === 0}>
                    <Save className="mr-2 h-4 w-4" /> Save Batch to Database
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
