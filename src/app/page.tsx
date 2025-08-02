
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
  Filter,
  Save,
  Share2,
  Sigma,
  MessageSquare,
  Mail,
  Clipboard,
  PlusCircle,
  Trash2,
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {useAuth} from '@/components/auth-provider';

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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...props}>
    <path
      d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.962a.427.427 0 0 0-.073-.215c-.33-1.01-.99-2.512-.99-3.264 0-.426-.24-.426-.51-.426h-1.62a.63.63 0 0 0-.315.1c-.843.43-1.518 1.39-1.518 2.162 0 1.582 1.518 4.816 3.544 6.988 2.026 2.17 4.57 2.648 5.746 2.648.72 0 2.4-1.25 2.4-2.648s-.99-1.69-.99-1.69z"
      fill="#fff"
    ></path>
    <path
      d="M20.213 4.933a10.27 10.27 0 0 0-16.488 11.103L2.645 22.47l6.57-4.085a10.27 10.27 0 0 0 11.002-13.45z"
      fill="#4caf50"
    ></path>
    <path
      d="M19.11,17.205 c-0.372,0 -1.088,1.39 -1.518,1.39 a0.63,0.63 0,0 1,-0.315,-0.1 c-0.802,-0.402 -1.504,-0.817 -2.163,-1.447 c-0.545,-0.516 -1.146,-1.29 -1.46,-1.963 a0.426,0.426 0,0 1,-0.073,-0.215 c0,-0.33 0.99,-0.945 0.99,-1.962 a0.427,0.427 0,0 0,-0.073,-0.215 c-0.33,-1.01 -0.99,-2.512 -0.99,-3.264 c0,-0.426 -0.24,-0.426 -0.51,-0.426 h-1.62 a0.63,0.63 0,0 0,-0.315,0.1 c-0.843,0.43 -1.518,1.39 -1.518,2.162 c0,1.582 1.518,4.816 3.544,6.988 c2.026,2.17 4.57,2.648 5.746,2.648 c0.72,0 2.4,-1.25 2.4,-2.648 s-0.99,-1.69 -0.99,-1.69 z"
      fill="#fff"
    ></path>
  </svg>
);

