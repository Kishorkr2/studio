
'use client';

import {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useToast} from '@/hooks/use-toast';
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Eraser,
  Save,
  Share2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Calendar} from '@/components/ui/calendar';
import {Label} from '@/components/ui/label';
import {format} from 'date-fns';
import type {
  Machine,
  MachineProductionData,
  ShiftInfo,
  Operator,
  ProductionLog,
  ProductionPlanItem,
} from '@/lib/types';
import {cn} from '@/lib/utils';
import {Skeleton} from '@/components/ui/skeleton';
import * as actions from './actions';
import type {AppLayoutProps} from '@/components/app-layout';

const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
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

export default function DashboardPage({setPageActions}: AppLayoutProps) {
  const {toast} = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<
    ProductionPlanItem[]
  >([]);

  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');

  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});

  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

  const [machineOperatorMap, setMachineOperatorMap] = useState<
    Record<string, string>
  >({});
  const [machineSkuMap, setMachineSkuMap] = useState<Record<string, string>>(
    {}
  );

  const [columnVisibility, setColumnVisibility] = useState(() =>
    getLocalStorageItem('columnVisibility', {
      operator: true,
      sku: true,
      trolleyNo: true,
      remark: true,
    })
  );

  const isInitializing = useRef(true);
  const dataLoadedFor = useRef('');

  useEffect(() => {
    setLocalStorageItem('columnVisibility', columnVisibility);
  }, [columnVisibility]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsData, machinesData, operatorsData, planData] =
        await Promise.all([
          actions.getShifts(),
          actions.getMachines(),
          actions.getOperators(),
          actions.getProductionPlan(),
        ]);
      setAllShifts(shiftsData);
      if (shiftsData.length > 0) {
        setSelectedShift(getCurrentShift(shiftsData));
      }
      setAllMachines(machinesData);
      setAllOperators(operatorsData);
      setAllProductionPlan(planData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast({variant: 'destructive', title: 'Error loading data'});
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setAvailableOperators(allOperators.filter(op => !op.isAbsent));
  }, [allOperators]);

  const generateRoundTimes = useCallback(
    (shift: ShiftInfo | undefined): string[] => {
      if (!shift) return [];
      const times: string[] = [];
      let startHour: number;
      let endHour: number;

      try {
        const [startH] = shift.startTime.split(':').map(Number);
        const [endH] = shift.endTime.split(':').map(Number);
        startHour = startH;
        endHour = endH;
      } catch {
        // Fallback for invalid time format
        return [];
      }

      if (isNaN(startHour) || isNaN(endHour)) return [];

      let currentHour = startHour;
      let loopDetector = 24; // Prevent infinite loops

      while (loopDetector > 0) {
        const ampm = currentHour >= 12 ? 'PM' : 'AM';
        let displayHour = currentHour % 12;
        if (displayHour === 0) displayHour = 12; // 12 AM or 12 PM
        times.push(`${displayHour}:00 ${ampm}`);

        // Break if we have reached the end hour
        if (currentHour === endHour) break;

        currentHour = (currentHour + 1) % 24;
        loopDetector--;
      }

      return times;
    },
    []
  );

  useEffect(() => {
    if (!selectedShift) return;

    const newRoundTimes = generateRoundTimes(selectedShift);
    setRoundTimes(newRoundTimes);

    const savedRound = getLocalStorageItem('selectedRound', '');
    if (newRoundTimes.length > 0) {
      if (!newRoundTimes.includes(savedRound)) {
        const newSelectedRound = newRoundTimes[0];
        setSelectedRound(newSelectedRound);
        setLocalStorageItem('selectedRound', newSelectedRound);
      } else {
        setSelectedRound(savedRound);
      }
    } else {
      setSelectedRound('');
    }
  }, [selectedShift, generateRoundTimes]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    setMachineOperatorMap({});
    setMachineSkuMap({});
    setLocalStorageItem('machineOperatorMap', {});
    setLocalStorageItem('machineSkuMap', {});
    toast({
      title: 'Shift Data Cleared',
      description: `All production entries for ${
        selectedShift.name
      } on ${format(selectedDate, 'PPP')} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast]);

  useEffect(() => {
    if (setPageActions) {
      const pageActions = (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Page Actions</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={columnVisibility.operator}
            onCheckedChange={value =>
              setColumnVisibility(prev => ({...prev, operator: !!value}))
            }
          >
            Toggle Operator
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={columnVisibility.sku}
            onCheckedChange={value =>
              setColumnVisibility(prev => ({...prev, sku: !!value}))
            }
          >
            Toggle SKU
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={columnVisibility.trolleyNo}
            onCheckedChange={value =>
              setColumnVisibility(prev => ({...prev, trolleyNo: !!value}))
            }
          >
            Toggle Trolley No
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={columnVisibility.remark}
            onCheckedChange={value =>
              setColumnVisibility(prev => ({...prev, remark: !!value}))
            }
          >
            Toggle Remark
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
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

    // Cleanup function
    return () => {
      if (setPageActions) {
        setPageActions(null);
      }
    };
  }, [
    columnVisibility,
    handleClearShiftData,
    selectedDate,
    selectedShift,
    setPageActions,
  ]);

  // This effect fetches the production log for the selected date and shift
  useEffect(() => {
    if (loading || !selectedShift) return;

    const key = `${format(selectedDate, 'yyyy-MM-dd')}-${selectedShift.name}`;
    if (dataLoadedFor.current === key) return;

    const fetchLogAndInitialize = async () => {
      const log = await actions.getProductionLogForShift(
        selectedDate,
        selectedShift!
      );
      setProductionLog(log);

      if (isInitializing.current) {
        const newOperatorMap: Record<string, string> = getLocalStorageItem(
          'machineOperatorMap',
          {}
        );
        const newSkuMap: Record<string, string> = getLocalStorageItem(
          'machineSkuMap',
          {}
        );
        setMachineOperatorMap(newOperatorMap);
        setMachineSkuMap(newSkuMap);
        isInitializing.current = false;
      }
      dataLoadedFor.current = key;
    };

    fetchLogAndInitialize();
  }, [selectedDate, selectedShift, loading]);

  // This effect builds the `entries` array for the UI
  useEffect(() => {
    const key = `${format(selectedDate, 'yyyy-MM-dd')}-${
      selectedShift?.name
    }-${selectedRound}`;
    if (
      isInitializing.current &&
      dataLoadedFor.current !== key.substring(0, key.lastIndexOf('-'))
    ) {
      return;
    }

    const machineMap = new Map(allMachines.map(m => [m.id, m]));
    const logForRound = productionLog[selectedRound]?.entries || [];
    const logMap = new Map(logForRound.map(e => [e.machineId, e]));

    const newEntries = allProductionPlan
      .map(planItem => {
        const machine = machineMap.get(planItem.machineId);
        if (!machine || !machine.isAvailable) return null;

        const loggedEntry = logMap.get(planItem.machineId);
        const operatorId =
          loggedEntry?.operatorId || machineOperatorMap[machine.id] || '';
        const sku =
          loggedEntry?.sku ||
          machineSkuMap[machine.id] ||
          planItem.skus[0]?.sku ||
          '';

        const skuPlan =
          planItem.skus.find(s => s.sku === sku) || planItem.skus[0];

        return {
          machineId: machine.id,
          name: machine.name,
          status: 'Online' as const,
          sku: sku,
          sapCode: skuPlan?.sapCode || '',
          quantity: loggedEntry?.quantity || 0,
          operatorId,
          remark: loggedEntry?.remark || '',
          trolleyNo: loggedEntry?.trolleyNo || '',
        };
      })
      .filter((entry): entry is MachineProductionData => entry !== null);
    setEntries(newEntries);
  }, [
    selectedRound,
    productionLog,
    allMachines,
    allProductionPlan,
    machineOperatorMap,
    machineSkuMap,
    selectedDate,
    selectedShift,
  ]);

  const handleSelectedRoundChange = (round: string) => {
    setSelectedRound(round);
    setLocalStorageItem('selectedRound', round);
  };

  const handleEntryChange = useCallback(
    (
      machineId: string,
      field: keyof MachineProductionData,
      value: string | number
    ) => {
      setEntries(prevEntries =>
        prevEntries.map(entry => {
          if (entry.machineId === machineId) {
            const newEntry = {...entry, [field]: value};
            if (field === 'sku') {
              const planItem = allProductionPlan.find(
                p => p.machineId === machineId
              );
              const newSkuPlan = planItem?.skus.find(s => s.sku === value);
              newEntry.sapCode = newSkuPlan?.sapCode || '';
            }
            return newEntry;
          }
          return entry;
        })
      );
      if (field === 'operatorId') {
        const newMap = {...machineOperatorMap, [machineId]: String(value)};
        setMachineOperatorMap(newMap);
        setLocalStorageItem('machineOperatorMap', newMap);
      }
      if (field === 'sku') {
        const newMap = {...machineSkuMap, [machineId]: String(value)};
        setMachineSkuMap(newMap);
        setLocalStorageItem('machineSkuMap', newMap);
      }
    },
    [allProductionPlan, machineOperatorMap, machineSkuMap]
  );

  const handleSaveRound = useCallback(async () => {
    if (!selectedRound || !selectedShift) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save',
        description: 'Please select a shift and round time first.',
      });
      return;
    }

    await actions.saveProductionRound(
      selectedDate,
      selectedShift,
      selectedRound,
      entries
    );

    setProductionLog(prev => ({
      ...prev,
      [selectedRound]: {entries: entries, status: 'synced'},
    }));

    toast({
      title: 'Round Data Saved',
      description: `Data for round ${selectedRound} has been saved.`,
      action: <Save className="text-green-500" />,
    });
  }, [selectedDate, selectedShift, selectedRound, entries, toast]);

  const handleShiftChange = useCallback(
    (name: string) => {
      const newShift = allShifts.find(s => s.name === name);
      if (newShift?.name !== selectedShift?.name) {
        setSelectedShift(newShift);
        dataLoadedFor.current = '';
        setProductionLog({});
      }
    },
    [allShifts, selectedShift]
  );

  const handleDateChange = useCallback(
    (date: Date | undefined) => {
      if (
        date &&
        format(date, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')
      ) {
        setSelectedDate(date);
        dataLoadedFor.current = '';
        setProductionLog({});
      }
    },
    [selectedDate]
  );

  const roundTotal = useMemo(() => {
    return entries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    const total = Object.values(productionLog)
      .flatMap(logEntry => logEntry.entries)
      .reduce((acc, entry) => acc + (entry.quantity || 0), 0);
    return total;
  }, [productionLog]);

  const handleShare = useCallback(async () => {
    if (!selectedShift || !selectedRound) {
      toast({
        variant: 'destructive',
        title: 'Cannot Share',
        description: 'Please select a date, shift, and round.',
      });
      return;
    }

    const operatorMap = new Map(allOperators.map(op => [op.cardNo, op.name]));

    let shareText = `*Hourly Production Report*\n\n`;
    shareText += `*Date:* ${format(selectedDate, 'PPP')}\n`;
    shareText += `*Shift:* ${selectedShift.name}\n`;
    shareText += `*Time:* ${selectedRound}\n\n`;
    shareText += `*Round Production:* ${roundTotal}\n`;
    shareText += `*Shift Cumulative:* ${cumulativeTotal}\n\n`;

    const producedEntries = entries.filter(entry => entry.quantity > 0);

    if (producedEntries.length > 0) {
      shareText += `*TBM wise production:*\n`;
      producedEntries.forEach(entry => {
        const operatorName = operatorMap.get(entry.operatorId || '') || 'N/A';
        shareText += `- *${entry.name}* (${operatorName}): ${entry.quantity}\n`;
      });
    } else {
      shareText += `*No production was recorded for this round.*\n`;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Hourly Production Report',
          text: shareText,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: 'Report Copied!',
          description:
            'The production report has been copied to your clipboard.',
        });
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (error) {
      console.error('Share/Copy failed:', error);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast({
          title: 'Report Copied!',
          description:
            'The production report has been copied to your clipboard.',
        });
      } catch (copyError) {
        console.error('Fallback copy failed:', copyError);
        toast({
          variant: 'destructive',
          title: 'Share Failed',
          description: 'Could not share or copy the report.',
        });
      }
    }
  }, [
    entries,
    selectedDate,
    selectedShift,
    selectedRound,
    toast,
    cumulativeTotal,
    allOperators,
    roundTotal,
  ]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">GT Prod Entry</h1>
        </header>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const RoundStatusIndicator = ({status}: {status?: 'synced' | 'pending'}) => {
    if (status === 'synced') {
      return <CheckCircle className="h-4 w-4 text-green-500" title="Synced" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" title="Not Synced" />;
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex-shrink-0 p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b">
        <div className="w-1/4"></div>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">GT Prod Entry</h1>
        </div>
        <div className="w-1/4 flex justify-end">
          <div className="flex items-center gap-2">
            <div className="w-32">
              <Select
                value={selectedRound}
                onValueChange={handleSelectedRoundChange}
              >
                <SelectTrigger className="font-semibold">
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
            <Button
              onClick={handleSaveRound}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Round
            </Button>
            <Button onClick={handleShare} variant="outline">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Slicer Panel */}
        <div className="w-full lg:w-1/4 lg:flex-shrink-0 space-y-4 p-4 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
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
                      onSelect={handleDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Shift</Label>
                <Select
                  value={selectedShift?.name || ''}
                  onValueChange={handleShiftChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {allShifts.map(s => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
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
            </CardContent>
          </Card>
        </div>

        {/* Right Content Panel */}
        <div className="w-full lg:w-3/4 p-4 space-y-4 overflow-y-auto">
          {entries.length === 0 && !loading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <p>No machines scheduled for production in the current plan.</p>
                <p className="text-sm">
                  Please upload a production plan in the Admin panel.
                </p>
              </CardContent>
            </Card>
          )}
          {entries.map(entry => {
            const planItem = allProductionPlan.find(
              p => p.machineId === entry.machineId
            );
            const machineSkus = planItem?.skus || [];
            return (
              <Card key={entry.machineId}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                    <div className="md:w-1/6 mb-4 md:mb-0">
                      <Label className="font-bold text-lg">{entry.name}</Label>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {columnVisibility.operator && (
                        <div className="space-y-1">
                          <Label htmlFor={`operator-${entry.machineId}`}>
                            Operator
                          </Label>
                          <Select
                            value={entry.operatorId || ''}
                            onValueChange={val =>
                              handleEntryChange(
                                entry.machineId,
                                'operatorId',
                                val
                              )
                            }
                          >
                            <SelectTrigger id={`operator-${entry.machineId}`}>
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
                      )}

                      {columnVisibility.sku && (
                        <div className="space-y-1">
                          <Label htmlFor={`sku-${entry.machineId}`}>SKU</Label>
                          <Select
                            value={entry.sku}
                            onValueChange={val =>
                              handleEntryChange(entry.machineId, 'sku', val)
                            }
                            disabled={machineSkus.length === 0}
                          >
                            <SelectTrigger id={`sku-${entry.machineId}`}>
                              <SelectValue
                                placeholder={
                                  machineSkus.length > 0
                                    ? 'Select SKU'
                                    : 'No SKUs'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {machineSkus.map(skuPlan => (
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
                      )}

                      <div className="space-y-1">
                        <Label htmlFor={`quantity-${entry.machineId}`}>
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${entry.machineId}`}
                          type="number"
                          placeholder="0"
                          value={entry.quantity === 0 ? '' : entry.quantity}
                          onChange={e =>
                            handleEntryChange(
                              entry.machineId,
                              'quantity',
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                        />
                      </div>

                      {columnVisibility.trolleyNo && (
                        <div className="space-y-1">
                          <Label htmlFor={`trolley-${entry.machineId}`}>
                            Trolley
                          </Label>
                          <Input
                            id={`trolley-${entry.machineId}`}
                            placeholder="e.g., T-123"
                            value={entry.trolleyNo || ''}
                            onChange={e =>
                              handleEntryChange(
                                entry.machineId,
                                'trolleyNo',
                                e.target.value
                              )
                            }
                          />
                        </div>
                      )}

                      {columnVisibility.remark && (
                        <div className="space-y-1">
                          <Label htmlFor={`remark-${entry.machineId}`}>
                            Remark
                          </Label>
                          <Input
                            id={`remark-${entry.machineId}`}
                            placeholder="Add remark..."
                            value={entry.remark || ''}
                            onChange={e =>
                              handleEntryChange(
                                entry.machineId,
                                'remark',
                                e.target.value
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

    