
'use client';

import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AppLayoutProps } from '@/components/app-layout';
import {format} from 'date-fns';
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Eraser,
  Package,
  PlusCircle,
  Save,
  Sigma,
  Trash2,
} from 'lucide-react';

import * as actions from '../actions';
import {useAuth} from '@/components/auth-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {useToast} from '@/hooks/use-toast';
import {cn} from '@/lib/utils';
import type {
  Machine,
  MachineProductionData,
  Operator,
  ProductionLog,
  ShiftInfo,
  TreadStock,
  SkuPlan
} from '@/lib/types';
import { Loader } from '@/components/ui/loader';

const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    // If parsing fails, it's likely old/invalid data, so we should clear it
    window.localStorage.removeItem(key);
    return defaultValue;
  }
};

const setLocalStorageItem = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

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

export default function CuringPage({setPageActions}: AppLayoutProps) {
  const {toast} = useToast();
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [allCuringPresses, setAllCuringPresses] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  
  const [allSkusFromPlan, setAllSkusFromPlan] = useState<SkuPlan[]>([]);
  const [greenTyreStock, setGreenTyreStock] = useState<TreadStock[]>([]);

  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);
  
  const machineOperatorMapRef = useRef<Record<string, string>>({});
  const [isFetchingLog, setIsFetchingLog] = useState(false);


  const generateRoundTimes = useCallback((shift: ShiftInfo): string[] => {
    if (!shift) return [];
    const times: string[] = [];
    const shiftName = shift.name.toLowerCase();

    if (shiftName.includes('night')) {
      for (let h = 21; h <= 23; h++) times.push(`${String(h).padStart(2, '0')}:00`);
      for (let h = 0; h <= 6; h++) times.push(`${String(h).padStart(2, '0')}:00`);
      times.push('07:00');
    } else {
      for (let h = 9; h <= 18; h++) times.push(`${String(h).padStart(2, '0')}:00`);
      times.push('19:00');
    }

    return times.map(t => {
      const [h] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      let displayHour = h % 12;
      if (displayHour === 0) displayHour = 12;
      return `${String(displayHour).padStart(2, '0')}:00 ${ampm}`;
    });
  }, []);

  const loadEntriesForRound = useCallback(
    (round: string, log: ProductionLog) => {
      const logForRound = log[round]?.entries || [];
      const newEntries = allCuringPresses
        .filter(machine => machine.isAvailable)
        .map(machine => {
          const loggedEntry = logForRound.find(e => e.machineId === machine.id);
          const skus = loggedEntry?.skus?.filter(s => s.sku || s.sapCode) || [];
          const operatorId =
            loggedEntry?.operatorId || machineOperatorMapRef.current[machine.id];
          return {
            machineId: machine.id,
            name: machine.name,
            operatorId: operatorId || '',
            skus: skus.length > 0 ? skus : [],
          };
        });
      setEntries(newEntries);
    },
    [allCuringPresses]
  );
  
  const fetchAndSetLog = useCallback(async (date: Date, shift: ShiftInfo) => {
    setIsFetchingLog(true);
    try {
      const log = await actions.getProductionLogForShift(date, shift);
      setProductionLog(log);
      return log;
    } catch (error) {
      console.error('Failed to fetch production log:', error);
      toast({ variant: 'destructive', title: 'Error fetching shift data.' });
      return {};
    } finally {
      setIsFetchingLog(false);
    }
  }, [toast]);
  
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        shiftsData,
        machinesData,
        operatorsData,
        planData,
        openingStock,
        dailyLogs,
        historyLogs,
      ] = await Promise.all([
        actions.getShifts(),
        actions.getMachines('CuringPress'),
        actions.getOperators(),
        actions.getProductionPlan(),
        actions.getTreadOpeningStock(),
        actions.getDailyTreadProductionLog(),
        actions.getProductionLogs(),
      ]);

      setAllShifts(shiftsData);
      setAllCuringPresses(machinesData);
      setAllOperators(operatorsData);

      const skuMap = new Map<string, SkuPlan>();
      planData.forEach(item => {
        item.skus.forEach(skuPlan => {
          if (!skuPlan.sapCode) return;
          const key = skuPlan.sapCode;
          const existing = skuMap.get(key);
          if (existing) {
            skuMap.set(key, {
              ...existing,
              quantity: (existing.quantity || 0) + (skuPlan.quantity || 0),
            });
          } else {
            skuMap.set(key, {...skuPlan});
          }
        });
      });
      const skus = Array.from(skuMap.values());
      setAllSkusFromPlan(skus);

      const dailyTotals: Record<string, number> = {};
      for (const dateKey in dailyLogs) {
        for (const shiftName in dailyLogs[dateKey]) {
          for (const sapCode in dailyLogs[dateKey][shiftName]) {
            dailyTotals[sapCode] =
              (dailyTotals[sapCode] || 0) +
              (dailyLogs[dateKey][shiftName][sapCode].quantity || 0);
          }
        }
      }

      const tyreProd: Record<string, number> = {};
      (historyLogs as any[])
        .filter(log => log.machineName && log.machineName.startsWith('CP'))
        .forEach(entry => {
          if (entry.sapCode && entry.quantity > 0) {
            tyreProd[entry.sapCode] =
              (tyreProd[entry.sapCode] || 0) + (entry.quantity || 0);
          }
        });

      const stock = skus.map(req => {
        const openingStockInfo = openingStock.find(
          t => t.sapCode === req.sapCode
        ) || {openingStock: 0};
        const totalProduction = dailyTotals[req.sapCode] || 0;
        const tyreProduction = tyreProd[req.sapCode] || 0;
        const currentTreadStock =
          (openingStockInfo.openingStock || 0) + totalProduction - tyreProduction;
        return {
          ...req,
          openingStock: openingStockInfo.openingStock,
          production: totalProduction,
          currentTreadStock,
        };
      });
      setGreenTyreStock(stock);

      const currentShift = getCurrentShift(shiftsData);
      setSelectedShift(currentShift);

      if (currentShift) {
        const newRoundTimes = generateRoundTimes(currentShift);
        setRoundTimes(newRoundTimes);
        
        const log = await fetchAndSetLog(selectedDate, currentShift);

        const savedRound = getLocalStorageItem('curingSelectedRound', '');
        const currentRound = newRoundTimes.includes(savedRound) ? savedRound : newRoundTimes[0] || '';
        setSelectedRound(currentRound);

        machineOperatorMapRef.current = getLocalStorageItem('curingMachineOperatorMap', {});
        loadEntriesForRound(currentRound, log);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({variant: 'destructive', title: 'Error loading data'});
    } finally {
      setLoading(false);
    }
  }, [toast, generateRoundTimes, fetchAndSetLog, loadEntriesForRound, selectedDate]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAvailableOperators(allOperators.filter(op => !op.isAbsent));
  }, [allOperators]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    loadEntriesForRound(selectedRound, {});
    machineOperatorMapRef.current = {};
    setLocalStorageItem('curingMachineOperatorMap', {});
    toast({
      title: 'Shift Data Cleared',
      description: `All production entries for ${
        selectedShift.name
      } on ${format(selectedDate, 'PPP')} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast, selectedRound, loadEntriesForRound]);

  useEffect(() => {
    if (setPageActions) {
      const pageActions = (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Page Actions</DropdownMenuLabel>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={e => e.preventDefault()}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Eraser className="mr-2 h-4 w-4" />
                Clear Shift Data
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all production data for the
                  selected shift ({selectedShift?.name} on{' '}
                  {selectedDate ? format(selectedDate, 'PPP') : ''}). This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearShiftData}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
      setPageActions(pageActions);
    }
    return () => {
      if (setPageActions) {
        setPageActions(null);
      }
    };
  }, [handleClearShiftData, selectedDate, selectedShift, setPageActions]);

  const handleSelectedRoundChange = (round: string) => {
    setSelectedRound(round);
    setLocalStorageItem('curingSelectedRound', round);
    loadEntriesForRound(round, productionLog);
  };

  const handleOperatorChange = (machineId: string, operatorId: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.machineId === machineId ? {...entry, operatorId} : entry
      )
    );
    machineOperatorMapRef.current[machineId] = operatorId;
    setLocalStorageItem('curingMachineOperatorMap', machineOperatorMapRef.current);
  };

  const handleSkuChange = (
    machineId: string,
    skuIndex: number,
    newSku: string
  ) => {
    const newSkuPlan = allSkusFromPlan.find(s => s.sku === newSku);
    setEntries(prev =>
      prev.map(entry => {
        if (entry.machineId === machineId) {
          const updatedSkus = [...entry.skus];
          updatedSkus[skuIndex] = {
            ...updatedSkus[skuIndex],
            sku: newSku,
            sapCode: newSkuPlan?.sapCode || '',
          };
          return {...entry, skus: updatedSkus};
        }
        return entry;
      })
    );
  };

  const handleQuantityChange = (
    machineId: string,
    skuIndex: number,
    side: 'left' | 'right',
    quantity: number
  ) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.machineId === machineId) {
          const updatedSkus = [...entry.skus];
          const currentSku = updatedSkus[skuIndex];
          const newQty = isNaN(quantity) ? 0 : quantity;
          
          if(side === 'left') {
            currentSku.leftQty = newQty;
          } else {
            currentSku.rightQty = newQty;
          }
          currentSku.quantity = (currentSku.leftQty || 0) + (currentSku.rightQty || 0)

          return {...entry, skus: updatedSkus};
        }
        return entry;
      })
    );
  };

  const handleAddSku = (machineId: string) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.machineId === machineId) {
          return {
            ...entry,
            skus: [...entry.skus, {sku: '', sapCode: '', quantity: 0, leftQty: 0, rightQty: 0}],
          };
        }
        return entry;
      })
    );
  };

  const handleRemoveSku = (machineId: string, skuIndex: number) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.machineId === machineId) {
          const updatedSkus = entry.skus.filter(
            (_, index) => index !== skuIndex
          );
          return {...entry, skus: updatedSkus};
        }
        return entry;
      })
    );
  };

  const handleSaveRound = useCallback(async () => {
    if (!selectedRound || !selectedShift) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save',
        description: 'Please select a shift and round time first.',
      });
      return;
    }
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save',
        description: 'User information not available. Please log in again.',
      });
      return;
    }
    const entriesToSave = entries.map(entry => ({
      ...entry,
      userId: user.id,
      userName: user.name,
    }));
    await actions.saveProductionRound(
      selectedDate,
      selectedShift,
      selectedRound,
      entriesToSave
    );
    const log = await actions.getProductionLogForShift(
      selectedDate,
      selectedShift
    );
    setProductionLog(log);
    toast({
      title: 'Round Data Saved',
      description: `Data for round ${selectedRound} has been saved.`,
      action: <Save className="text-green-500" />,
    });
  }, [selectedDate, selectedShift, selectedRound, entries, toast, user]);

  const handleShiftChange = useCallback(
    async (name: string) => {
      const newShift = allShifts.find(s => s.name === name);
      if (newShift && newShift?.name !== selectedShift?.name) {
        setProductionLog({});
        setEntries([]);
        setSelectedShift(newShift);
        
        setIsFetchingLog(true);
        const newRoundTimes = generateRoundTimes(newShift);
        setRoundTimes(newRoundTimes);
        
        const log = await fetchAndSetLog(selectedDate, newShift);
        const currentRound = newRoundTimes[0] || '';
        setSelectedRound(currentRound);
        loadEntriesForRound(currentRound, log);
        setIsFetchingLog(false);
      }
    },
    [allShifts, selectedShift, generateRoundTimes, fetchAndSetLog, selectedDate, loadEntriesForRound]
  );

  const handleDateChange = useCallback(async (date: Date | undefined) => {
    if (date && selectedShift && format(date, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) {
      setProductionLog({});
      setEntries([]);
      setSelectedDate(date);
      
      setIsFetchingLog(true);
      const log = await fetchAndSetLog(date, selectedShift);
      loadEntriesForRound(selectedRound, log);
      setIsFetchingLog(false);
    }
  }, [selectedDate, selectedShift, fetchAndSetLog, loadEntriesForRound, selectedRound]);

  const roundTotal = useMemo(() => {
    return entries.reduce(
      (acc, entry) =>
        acc +
        entry.skus.reduce((skuAcc, sku) => skuAcc + (sku.quantity || 0), 0),
      0
    );
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    const total = Object.values(productionLog)
      .flatMap(logEntry => logEntry.entries)
      .flatMap(machineEntry => machineEntry.skus)
      .reduce((acc, sku) => acc + (sku.quantity || 0), 0);
    return total;
  }, [productionLog]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  const RoundStatusIndicator = ({status}: {status?: 'synced' | 'pending'}) => {
    if (status === 'synced') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const SummaryContent = () => (
    <div className="space-y-4 p-4 text-center">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Round Total
        </p>
        <p className="text-2xl font-bold text-primary">
          {roundTotal.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Shift Total (Saved)
        </p>
        <p className="text-2xl font-bold text-accent">
          {cumulativeTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="flex-shrink-0 p-2 md:p-4 border-b">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
           <h1 className="text-lg font-bold tracking-tight">Curing Prod Entry</h1>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  size="sm"
                  className={cn(
                    'w-[150px] justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, 'PP')
                  ) : (
                    <span>Pick a date</span>
                  )}
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
          
            <Select
              value={selectedShift?.name || ''}
              onValueChange={handleShiftChange}
            >
              <SelectTrigger className="w-[150px]" size="sm">
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

            <Select
              value={selectedRound}
              onValueChange={handleSelectedRoundChange}
            >
              <SelectTrigger className="w-[150px] font-semibold text-sm" size="sm">
                <div className="flex items-center gap-2">
                  <RoundStatusIndicator
                    status={productionLog[selectedRound]?.status}
                  />
                  <SelectValue placeholder="Select time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {roundTimes.map(time => (
                  <SelectItem key={time} value={time}>
                    <div className="flex items-center justify-between w-full">
                      <span>{time}</span>
                      <RoundStatusIndicator
                        status={productionLog[time]?.status}
                      />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <span>Green Tyre Stock</span>
            </CardTitle>
            <CardDescription>
              Real-time availability of green tyres for curing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">
                      Available Stock
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {greenTyreStock.map(item => (
                    <TableRow key={item.sapCode}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell className="text-right font-bold">
                        {item.currentTreadStock.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {isFetchingLog && (
           <Card>
             <CardContent className="p-10 text-center text-muted-foreground">
               <Loader />
               <p className="mt-2">Loading shift data...</p>
             </CardContent>
           </Card>
        )}
        {!isFetchingLog && entries.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <p>No curing presses available for data entry.</p>
              <p className="text-sm">
                Please check machine availability in the Admin panel.
              </p>
            </CardContent>
          </Card>
        )}
        {!isFetchingLog && entries.map(entry => {
          return (
            <Card key={entry.machineId}>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                  <Label className="font-bold text-base sm:w-1/6">
                    {entry.name}
                  </Label>
                  <div className="flex-1 sm:w-5/6">
                      <Select
                        value={entry.operatorId || ''}
                        onValueChange={val =>
                          handleOperatorChange(entry.machineId, val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOperators.map(op => (
                            <SelectItem key={op.cardNo} value={op.cardNo}>
                              {op.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                </div>
                  <div className="space-y-3 pl-4 border-l-2">
                    {entry.skus.map((skuEntry, skuIndex) => (
                      <div
                        key={skuIndex}
                        className="flex flex-col sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1 sm:col-span-1">
                            <Label
                              htmlFor={`sku-${entry.machineId}-${skuIndex}`}
                            >
                              SKU
                            </Label>
                            <Select
                              value={skuEntry.sku}
                              onValueChange={val =>
                                handleSkuChange(entry.machineId, skuIndex, val)
                              }
                              disabled={allSkusFromPlan.length === 0}
                            >
                              <SelectTrigger
                                id={`sku-${entry.machineId}-${skuIndex}`}
                              >
                                <SelectValue
                                  placeholder={
                                    allSkusFromPlan.length > 0
                                      ? 'Select SKU'
                                      : 'No SKUs'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {allSkusFromPlan.map(skuPlan => (
                                  <SelectItem
                                    key={`${skuPlan.sku}-${skuPlan.sapCode}`}
                                    value={skuPlan.sku}
                                  >
                                    {skuPlan.sku}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor={`left-qty-${entry.machineId}-${skuIndex}`}
                            >
                              Left Qty
                            </Label>
                            <Input
                              id={`left-qty-${entry.machineId}-${skuIndex}`}
                              type="number"
                              placeholder="0"
                              value={
                                skuEntry.leftQty === 0
                                  ? ''
                                  : skuEntry.leftQty
                              }
                              onChange={e =>
                                handleQuantityChange(
                                  entry.machineId,
                                  skuIndex,
                                  'left',
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                           <div className="space-y-1">
                            <Label
                              htmlFor={`right-qty-${entry.machineId}-${skuIndex}`}
                            >
                              Right Qty
                            </Label>
                            <Input
                              id={`right-qty-${entry.machineId}-${skuIndex}`}
                              type="number"
                              placeholder="0"
                              value={
                                skuEntry.rightQty === 0
                                  ? ''
                                  : skuEntry.rightQty
                              }
                              onChange={e =>
                                handleQuantityChange(
                                  entry.machineId,
                                  skuIndex,
                                  'right',
                                  parseInt(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="flex-shrink-0 mt-2 sm:mt-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              handleRemoveSku(entry.machineId, skuIndex)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddSku(entry.machineId)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Add SKU
                    </Button>
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </main>
      <footer className="sticky bottom-0 z-10 flex h-20 items-center justify-between gap-4 border-t bg-background px-4">
        <div className="hidden lg:block">
          <Card>
             <CardContent className="p-0">
                <div className="flex items-center gap-6 p-2">
                   <div>
                     <p className="text-xs font-medium text-muted-foreground">
                       Round Total
                     </p>
                     <p className="text-lg font-bold text-primary">
                       {roundTotal.toLocaleString()}
                     </p>
                   </div>
                    <div className="border-l h-10"></div>
                   <div>
                     <p className="text-xs font-medium text-muted-foreground">
                       Shift Total (Saved)
                     </p>
                     <p className="text-lg font-bold text-accent">
                       {cumulativeTotal.toLocaleString()}
                     </p>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-2">
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <Sigma className="h-4 w-4" />
                <span className="ml-2">Summary</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Summary</SheetTitle>
              </SheetHeader>
              <SummaryContent />
            </SheetContent>
          </Sheet>
          <Button
            onClick={handleSaveRound}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Round
          </Button>
        </div>
      </footer>
    </div>
  );
}