export default function DashboardPage({setPageActions}: AppLayoutProps) {
  const {toast} = useToast();
  const {user} = useAuth();

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
  const machineOperatorMapRef = useRef<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] = useState(() =>
    getLocalStorageItem('columnVisibility', {
      operator: true,
      sku: true,
    })
  );

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
      setAllMachines(machinesData);
      setAllOperators(operatorsData);
      setAllProductionPlan(planData);

      const currentShift = getCurrentShift(shiftsData);
      setSelectedShift(currentShift);

      if (currentShift) {
        const newRoundTimes = generateRoundTimes(currentShift);
        setRoundTimes(newRoundTimes);
        const savedRound = getLocalStorageItem('selectedRound', '');
        const currentRound = newRoundTimes.includes(savedRound)
          ? savedRound
          : newRoundTimes[0] || '';
        setSelectedRound(currentRound);
      }
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

      try {
        [startHour] = shift.startTime.split(':').map(Number);
      } catch {
        return [];
      }

      const isNightShift = startHour >= 21 || startHour < 7;

      if (isNightShift) {
        for (let h = 21; h <= 23; h++) times.push(`${h}:00`);
        for (let h = 0; h < 8; h++) times.push(`0${h}:00`);
      } else {
        for (let h = 9; h <= 19; h++) times.push(`${h}:00`);
      }

      return times.map(t => {
        const [h] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        let displayHour = h % 12;
        if (displayHour === 0) displayHour = 12;
        return `${displayHour}:00 ${ampm}`;
      });
    },
    []
  );

  const loadEntriesForRound = useCallback(
    (round: string, log: ProductionLog) => {
      const logForRound = log[round]?.entries || [];
      const newEntries = allMachines
        .filter(machine => machine.isAvailable)
        .map(machine => {
          const loggedEntry = logForRound.find(e => e.machineId === machine.id);
          const skus = loggedEntry ? loggedEntry.skus : [];
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
    [allMachines]
  );

  useEffect(() => {
    if (loading || !selectedShift) return;
    const fetchLog = async () => {
      const log = await actions.getProductionLogForShift(
        selectedDate,
        selectedShift
      );
      setProductionLog(log);
    };
    fetchLog();
  }, [selectedDate, selectedShift, loading]);

  useEffect(() => {
    if (loading) return;
    machineOperatorMapRef.current = getLocalStorageItem('machineOperatorMap', {});
    loadEntriesForRound(selectedRound, productionLog);
  }, [productionLog, selectedRound, loadEntriesForRound, loading]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    loadEntriesForRound(selectedRound, {});
    machineOperatorMapRef.current = {};
    setLocalStorageItem('machineOperatorMap', {});
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

  const handleSelectedRoundChange = (round: string) => {
    setSelectedRound(round);
    setLocalStorageItem('selectedRound', round);
    loadEntriesForRound(round, productionLog);
  };

  const handleOperatorChange = (machineId: string, operatorId: string) => {
    setEntries(prev =>
      prev.map(entry =>
        entry.machineId === machineId ? {...entry, operatorId} : entry
      )
    );
    machineOperatorMapRef.current[machineId] = operatorId;
    setLocalStorageItem('machineOperatorMap', machineOperatorMapRef.current);
  };

  const handleSkuChange = (
    machineId: string,
    skuIndex: number,
    newSku: string
  ) => {
    const planItem = allProductionPlan.find(p => p.machineId === machineId);
    const newSkuPlan = planItem?.skus.find(s => s.sku === newSku);

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
    quantity: number
  ) => {
    setEntries(prev =>
      prev.map(entry => {
        if (entry.machineId === machineId) {
          const updatedSkus = [...entry.skus];
          updatedSkus[skuIndex] = {
            ...updatedSkus[skuIndex],
            quantity: isNaN(quantity) ? 0 : quantity,
          };
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
            skus: [...entry.skus, {sku: '', sapCode: '', quantity: 0}],
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
    (name: string) => {
      const newShift = allShifts.find(s => s.name === name);
      if (newShift?.name !== selectedShift?.name) {
        setSelectedShift(newShift);
        if (newShift) {
          const newRoundTimes = generateRoundTimes(newShift);
          setRoundTimes(newRoundTimes);
          setSelectedRound(newRoundTimes[0] || '');
        }
      }
    },
    [allShifts, selectedShift, generateRoundTimes]
  );

  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

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

  const generateShareText = useCallback(() => {
    if (!selectedShift || !selectedRound) return '';

    const operatorMap = new Map(allOperators.map(op => [op.cardNo, op.name]));

    let text = `*Hourly Production Report*\n\n`;
    text += `*Date:* ${format(selectedDate, 'PPP')}\n`;
    text += `*Shift:* ${selectedShift.name}\n`;
    text += `*Time:* ${selectedRound}\n\n`;
    text += `*Round Production:* ${roundTotal}\n`;
    text += `*Shift Cumulative:* ${cumulativeTotal}\n\n`;

    const producedEntries = entries.filter(entry =>
      entry.skus.some(sku => sku.quantity > 0)
    );

    if (producedEntries.length > 0) {
      text += `*TBM wise production:*\n`;
      producedEntries.forEach(entry => {
        const operatorName = operatorMap.get(entry.operatorId || '') || 'N/A';
        const skuTexts = entry.skus
          .filter(s => s.quantity > 0)
          .map(s => `${s.sku}: ${s.quantity}`)
          .join(', ');

        if (skuTexts) {
          text += `- *${entry.name}* (${operatorName}): ${skuTexts}\n`;
        }
      });
    } else {
      text += `*No production was recorded for this round.*\n`;
    }
    return text;
  }, [
    allOperators,
    cumulativeTotal,
    entries,
    roundTotal,
    selectedDate,
    selectedRound,
    selectedShift,
  ]);

  const handleShare = useCallback(
    async (type: 'native' | 'whatsapp' | 'sms' | 'email' | 'copy') => {
      const shareText = generateShareText();
      if (!shareText) {
        toast({
          variant: 'destructive',
          title: 'Cannot Share',
          description: 'Please select a date, shift, and round.',
        });
        return;
      }

      const encodedText = encodeURIComponent(shareText);

      if (type === 'native' && navigator.share) {
        try {
          await navigator.share({
            title: 'Hourly Production Report',
            text: shareText,
          });
        } catch (error) {
          console.log('Share was cancelled or failed', error);
        }
      } else if (type === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      } else if (type === 'sms') {
        window.open(`sms:?body=${encodedText}`, '_blank');
      } else if (type === 'email') {
        window.open(
          `mailto:?subject=Hourly Production Report&body=${encodedText}`,
          '_blank'
        );
      } else {
        // Fallback to copy
        try {
          await navigator.clipboard.writeText(shareText);
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
    },
    [generateShareText, toast]
  );

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

  const ControlsContent = () => (
    <div className="space-y-4 p-4">
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
    </div>
  );

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

  const ShareMenu = ({isMobile = false}) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isMobile ? 'ghost' : 'outline'}
          className={isMobile ? 'flex flex-col h-auto p-2' : ''}
        >
          <Share2 className="h-5 w-5" />
          {isMobile ? (
            <span className="text-xs">Share</span>
          ) : (
            <span className="hidden lg:inline ml-2">Share</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Share Report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleShare('native')}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>General Share</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare('whatsapp')}>
          <WhatsAppIcon className="mr-2 h-4 w-4" />
          <span>WhatsApp</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare('sms')}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>SMS / Message</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare('email')}>
          <Mail className="mr-2 h-4 w-4" />
          <span>Email</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleShare('copy')}>
          <Clipboard className="mr-2 h-4 w-4" />
          <span>Copy to Clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="flex-shrink-0 p-4 flex items-center justify-between gap-4 border-b">
        <div className="flex-1">
          <h1 className="text-lg font-bold tracking-tight">GT Prod Entry</h1>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="w-32">
            <Select
              value={selectedRound}
              onValueChange={handleSelectedRoundChange}
            >
              <SelectTrigger className="font-semibold text-sm">
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
        <div className="flex-1 flex justify-end items-center gap-2">
          <div className="hidden lg:flex items-center gap-2">
            <Button
              onClick={handleSaveRound}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Round
            </Button>
            <ShareMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Left Slicer Panel (Desktop only) */}
        <div className="hidden lg:block w-full lg:w-1/4 lg:flex-shrink-0 space-y-4 p-4 overflow-y-auto border-r">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <ControlsContent />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <SummaryContent />
            </CardContent>
          </Card>
        </div>

        {/* Right Content Panel */}
        <div className="w-full lg:w-3/4 p-4 space-y-4 overflow-y-auto pb-20 lg:pb-4">
          {entries.length === 0 && !loading && (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <p>No machines available for data entry.</p>
                <p className="text-sm">
                  Please check machine availability in the Admin panel.
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
                <CardContent className="p-4 space-y-4">
                  {/* Machine Name and Operator */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <Label className="font-bold text-base sm:w-1/6">
                      {entry.name}
                    </Label>
                    <div className="flex-1 sm:w-5/6">
                      {columnVisibility.operator && (
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
                      )}
                    </div>
                  </div>

                  {/* SKU Entry Rows */}
                  {columnVisibility.sku && (
                    <div className="space-y-3 pl-4 border-l-2">
                      {entry.skus.map((skuEntry, skuIndex) => (
                        <div
                          key={skuIndex}
                          className="flex flex-col sm:flex-row sm:items-center sm:gap-4"
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
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
                                disabled={machineSkus.length === 0}
                              >
                                <SelectTrigger
                                  id={`sku-${entry.machineId}-${skuIndex}`}
                                >
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

                            <div className="space-y-1">
                              <Label
                                htmlFor={`quantity-${entry.machineId}-${skuIndex}`}
                              >
                                Quantity
                              </Label>
                              <Input
                                id={`quantity-${entry.machineId}-${skuIndex}`}
                                type="number"
                                placeholder="0"
                                value={
                                  skuEntry.quantity === 0
                                    ? ''
                                    : skuEntry.quantity
                                }
                                onChange={e =>
                                  handleQuantityChange(
                                    entry.machineId,
                                    skuIndex,
                                    parseInt(e.target.value)
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
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="flex flex-col h-auto p-2">
              <Filter className="h-5 w-5" />
              <span className="text-xs">Filters</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <ControlsContent />
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="flex flex-col h-auto p-2">
              <Sigma className="h-5 w-5" />
              <span className="text-xs">Summary</span>
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
          className="flex flex-col h-auto p-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Save className="h-5 w-5" />
          <span className="text-xs">Save</span>
        </Button>

        <ShareMenu isMobile={true} />
      </div>
    </div>
  );
}
