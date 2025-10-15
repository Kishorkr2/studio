
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
import { CalendarIcon, Save, Edit, XCircle } from 'lucide-react';
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

  const loadData = useCallback(async () => {
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
  }, [toast, selectedShift]);

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
  }, [selectedDate, selectedShift, dailyProductionLog, allSkusFromPlan]);


  useEffect(() => {
    loadEntriesForDateAndShift();
    setIsEditing(false); // Reset editing state when date/shift changes
  }, [selectedDate, selectedShift, dailyProductionLog, allSkusFromPlan, loadEntriesForDateAndShift]);


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
  };

  const handleSaveDailyProduction = async () => {
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
      setIsEditing(false);
      toast({
        title: '✅ Saved Successfully',
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

  // 🧮 Calculate live totals
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
      // If canceling, reload the original data
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
      <h1 className="text-3xl font-bold tracking-tight text-primary">
        Tread Production Entry
      </h1>

      {/* ✅ Total Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-blue-100 border-blue-300 shadow">
          <CardHeader>
            <CardTitle className="text-blue-700">Total Bobbins</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-900">
            {totalBobbin}
          </CardContent>
        </Card>

        <Card className="bg-green-100 border-green-300 shadow">
          <CardHeader>
            <CardTitle className="text-green-700">Total Quantity (pcs)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-900">
            {totalQty.toLocaleString()}
          </CardContent>
        </Card>

        <Card className="bg-yellow-100 border-yellow-300 shadow">
          <CardHeader>
            <CardTitle className="text-yellow-700">Total Production</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-yellow-900">
            {totalProduction.toLocaleString()}
          </CardContent>
        </Card>
      </div>

      {/* 🔹 Filters & Date/Shift Selector */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
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
            <div className="flex items-center gap-2">
               <Button
                variant={isEditing ? 'destructive' : 'outline'}
                onClick={handleEditToggle}
              >
                {isEditing ? <XCircle className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
              <Button onClick={handleSaveDailyProduction} className="bg-green-600 hover:bg-green-700" disabled={!isEditing}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </div>
          </div>

          {/* 🔍 Filters */}
          <div className="flex flex-col sm:flex-row gap-4 my-4">
            <Input
              placeholder="Filter by SAP Code..."
              value={sapCodeFilter}
              onChange={e => setSapCodeFilter(e.target.value)}
              className="max-w-sm"
            />
            <Input
              placeholder="Filter by SKU..."
              value={skuFilter}
              onChange={e => setSkuFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* 🧾 Table */}
          <div className="border rounded-lg max-h-[60vh] overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Trolley No</TableHead>
                  <TableHead>Bobbin No(s)</TableHead>
                  <TableHead className="text-right">
                    Quantity (pcs)
                  </TableHead>
                  <TableHead className="text-right">Total Production</TableHead>
                  <TableHead className="text-right">
                    Total Tread Production
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkus.length > 0 ? (
                  filteredSkus.map(req => (
                    <TableRow
                      key={req.sapCode}
                      className="hover:bg-gray-50 transition-all"
                    >
                      <TableCell className="font-medium">{req.sku}</TableCell>
                      <TableCell>
                        <Input
                          className="w-28"
                          placeholder="T-123"
                          disabled={!isEditing}
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
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-28"
                          placeholder="e.g., B-1,B-2"
                          disabled={!isEditing}
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
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-24 ml-auto text-right"
                          placeholder="0"
                          disabled={!isEditing}
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
                      className="h-24 text-center text-muted-foreground"
                    >
                      No SKUs available. Please create a production plan in the
                      Admin panel.
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
