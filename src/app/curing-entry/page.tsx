
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Calendar as CalendarIcon, Plus, X, List, Factory, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { SkuPlan, Machine, ProductionLog, ShiftInfo } from '@/lib/types';
import * as actions from '@/app/actions';
import { Loader } from '@/components/ui/loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth-provider';

interface NewEntry {
  id: number;
  pressId: string;
  cavity: 'L' | 'R' | '';
  sku: string;
  sapCode: string;
  quantity: number | '';
}

const getCurrentShift = (shifts: ShiftInfo[]): ShiftInfo | undefined => {
  if (!shifts.length) return undefined;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  for (const shift of shifts) {
    const [startHour, startMinute] = shift.startTime.split(':').map(Number);
    const [endHour, endMinute] = shift.endTime.split(':').map(Number);

    let startTimeInMinutes = startHour * 60 + startMinute;
    let endTimeInMinutes = endHour * 60 + endMinute;

    if (endTimeInMinutes < startTimeInMinutes) {
      if (currentTime >= startTimeInMinutes || currentTime < endTimeInMinutes) {
        return shift;
      }
    } else {
      if (currentTime >= startTimeInMinutes && currentTime < endTimeInMinutes) {
        return shift;
      }
    }
  }
  return shifts[0];
};

export default function CuringEntryPage() {
  const [allSkus, setAllSkus] = useState<SkuPlan[]>([]);
  const [allPresses, setAllPresses] = useState<Machine[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  
  const [productionLog, setProductionLog] = useState<ProductionLog>({});

  const [entries, setEntries] = useState<NewEntry[]>([
    { id: Date.now(), pressId: '', cavity: '', sku: '', sapCode: '', quantity: '' }
  ]);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadInitialData = useCallback(async () => {
    try {
      const [plan, machines, shiftsData] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('CuringPress'),
        actions.getShifts(),
      ]);
      const skus = Array.isArray(plan) ? plan.flatMap((p: any) => p.skus || []) : [];
      const uniqueSkus = Array.from(new Map(skus.map((s: any) => [s.sku ?? s.sapCode ?? JSON.stringify(s), s])).values());
      setAllSkus(uniqueSkus);
      setAllPresses(machines.filter(m => m.isAvailable));
      setAllShifts(shiftsData);
      
      const currentShift = getCurrentShift(shiftsData);
      if (currentShift) {
        setSelectedShift(currentShift);
      }
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast({ variant: 'destructive', title: 'Failed to load initial data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchProductionLog = useCallback(async (date: Date, shift: ShiftInfo) => {
    try {
      const log = await actions.getProductionLogForShift(date, shift);
      const curingLog: ProductionLog = {};
      for (const round in log) {
        curingLog[round] = {
          ...log[round],
          entries: log[round].entries.filter(e => e.machineId.startsWith('CP-')),
        };
      }
      setProductionLog(curingLog);
    } catch (error) {
      console.error('Failed to fetch production log:', error);
      toast({ variant: 'destructive', title: 'Error fetching shift data.' });
    }
  }, [toast]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    if (selectedDate && selectedShift) {
      fetchProductionLog(selectedDate, selectedShift);
    }
  }, [selectedDate, selectedShift, fetchProductionLog]);

  const handleEntryChange = (id: number, field: keyof NewEntry, value: string | number) => {
      setEntries(prev => prev.map(entry => {
          if (entry.id === id) {
              const updatedEntry = { ...entry, [field]: value };
              if (field === 'sku') {
                  const selectedSku = allSkus.find(s => s.sku === value);
                  updatedEntry.sapCode = selectedSku?.sapCode || '';
              }
              return updatedEntry;
          }
          return entry;
      }))
  };

  const handleAddEntry = () => {
      setEntries(prev => [...prev, { id: Date.now(), pressId: '', cavity: '', sku: '', sapCode: '', quantity: '' }]);
  };

  const handleRemoveEntry = (id: number) => {
      setEntries(prev => prev.filter(entry => entry.id !== id));
  };


  const handleSaveAll = async () => {
    const validEntries = entries.filter(e => e.pressId && e.cavity && e.sku && e.quantity && Number(e.quantity) > 0);
    if (validEntries.length === 0) { toast({ variant: 'destructive', title: 'No entries to save' }); return; }
    if (!selectedDate || !selectedShift) { toast({ variant: 'destructive', title: 'Date or Shift not selected' }); return; }

    setIsSaving(true);
    
    const entriesByPress = validEntries.reduce((acc, entry) => {
      const pressName = allPresses.find(p => p.id === entry.pressId)?.name || entry.pressId;
      if (!acc[entry.pressId]) {
        acc[entry.pressId] = { machineId: entry.pressId, name: pressName, skus: [], operatorId: user?.id?.toString(), userId: user?.id, userName: user?.name };
      }
      const quantity = Number(entry.quantity);
      acc[entry.pressId].skus.push({ sku: entry.sku, sapCode: entry.sapCode, quantity: quantity, leftQty: entry.cavity === 'L' ? quantity : 0, rightQty: entry.cavity === 'R' ? quantity : 0 });
      return acc;
    }, {} as Record<string, { machineId: string, name: string; skus: {sku: string, sapCode: string, quantity: number, leftQty: number, rightQty: number}[], operatorId?: string, userId?: number, userName?: string }>);
    
    try {
      const round = 'Curing';
      await actions.saveProductionRound(selectedDate, selectedShift, round, Object.values(entriesByPress));
      
      toast({ title: `✅ Saved ${validEntries.length} entries successfully` });
      setEntries([{ id: Date.now(), pressId: '', cavity: '', sku: '', sapCode: '', quantity: '' }]);
      await fetchProductionLog(selectedDate, selectedShift);
    } catch (error) {
      console.error('Save failed', error);
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDateChange = (date: Date | undefined) => {
      if (date) {
        setSelectedDate(date);
      }
      setIsDatePickerOpen(false);
  }

  const handleShiftChange = (shiftName: string) => {
    const newShift = allShifts.find(s => s.name === shiftName);
    setSelectedShift(newShift);
  };

  const shiftTotalProduction = useMemo(() => {
    return Object.values(productionLog)
      .flatMap(log => log.entries)
      .flatMap(entry => entry.skus)
      .reduce((sum, sku) => sum + (sku.quantity || 0), 0);
  }, [productionLog]);

  const savedEntries = useMemo(() => {
      return Object.values(productionLog)
        .flatMap(log => log.entries)
        .flatMap(entry => entry.skus.map(sku => ({
            machineName: entry.name,
            sku: sku.sku,
            sapCode: sku.sapCode,
            quantity: sku.quantity,
            cavity: sku.leftQty && sku.leftQty > 0 ? 'L' : (sku.rightQty && sku.rightQty > 0 ? 'R' : 'N/A')
        })));
  }, [productionLog])

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
                        className={cn('w-full sm:w-[240px] justify-start text-left font-normal')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                 <Select value={selectedShift?.name} onValueChange={handleShiftChange}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Shift" /></SelectTrigger>
                    <SelectContent>
                        {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.startTime}-{s.endTime})</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Card>
                    <CardContent className="p-2 flex flex-col items-center justify-center">
                        <p className="text-xs font-medium text-muted-foreground">Shift Total</p>
                        <p className="text-lg font-bold">{shiftTotalProduction.toLocaleString()}</p>
                    </CardContent>
                </Card>
            </div>
        </header>

        <Card>
            <CardHeader>
                <CardTitle>Add Production Entries</CardTitle>
                <CardDescription>Click "Add Entry" to add new rows. Fill the details for each production run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {entries.map((entry, index) => (
                    <div key={entry.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center p-4 border rounded-lg bg-background">
                        <div className="space-y-2">
                           {index === 0 && <Label>Press No.</Label>}
                           <Select value={entry.pressId} onValueChange={(v) => handleEntryChange(entry.id, 'pressId', v)}>
                                <SelectTrigger><SelectValue placeholder="Select Press"/></SelectTrigger>
                                <SelectContent>
                                    {allPresses.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            {index === 0 && <Label>Cavity</Label>}
                            <Select value={entry.cavity} onValueChange={(v) => handleEntryChange(entry.id, 'cavity', v)}>
                                <SelectTrigger><SelectValue placeholder="Cavity"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="L">Left</SelectItem>
                                    <SelectItem value="R">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             {index === 0 && <Label>SKU</Label>}
                             <Select value={entry.sku} onValueChange={(v) => handleEntryChange(entry.id, 'sku', v)}>
                                <SelectTrigger><SelectValue placeholder="Select SKU"/></SelectTrigger>
                                <SelectContent>
                                    {allSkus.map(s => <SelectItem key={s.sapCode} value={s.sku}>{s.sku} ({s.sapCode})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             {index === 0 && <Label>Quantity</Label>}
                             <Input type="number" placeholder="0" value={entry.quantity} onChange={e => handleEntryChange(entry.id, 'quantity', Number(e.target.value))} />
                        </div>
                        <div className="flex items-end h-full">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveEntry(entry.id)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                
                <div className="flex justify-between items-center mt-4">
                     <Button onClick={handleAddEntry} variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Add Entry
                    </Button>
                    <Button onClick={handleSaveAll} disabled={isSaving || entries.length === 0}>
                        <Save className="mr-2 h-4 w-4" /> Save All Entries
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Saved Production for {selectedShift?.name} on {selectedDate && format(selectedDate, 'PPP')}</CardTitle>
                <CardDescription>These entries have been saved to the database.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-x-auto max-h-96">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Press No.</TableHead>
                                <TableHead>Cavity</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>SAP Code</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {savedEntries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No saved entries for this shift and date.
                                    </TableCell>
                                </TableRow>
                            )}
                            {savedEntries.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{entry.machineName}</TableCell>
                                    <TableCell>
                                        <Badge variant={entry.cavity === 'L' ? 'outline' : 'secondary'}>
                                            {entry.cavity === 'L' ? 'Left' : 'Right'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{entry.sku}</TableCell>
                                    <TableCell>{entry.sapCode}</TableCell>
                                    <TableCell className="text-right font-semibold">{entry.quantity.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    