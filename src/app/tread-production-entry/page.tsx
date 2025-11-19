'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { useToast } from '../../../hooks/use-toast';
import type {
  ProductionPlanItem,
  ShiftInfo,
  SkuPlan,
  DailyProductionEntry,
  Machine,
} from '../../../lib/types';
import { format } from 'date-fns';
import { Skeleton } from '../../../components/ui/skeleton';
import * as actions from '../actions';
import { SummaryCard, Controls, QuantityInput } from './components';
import { Box, Package, PackageCheck } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Card, CardContent } from '../../../components/ui/card';

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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [shifts, plan, log, machines] = await Promise.all([
          actions.getShifts(),
          actions.getProductionPlan(),
          actions.getDailyTreadProductionLog(),
          actions.getMachines('TBM'),
        ]);
        setAllShifts(shifts);
        setAllMachines(machines);
        if (shifts.length > 0 && !selectedShift) {
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
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSkusFromPlan = useMemo((): EnrichedSkuPlan[] => {
    const sapCodeMap = new Map<string, EnrichedSkuPlan>();
    const machineMap = new Map(allMachines.map((m: Machine) => [m.id, m.name]));

    productionPlan.forEach((item) => {
      const tbmName = machineMap.get(item.machineId) || item.machineId;
      item.skus.forEach((skuPlan: SkuPlan) => {
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
          const entry = dailyProductionLog[date][shift][sapCode];
          const bobbinCount = entry.bobbinNo ? entry.bobbinNo.split(',').filter(Boolean).length : 0;
          const bobbinQty = bobbinCount * 110;
          totals[sapCode] = (totals[sapCode] || 0) + (entry.quantity || 0) + bobbinQty;
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

  
  const handleSaveDailyProduction = useCallback(async (isAutoSave = false) => {
    if (!selectedDate || !selectedShift) {
      toast({
        variant: 'destructive',
        title: 'Please wait',
        description: 'Select a date and shift before saving.',
      });
      return;
    }
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const shiftName = selectedShift.name.replace(/\s+/g, '-');

    const entriesToSave = Object.fromEntries(
      Object.entries(dailyProductionEntries).filter(
        ([, value]) => value.quantity > 0 || value.trolleyNo || value.bobbinNo
      )
    );
    
    try {
        const result = await actions.saveDailyProductionLog(
          dateKey,
          shiftName,
          entriesToSave
        );

        if (result && result.success) {
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
          throw new Error(result?.error || 'Failed to save production data.');
        }
    } catch(error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message,
        });
    }
  },[selectedDate, selectedShift, dailyProductionEntries, toast]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoSaveEnabled && hasUnsavedChanges) {
      timer = setTimeout(() => {
        handleSaveDailyProduction(true);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [dailyProductionEntries, autoSaveEnabled, hasUnsavedChanges, handleSaveDailyProduction]);

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
    if (date) {
      setSelectedDate(date);
    }
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
          <span className="text-sm text-orange-600 font-medium animate-pulse">
            ⚠️ Unsaved changes
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Bobbins"
          value={totalBobbin}
          icon={<Box className="h-5 w-5 text-blue-500" />}
          color="blue"
        />
        <SummaryCard
          title="Tread Quantity"
          value={totalQty.toLocaleString()}
          icon={<Package className="h-5 w-5 text-green-500" />}
          color="green"
        />
        <SummaryCard
          title="Total Production"
          value={totalProduction.toLocaleString()}
          icon={<PackageCheck className="h-5 w-5 text-purple-500" />}
          color="purple"
        />
      </div>

      <Controls
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
        allShifts={allShifts}
        isEditing={isEditing}
        handleCopyFromPreviousDay={handleCopyFromPreviousDay}
        handleClearAll={handleClearAll}
        autoSaveEnabled={autoSaveEnabled}
        setAutoSaveEnabled={setAutoSaveEnabled}
        handleEditToggle={handleEditToggle}
        handleSave={() => handleSaveDailyProduction(false)}
        hasUnsavedChanges={hasUnsavedChanges}
        sapCodeFilter={sapCodeFilter}
        setSapCodeFilter={setSapCodeFilter}
        skuFilter={skuFilter}
        setSkuFilter={setSkuFilter}
      />

      <div className="border rounded-lg max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[150px]">SKU</TableHead>
              <TableHead className="w-[120px]">Trolley No</TableHead>
              <TableHead className="w-[200px]">Bobbin No(s)</TableHead>
              <TableHead className="w-[120px] text-right">
                Production Quantity (pcs)
              </TableHead>
              <TableHead className="w-[140px] text-right">
                Current Total
              </TableHead>
              <TableHead className="w-[140px] text-right">
                Overall Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSkus.length > 0 ? (
              filteredSkus.map((req) => (
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
                      value={
                        dailyProductionEntries[req.sapCode]?.trolleyNo || ''
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleDailyProductionChange(
                          req.sapCode,
                          'trolleyNo',
                          e.target.value
                        )
                      }
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, req.sapCode, 'trolleyNo')
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-full"
                      placeholder="B-1, B-2, B-3"
                      disabled={!isEditing}
                      value={
                        dailyProductionEntries[req.sapCode]?.bobbinNo || ''
                      }
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleDailyProductionChange(
                          req.sapCode,
                          'bobbinNo',
                          e.target.value
                        )
                      }
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, req.sapCode, 'bobbinNo')
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <QuantityInput
                      disabled={!isEditing}
                      value={
                        dailyProductionEntries[req.sapCode]?.quantity || 0
                      }
                      onChange={(value) =>
                        handleDailyProductionChange(
                          req.sapCode,
                          'quantity',
                          String(value)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold text-blue-700">
                    {(
                      (dailyProductionEntries[req.sapCode]?.quantity || 0) +
                      ((dailyProductionEntries[req.sapCode]?.bobbinNo || '')
                        .split(',')
                        .filter(Boolean).length *
                        110)
                    ).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    {(
                      totalProductionPerSku[req.sapCode] || 0
                    ).toLocaleString()}
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
                    <p className="text-sm">
                      Please create a production plan in the Admin panel.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
