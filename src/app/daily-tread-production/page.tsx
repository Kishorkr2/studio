
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
  const [dailyProductionEntries, setDailyProductionEntries] = useState<
    Record<string, DailyProductionEntry>
  >({});

  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();

  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [shifts, plan, log] = await Promise.all([
        actions.getShifts(),
        actions.getProductionPlan(),
        actions.getDailyTreadProductionLog(),
      ]);
      setAllShifts(shifts);
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
  }, [selectedShift, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allSkusFromPlan = useMemo((): SkuPlan[] => {
    const sapCodeMap = new Map<string, SkuPlan>();
    productionPlan.forEach(item => {
      item.skus.forEach(skuPlan => {
        if (!skuPlan.sapCode) return;
        const key = skuPlan.sapCode;
        const existing = sapCodeMap.get(key);
        if (existing) {
          sapCodeMap.set(key, {
            ...existing,
            quantity: existing.quantity + skuPlan.quantity,
          });
        } else {
          sapCodeMap.set(key, {...skuPlan});
        }
      });
    });
    return Array.from(sapCodeMap.values());
  }, [productionPlan]);

  useEffect(() => {
    if (!selectedDate || !selectedShift) return;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const shiftName = selectedShift.name.replace(/\s+/g, '-');
    setDailyProductionEntries(dailyProductionLog[dateKey]?.[shiftName] || {});
  }, [selectedDate, selectedShift, dailyProductionLog]);

  const handleDailyProductionChange = (
    sapCode: string,
    field: 'quantity' | 'trolleyNo',
    value: string
  ) => {
    setDailyProductionEntries(currentEntries => {
      const entry = currentEntries[sapCode] || {quantity: 0, trolleyNo: ''};
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

    const updatedLogForDate = {
      ...(dailyProductionLog[dateKey] || {}),
      [shiftName]: dailyProductionEntries,
    };

    const newLog = {...dailyProductionLog, [dateKey]: updatedLogForDate};

    await actions.saveDailyProductionLog(newLog);
    setDailyProductionLog(newLog);
    toast({
      title: 'Success!',
      description: `Tread production for ${
        selectedShift.name
      } on ${format(selectedDate, 'PPP')} has been saved.`,
      action: <Save className="text-green-500" />,
    });
  };

  const filteredSkus = useMemo(() => {
    return allSkusFromPlan.filter(
      req =>
        (req.sapCode?.toLowerCase() || '').includes(
          sapCodeFilter.toLowerCase()
        ) && (req.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [allSkusFromPlan, sapCodeFilter, skuFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Daily Tread Production
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Log Tread Production</CardTitle>
          <CardDescription>
            Enter the quantity of tread produced and the trolley number for each
            SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Popover>
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
                    onSelect={date => date && setSelectedDate(date)}
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
              <Save className="mr-2 h-4 w-4" /> Save Daily Production
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
                  <TableHead>Trolley No</TableHead>
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
                      colSpan={3}
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
