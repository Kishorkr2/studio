'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type {
  ProductionPlanItem,
  ShiftInfo,
  SkuPlan,
  DailyProductionEntry,
  Machine,
} from '@/lib/types';
import { CalendarIcon, Save, Edit, XCircle, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import * as actions from '../actions';

interface EnrichedSkuPlan extends SkuPlan {
  tbmName: string;
}

export default function TreadProductionEntryPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [dailyProductionLog, setDailyProductionLog] = useState<
    Record<string, Record<string, Record<string, DailyProductionEntry>>>
  >({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dailyProductionEntries, setDailyProductionEntries] = useState<
    Record<string, DailyProductionEntry>
  >({});
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [shifts, plan, log, machines] = await Promise.all([
        actions.getShifts(),
        actions.getProductionPlan(),
        actions.getDailyTreadProductionLog(),
        actions.getMachines('TBM'),
      ]);
      setAllShifts(shifts);
      setAllMachines(machines);
      if (shifts.length > 0) {
        setSelectedShift(shifts[0]);
      }
      setProductionPlan(plan);
      setDailyProductionLog(log);
    } catch (error) {
      console.error('Failed to load data', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load data from the server.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allSkusFromPlan = useMemo((): EnrichedSkuPlan[] => {
    const sapCodeMap = new Map<string, EnrichedSkuPlan>();
    const machineMap = new Map(allMachines.map(m => [m.id, m.name]));

    productionPlan.forEach(item => {
      const tbmName = machineMap.get(item.machineId) || item.machineId;
      item.skus.forEach(skuPlan => {
        if (!skuPlan.sapCode) return;
        const key = skuPlan.sapCode;
        const existing = sapCodeMap.get(key);
        if (existing) {
          sapCodeMap.set(key, {
            ...existing,
            quantity: (existing.quantity || 0) + (skuPlan.quantity || 0),
          });
        } else {
          sapCodeMap.set(key, { ...skuPlan, tbmName });
        }
      });
    });
    return Array.from(sapCodeMap.values());
  }, [productionPlan, allMachines]);

  const loadEntriesForDateAndShift = useCallback(() => {
    if (!selectedDate || !selectedShift) return;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const shiftName = selectedShift.name.replace(/\s+/g, '-');
    const entriesForDayAndShift = dailyProductionLog[dateKey]?.[shiftName] || {};

    const newEntries: Record<string, DailyProductionEntry> = {};
    allSkusFromPlan.forEach(sku => {
      const existingEntry = entriesForDayAndShift[sku.sapCode];
      newEntries[sku.sapCode] = {
        quantity: existingEntry?.quantity || 0,
        trolleyNo: existingEntry?.trolleyNo || '',
        bobbinNo: existingEntry?.bobbinNo || '',
      };
    });

    setDailyProductionEntries(newEntries);
    setHasUnsavedChanges(false);
  }, [selectedDate, selectedShift, dailyProductionLog, allSkusFromPlan]);

  useEffect(() => {
    if (!loading) {
      loadEntriesForDateAndShift();
      setIsEditing(false);
    }
  }, [selectedDate, selectedShift, dailyProductionLog, allSkusFromPlan, loadEntriesForDateAndShift, loading]);

  const totalProductionPerSku = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const date in dailyProductionLog) {
      for (const shift in dailyProductionLog[date]) {
        for (const sapCode in dailyProductionLog[date][shift]) {
          totals[sapCode] =
            (totals[sapCode] || 0) +
            (dailyProductionLog[date][shift][sapCode].quantity || 0);
        }
      }
    }
    return totals;
  }, [dailyProductionLog]);

  const handleDailyProductionChange = (
    sapCode: string,
    field: keyof DailyProductionEntry,
    value: string
  ) => {
    setDailyProductionEntries(currentEntries => {
      const entry =
        currentEntries[sapCode] || { quantity: 0, trolleyNo: '', bobbinNo: '' };

      const newEntry: DailyProductionEntry = {
        ...entry,
        [field]:
          field === 'quantity'
            ? parseInt(value, 10) || 0
            : value.toUpperCase(),
      };

      return {
        ...currentEntries,
        [sapCode]: newEntry,
      };
    });
    setHasUnsavedChanges(true);
  };

  // 🚀 NEW: Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges) return;
    
    const timer = setTimeout(() => {
      handleSaveDailyProduction(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [dailyProductionEntries, autoSaveEnabled, hasUnsavedChanges]);

  const handleSaveDailyProduction = async (isAutoSave = false) => {
    if (!selectedDate || !selectedShift) {
      toast({
        variant: 'destructive',
        title: 'Please wait',
        description: 'Select a date and shift before saving.',
      });
      return;
    }
    const dateKey = format(selectedDate, 'yyyy-MM-dd');

    const entriesToSave = Object.fromEntries(
      Object.entries(dailyProductionEntries).filter(
        ([, value]) => value.quantity > 0 || value.trolleyNo || value.bobbinNo
      )
    );

    const result = await actions.saveDailyProductionLog(
      dateKey,
      selectedShift.name.replace(/\s+/g, '-'),
      entriesToSave
    );

    if (result && result.success) {
      const shiftName = selectedShift.name.replace(/\s+/g, '-');
      setDailyProductionLog(prev => ({
        ...prev,
        [dateKey]: {
          ...(prev[dateKey] || {}),
          [shiftName]: entriesToSave,
        },
      }));
      setHasUnsavedChanges(false);
      if (!isAutoSave) {
        setIsEditing(false);
      }
      toast({
        title: isAutoSave ? '💾 Auto-saved' : '✅ Saved Successfully',
        description: `Tread production for ${selectedShift.name} on ${format(
          selectedDate,
          'PPP'
        )} has been saved.`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save production data.',
      });
    }
  };

  // 🚀 NEW: Copy from previous day
  const handleCopyFromPreviousDay = async () => {
    if (!selectedDate || !selectedShift) return;
    
    const yesterday = new Date(selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = format(yesterday, 'yyyy-MM-dd');
    const shiftName = selectedShift.name.replace(/\s+/g, '-');
    
    const previousEntries = dailyProductionLog[dateKey]?.[shiftName];
    
    if (previousEntries) {
      setDailyProductionEntries(previousEntries);
      setHasUnsavedChanges(true);
      toast({
        title: '📋 Copied',
        description: `Data copied from ${format(yesterday, 'PPP')}`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'No Data',
        description: 'No previous day data found to copy.',
      });
    }
  };

  // 🚀 NEW: Clear all entries
  const handleClearAll = () => {
    const emptyEntries: Record<string, DailyProductionEntry> = {};
    allSkusFromPlan.forEach(sku => {
      emptyEntries[sku.sapCode] = {
        quantity: 0,
        trolleyNo: '',
        bobbinNo: '',
      };
    });
    setDailyProductionEntries(emptyEntries);
    setHasUnsavedChanges(true);
    toast({
      title: '🗑️ Cleared',
      description: 'All entries have been cleared.',
    });
  };

  // 🚀 NEW: Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sapCode: string, field: keyof DailyProductionEntry) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = filteredSkus.findIndex(s => s.sapCode === sapCode);
      if (currentIndex < filteredSkus.length - 1) {
        const nextSku = filteredSkus[currentIndex + 1];
        const nextInput = document.querySelector(`input[data-sku="${nextSku.sapCode}"][data-field="${field}"]`) as HTMLInputElement;
        nextInput?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = filteredSkus.findIndex(s => s.sapCode === sapCode);
      if (currentIndex > 0) {
        const prevSku = filteredSkus[currentIndex - 1];
        const prevInput = document.querySelector(`input[data-sku="${prevSku.sapCode}"][data-field="${field}"]`) as HTMLInputElement;
        prevInput?.focus();
      }
    }
  };

  const totalBobbin = useMemo(() => {
    return Object.values(dailyProductionEntries).reduce((sum, e) => {
      const count = e.bobbinNo ? e.bobbinNo.split(',').filter(Boolean).length : 0;
      return sum + count;
    }, 0);
  }, [dailyProductionEntries]);

  const totalQty = useMemo(() => {
    return Object.values(dailyProductionEntries).reduce(
      (sum, e) => sum + (e.quantity || 0),
      0
    );
  }, [dailyProductionEntries]);

  const totalProduction = useMemo(() => {
    return Object.values(dailyProductionEntries).reduce((acc, entry) => {
      const bobbinCount = entry.bobbinNo ? entry.bobbinNo.split(',').filter(Boolean).length : 0;
      const bobbinQty = bobbinCount * 110;
      const manualQty = entry.quantity || 0;
      return acc + bobbinQty + manualQty;
    }, 0);
  }, [dailyProductionEntries]);

  const filteredSkus = useMemo(() => {
    return allSkusFromPlan.filter(
      req =>
        (req.sapCode?.toLowerCase() || '').includes(
          sapCodeFilter.toLowerCase()
        ) && (req.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [allSkusFromPlan, sapCodeFilter, skuFilter]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) setSelectedDate(date);
    setIsDatePickerOpen(false);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      loadEntriesForDateAndShift();
    }
    setIsEditing(!isEditing);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Tread Production Entry
        </h1>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Tread Production Entry
        </h1>
        {hasUnsavedChanges && (
          <span className="text-sm text-orange-600 font-medium">
            ⚠️ Unsaved changes
          </span>
        )}
      </div>

      {/* Total Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-700 text-sm">Total Bobbins</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-blue-900">
            {totalBobbin}
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-700 text-sm">Manual Quantity</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-green-900">
            {totalQty.toLocaleString()}
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-purple-700 text-sm">Total Production</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-purple-900">
            {totalProduction.toLocaleString()}
          </CardContent>
        </Card>
      </div>

      {/* Main Form Card */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Date, Shift & Actions Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-full sm:w-[240px] justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Select
                value={selectedShift?.name}
                onValueChange={name =>
                  setSelectedShift(allShifts.find(s => s.name === name))
                }
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {allShifts.map(s => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFromPreviousDay}
                disabled={!isEditing}
                title="Copy from previous day"
              >
                <Copy className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={!isEditing}
                title="Clear all entries"
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-md">
                <input
                  type="checkbox"
                  id="autoSave"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="autoSave" className="text-sm cursor-pointer">
                  Auto-save
                </label>
              </div>

              <Button
                variant={isEditing ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleEditToggle}
              >
                {isEditing ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" /> Cancel
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleSaveDailyProduction(false)}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
                disabled={!isEditing || !hasUnsavedChanges}
              >
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="🔍 Filter by SAP Code..."
              value={sapCodeFilter}
              onChange={e => setSapCodeFilter(e.target.value)}
              className="max-w-sm"
            />
            <Input
              placeholder="🔍 Filter by SKU..."
              value={skuFilter}
              onChange={e => setSkuFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Production Table */}
          <div className="border rounded-lg max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[150px]">SKU</TableHead>
                  <TableHead className="w-[120px]">Trolley No</TableHead>
                  <TableHead className="w-[200px]">Bobbin No(s)</TableHead>
                  <TableHead className="w-[120px] text-right">Quantity</TableHead>
                  <TableHead className="w-[140px] text-right">Current Total</TableHead>
                  <TableHead className="w-[140px] text-right">Overall Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkus.length > 0 ? (
                  filteredSkus.map((req, index) => (
                    <TableRow
                      key={req.sapCode}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <TableCell className="font-medium">{req.sku}</TableCell>
                      <TableCell>
                        <Input
                          className="w-full"
                          placeholder="T-123"
                          disabled={!isEditing}
                          data-sku={req.sapCode}
                          data-field="trolleyNo"
                          value={
                            dailyProductionEntries[req.sapCode]?.trolleyNo || ''
                          }
                          onChange={e =>
                            handleDailyProductionChange(
                              req.sapCode,
                              'trolleyNo',
                              e.target.value
                            )
                          }
                          onKeyDown={e => handleKeyDown(e, req.sapCode, 'trolleyNo')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-full"
                          placeholder="B-1, B-2, B-3"
                          disabled={!isEditing}
                          data-sku={req.sapCode}
                          data-field="bobbinNo"
                          value={
                            dailyProductionEntries[req.sapCode]?.bobbinNo || ''
                          }
                          onChange={e =>
                            handleDailyProductionChange(
                              req.sapCode,
                              'bobbinNo',
                              e.target.value
                            )
                          }
                          onKeyDown={e => handleKeyDown(e, req.sapCode, 'bobbinNo')}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-full text-right"
                          placeholder="0"
                          disabled={!isEditing}
                          data-sku={req.sapCode}
                          data-field="quantity"
                          value={
                            dailyProductionEntries[req.sapCode]?.quantity || ''
                          }
                          onChange={e =>
                            handleDailyProductionChange(
                              req.sapCode,
                              'quantity',
                              e.target.value
                            )
                          }
                          onKeyDown={e => handleKeyDown(e, req.sapCode, 'quantity')}
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-700">
                        {(
                          (dailyProductionEntries[req.sapCode]?.quantity || 0) +
                          ((dailyProductionEntries[req.sapCode]?.bobbinNo || '').split(',').filter(Boolean).length * 110)
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {(totalProductionPerSku[req.sapCode] || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg">📋 No SKUs available</p>
                        <p className="text-sm">Please create a production plan in the Admin panel.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
