
'use client';

import {useState, useEffect, useMemo, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useToast} from '@/hooks/use-toast';
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Eraser,
  Save,
  SlidersHorizontal,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

export default function DashboardPage() {
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

  const [columnVisibility, setColumnVisibility] = useState({
    operator: true,
    sku: true,
    trolleyNo: true,
    remark: true,
  });

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

      if (shift.name === 'Day Shift') {
        startHour = 9;
        endHour = 19;
      } else if (shift.name === 'Night Shift') {
        startHour = 21;
        endHour = 7;
      } else {
        return [];
      }

      if (endHour < startHour) {
        let currentHour = startHour;
        while (currentHour !== (endHour + 1) % 24) {
          const ampm = currentHour >= 12 ? 'PM' : 'AM';
          let displayHour = currentHour % 12;
          if (displayHour === 0) displayHour = 12;
          times.push(`${displayHour}:00 ${ampm}`);
          currentHour = (currentHour + 1) % 24;
        }
      } else {
        for (let i = startHour; i <= endHour; i++) {
          const hour = i;
          const ampm = hour >= 12 ? 'PM' : 'AM';
          let displayHour = hour % 12;
          if (displayHour === 0) displayHour = 12;
          times.push(`${displayHour}:00 ${ampm}`);
        }
      }
      return times;
    },
    []
  );

  useEffect(() => {
    if (!selectedShift) return;

    const newRoundTimes = generateRoundTimes(selectedShift);
    setRoundTimes(newRoundTimes);
    if (!newRoundTimes.includes(selectedRound) || !selectedRound) {
      setSelectedRound(newRoundTimes[0] || '');
    }

    const fetchLog = async () => {
      const log = await actions.getProductionLogForShift(
        selectedDate,
        selectedShift
      );
      setProductionLog(log);
    };
    fetchLog();
  }, [selectedDate, selectedShift, generateRoundTimes, selectedRound]);

  useEffect(() => {
    if (
      !allProductionPlan.length ||
      !allMachines.length ||
      !selectedRound
    ) {
      setEntries([]);
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
        const currentSkuString = loggedEntry?.sku || planItem.skus[0]?.sku;
        const skuPlan =
          planItem.skus.find(s => s.sku === currentSkuString) ||
          planItem.skus[0];

        return {
          machineId: machine.id,
          name: machine.name,
          status: 'Online' as const,
          sku: skuPlan?.sku || '',
          sapCode: skuPlan?.sapCode || '',
          quantity: loggedEntry?.quantity || 0,
          operatorId: loggedEntry?.operatorId || '',
          remark: loggedEntry?.remark || '',
          trolleyNo: loggedEntry?.trolleyNo || '',
        };
      })
      .filter((entry): entry is MachineProductionData => entry !== null);

    setEntries(newEntries);
  }, [selectedRound, productionLog, allMachines, allProductionPlan]);

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
    },
    [allProductionPlan]
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

    // Refresh log for the saved round
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

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    toast({
      title: 'Shift Data Cleared',
      description: `All production entries for ${
        selectedShift.name
      } on ${format(selectedDate, 'PPP')} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast]);

  const handleShiftChange = useCallback(
    (name: string) => {
      setSelectedShift(allShifts.find(s => s.name === name));
    },
    [allShifts]
  );

  const roundTotal = useMemo(() => {
    return entries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    return Object.values(productionLog)
      .flatMap(logEntry => logEntry.entries)
      .reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [productionLog]);

  if (loading) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">
            Green Tyre Production Entry
          </h1>
          <p className="text-muted-foreground">
            Select date, shift, and round to enter production quantities.
          </p>
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
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <header className="flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">
          Green Tyre Production Entry
        </h1>
        <p className="text-muted-foreground">
          Select date, shift, and round to enter production quantities.
        </p>
      </header>

      <Card className="flex-shrink-0 sticky top-0 z-10">
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-4">
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
                  onSelect={date => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

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

            <Select value={selectedRound} onValueChange={setSelectedRound}>
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
                      <RoundStatusIndicator status={productionLog[time]?.status} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  className="capitalize"
                  checked={columnVisibility.operator}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, operator: !!value}))
                  }
                >
                  Operator Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  className="capitalize"
                  checked={columnVisibility.sku}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, sku: !!value}))
                  }
                >
                  SKU (Size)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  className="capitalize"
                  checked={columnVisibility.trolleyNo}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, trolleyNo: !!value}))
                  }
                >
                  Trolley No
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  className="capitalize"
                  checked={columnVisibility.remark}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, remark: !!value}))
                  }
                >
                  Remark
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-6 text-center justify-around w-full sm:w-auto">
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

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear Shift Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
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
              <Button
                onClick={handleSaveRound}
                size="lg"
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Round
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 overflow-y-auto space-y-4">
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
              <CardHeader>
                <CardTitle>{entry.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Left Column: Quantity */}
                <div className="space-y-2">
                  <Label
                    htmlFor={`quantity-${entry.machineId}`}
                    className="text-lg"
                  >
                    Quantity Produced
                  </Label>
                  <Input
                    id={`quantity-${entry.machineId}`}
                    type="number"
                    placeholder="0"
                    className="text-2xl h-16 text-right"
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

                {/* Right Column: Details */}
                <div className="space-y-4">
                  {columnVisibility.operator && (
                    <div className="space-y-2">
                      <Label htmlFor={`operator-${entry.machineId}`}>
                        Operator Name
                      </Label>
                      <Select
                        value={entry.operatorId || ''}
                        onValueChange={val =>
                          handleEntryChange(entry.machineId, 'operatorId', val)
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
                    <div className="space-y-2">
                      <Label htmlFor={`sku-${entry.machineId}`}>
                        SKU (Size)
                      </Label>
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
                                : 'No SKUs planned'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {machineSkus.map(skuPlan => (
                            <SelectItem
                              key={skuPlan.sapCode}
                              value={skuPlan.sku}
                            >
                              {skuPlan.sku}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {columnVisibility.trolleyNo && (
                    <div className="space-y-2">
                      <Label htmlFor={`trolley-${entry.machineId}`}>
                        Trolley No
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
                    <div className="space-y-2">
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
