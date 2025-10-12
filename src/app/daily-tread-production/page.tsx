
'use client';

import {useState, useEffect, useMemo, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {useToast} from '@/hooks/use-toast';
import type {
  ProductionPlanItem,
  ShiftInfo,
  SkuPlan,
  DailyProductionEntry,
  Machine,
} from '@/lib/types';
import {CalendarIcon, Save} from 'lucide-react';
import {cn} from '@/lib/utils';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Calendar} from '@/components/ui/calendar';
import {format} from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import * as actions from '../actions';

interface EnrichedSkuPlan extends SkuPlan {
  tbmName: string;
}

export default function DailyTreadProductionPage() {
  const {toast} = useToast();

  const [loading, setLoading] = useState(true);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(
    []
  );
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

  useEffect(() => {
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
            tbmNo: existingEntry?.tbmNo || sku.tbmName,
        };
    });
    
    setDailyProductionEntries(newEntries);
  }, [selectedDate, selectedShift, dailyProductionLog, allSkusFromPlan]);


  const handleDailyProductionChange = (
    sapCode: string,
    field: 'quantity' | 'trolleyNo' | 'tbmNo' | 'bobbinNo',
    value: string
  ) => {
    setDailyProductionEntries(currentEntries => {
      const entry = currentEntries[sapCode] || {quantity: 0, trolleyNo: '', bobbinNo: '', tbmNo: ''};
      const newEntry = {
        ...entry,
        [field]: field === 'quantity' ? parseInt(value, 10) || 0 : value,
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
    const shiftName = selectedShift.name.replace(/\s+/g, '-');
    
    const entriesToSave = Object.fromEntries(
      Object.entries(dailyProductionEntries).filter(([, value]) => value.quantity > 0 || value.trolleyNo || value.bobbinNo)
    );

    const updatedLogForDate = {
      ...(dailyProductionLog[dateKey] || {}),
      [shiftName]: entriesToSave,
    };

    const newLog = {...dailyProductionLog, [dateKey]: updatedLogForDate};

    try {
      const result = await actions.saveDailyProductionLog(newLog);
      setDailyProductionLog(newLog);
      
      if (result && result.success) {
        toast({
          title: 'Success!',
          description: `Tread production for ${
            selectedShift.name
          } on ${format(selectedDate, 'PPP')} has been saved locally and synced to Firebase.`,
          action: <Save className="text-green-500" />,
        });
      } else {
        toast({
          title: 'Saved Locally',
          description: `Data saved locally. ${result?.error || 'Firebase sync may have failed.'}`,
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save production data.',
      });
    }
  };

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

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Daily Tread Production
        </h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        Daily Tread Production
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Log Tread Production</CardTitle>
          <CardDescription>
            Enter the quantity of tread produced, trolley, and bobbin number for each SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    {selectedDate ? (
                      format(selectedDate, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
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
            <Button onClick={handleSaveDailyProduction}>
              <Save className="mr-2 h-4 w-4" /> Save to Local & Firebase
            </Button>
          </div>

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

          <div className="border rounded-lg max-h-[60vh] overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>TBM No</TableHead>
                  <TableHead>Trolley No</TableHead>
                  <TableHead>Bobbin</TableHead>
                  <TableHead className="text-right">
                    Production Quantity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSkus.length > 0 ? (
                  filteredSkus.map(req => (
                    <TableRow key={req.sapCode}>
                      <TableCell className="font-medium">{req.sku}</TableCell>
                       <TableCell>
                        <Select
                          value={dailyProductionEntries[req.sapCode]?.tbmNo || ''}
                          onValueChange={(value) =>
                            handleDailyProductionChange(req.sapCode, 'tbmNo', value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select TBM" />
                          </SelectTrigger>
                          <SelectContent>
                            {allMachines.map((m) => (
                                <SelectItem key={m.id} value={m.name}>
                                    {m.name}
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-32"
                          placeholder="e.g., T-123"
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
                          className="w-32"
                          placeholder="e.g., B-01"
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
                          className="w-32 ml-auto text-right"
                          placeholder="0"
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
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
