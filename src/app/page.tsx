"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, CheckCircle, Clock, Save, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { MachineProductionData, ShiftInfo, Operator, ProductionLog } from '@/lib/types';
import { initialOperators, initialMachines, initialProductionPlan, shifts } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/use-online-status';

export default function DashboardPage() {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo>(shifts[0]);
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  
  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

  const [columnVisibility, setColumnVisibility] = useState({
    operator: true,
    sku: true,
    remark: true,
  });
  
  const getLogKey = useCallback((date: Date, shift: ShiftInfo) => {
    return `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
  }, []);

  // Helper function to initialize entries for a round
  const getInitialEntries = useCallback((): MachineProductionData[] => {
    const availableMachines = initialMachines.filter(m => m.isAvailable);
    return availableMachines.map(machine => {
      const planItem = initialProductionPlan.find(p => p.machineId === machine.id);
      return {
        machineId: machine.id,
        name: machine.name,
        status: 'Online',
        sku: planItem?.skus?.[0] || '',
        quantity: 0,
        operatorId: '',
        remark: '',
      };
    });
  }, []);

  // Initialize operators on mount
  useEffect(() => {
    setAvailableOperators(initialOperators.filter(op => !op.isAbsent));
  }, []);

  // Function to generate round times based on shift
  const generateRoundTimes = (shift: ShiftInfo): string[] => {
    const times: string[] = [];
    const isDayShift = shift.name === 'Day Shift';
    const roundStartHour = isDayShift ? 9 : 21; 

    let currentHour = roundStartHour;
    for(let i=0; i<11; i++){
        const hour = (currentHour + i) % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12;
        times.push(`${displayHour}:00 ${ampm}`);
    }

    if (isDayShift) {
        times.push('7:00 PM');
    } else {
        times.push('7:00 AM');
        times.push('8:00 AM');
        times.push('9:00 AM');
    }

    return times;
  };
  
  // Effect to load data from localStorage on date/shift change
  useEffect(() => {
    if(typeof window === 'undefined') return;

    const logKey = getLogKey(selectedDate, selectedShift);
    try {
      const savedLog = localStorage.getItem(logKey);
      const parsedLog = savedLog ? JSON.parse(savedLog) : {};
      setProductionLog(parsedLog);

      const newRoundTimes = generateRoundTimes(selectedShift);
      setRoundTimes(newRoundTimes);
      const firstRound = newRoundTimes[0] || '';
      setSelectedRound(firstRound);

      const firstRoundLog = parsedLog[firstRound];
      if (firstRoundLog) {
        setEntries(firstRoundLog.entries);
      } else {
        setEntries(getInitialEntries());
      }

    } catch (error) {
      console.error("Failed to parse production log from localStorage", error);
      setProductionLog({});
      setEntries(getInitialEntries());
    }
  }, [selectedDate, selectedShift, getLogKey, getInitialEntries]);
  
  // Effect to persist productionLog to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const logKey = getLogKey(selectedDate, selectedShift);
        localStorage.setItem(logKey, JSON.stringify(productionLog));
    }
  }, [productionLog, selectedDate, selectedShift, getLogKey]);

  // Effect to update entries when round changes
  useEffect(() => {
    if (!selectedRound) return;
    const loggedEntry = productionLog[selectedRound];
    if (loggedEntry) {
      setEntries(loggedEntry.entries);
    } else {
      setEntries(getInitialEntries());
    }
  }, [selectedRound, productionLog, getInitialEntries]);
  
  // Syncing effect
  useEffect(() => {
    if (isOnline) {
      const syncData = async () => {
        let changesMade = false;
        const updatedLog = { ...productionLog };

        for (const round of Object.keys(updatedLog)) {
          if (updatedLog[round].status === 'pending') {
            console.log(`Syncing round: ${round}`);
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            updatedLog[round].status = 'synced';
            changesMade = true;
            
            toast({
              title: 'Data Synced!',
              description: `Round ${round} data has been synced.`,
              action: <CheckCircle className="text-green-500" />,
            });
          }
        }

        if (changesMade) {
          setProductionLog(updatedLog);
        }
      };

      const timeoutId = setTimeout(syncData, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, productionLog, toast]);

  const handleEntryChange = (machineId: string, field: 'operatorId' | 'quantity' | 'remark' | 'sku', value: string) => {
    setEntries(prevEntries =>
      prevEntries.map(entry =>
        entry.machineId === machineId
          ? {
              ...entry,
              [field]: field === 'quantity' ? parseInt(value, 10) || 0 : value,
            }
          : entry
      )
    );
  };
  
  const handleSaveRound = () => {
    setProductionLog(prevLog => ({
      ...prevLog,
      [selectedRound]: {
          entries: entries,
          status: 'pending'
      },
    }));

    toast({
      title: 'Round Data Saved Locally',
      description: `Data for round ${selectedRound} will sync when online.`,
      action: <Save className="text-blue-500" />,
    });
  };

  const roundTotal = useMemo(() => {
    return entries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    return Object.values(productionLog)
      .flatMap(logEntry => logEntry.entries)
      .reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [productionLog]);

  const footerColSpan = 1 + (columnVisibility.operator ? 1 : 0) + (columnVisibility.sku ? 1 : 0);

  return (
    <div className="flex flex-col h-full gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Production Data Entry</h1>
        <p className="text-muted-foreground">Select date, shift, and round to enter production quantities.</p>
      </header>

      <Card>
        <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Select value={selectedShift.name} onValueChange={(name) => setSelectedShift(shifts.find(s => s.name === name) || shifts[0])}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}
                    </SelectContent>
                  </Select>

                   <Select value={selectedRound} onValueChange={setSelectedRound}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {roundTimes.map(time => {
                        const logEntry = productionLog[time];
                        return (
                          <SelectItem key={time} value={time}>
                            <div className="flex items-center justify-between w-full">
                                <span>{time}</span>
                                {logEntry?.status === 'pending' && (
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 ml-2" title="Pending Sync"></div>
                                )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto">
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
                        onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, operator: !!value}))}
                      >
                        Operator Name
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        className="capitalize"
                        checked={columnVisibility.sku}
                        onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, sku: !!value}))}
                      >
                        SKU (Size)
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        className="capitalize"
                        checked={columnVisibility.remark}
                        onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, remark: !!value}))}
                      >
                        Remark
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full lg:w-auto">
                  <div className="flex gap-6 text-center justify-around w-full sm:w-auto">
                      <div>
                          <p className="text-sm font-medium text-muted-foreground">Round Total</p>
                          <p className="text-2xl font-bold text-primary">{roundTotal.toLocaleString()}</p>
                      </div>
                      <div>
                          <p className="text-sm font-medium text-muted-foreground">Shift Total (Saved)</p>
                          <p className="text-2xl font-bold text-accent">{cumulativeTotal.toLocaleString()}</p>
                      </div>
                  </div>

                  <Button onClick={handleSaveRound} size="lg" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                      <Save className="mr-2 h-4 w-4" />
                      Save Round
                  </Button>
              </div>
            </div>
        </CardContent>
      </Card>


      <div className="flex-1 overflow-y-auto border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50">
            <TableRow>
              <TableHead className="w-[200px]">Machine</TableHead>
              {columnVisibility.operator && <TableHead>Operator Name</TableHead>}
              {columnVisibility.sku && <TableHead>SKU (Size)</TableHead>}
              <TableHead className="w-[150px]">Quantity Produced</TableHead>
              {columnVisibility.remark && <TableHead>Remark</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => {
              return (
              <TableRow key={entry.machineId}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                
                {columnVisibility.operator && (
                  <TableCell>
                    <Select value={entry.operatorId} onValueChange={(val) => handleEntryChange(entry.machineId, 'operatorId', val)}>
                      <SelectTrigger><SelectValue placeholder="Select Operator" /></SelectTrigger>
                      <SelectContent>
                        {availableOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}

                {columnVisibility.sku && (
                  <TableCell>
                    <Input
                      placeholder="e.g., P-215-65R17"
                      value={entry.sku}
                      onChange={(e) => handleEntryChange(entry.machineId, 'sku', e.target.value)}
                      className="text-sm"
                    />
                  </TableCell>
                )}

                <TableCell>
                  <Input
                    type="number"
                    placeholder="e.g., 50"
                    value={entry.quantity === 0 ? '' : entry.quantity}
                    onChange={(e) => handleEntryChange(entry.machineId, 'quantity', e.target.value)}
                    className="text-sm"
                  />
                </TableCell>
                
                {columnVisibility.remark && (
                  <TableCell>
                    <Input
                      placeholder="Add remark..."
                      value={entry.remark || ''}
                      onChange={(e) => handleEntryChange(entry.machineId, 'remark', e.target.value)}
                      className="text-sm"
                    />
                  </TableCell>
                )}
              </TableRow>
            )})}
          </TableBody>
           <TableFooter>
                <TableRow>
                    <TableCell colSpan={footerColSpan} className="text-right font-bold text-lg">Round Total</TableCell>
                    <TableCell className="font-bold text-lg">{roundTotal.toLocaleString()}</TableCell>
                    {columnVisibility.remark && <TableCell />}
                </TableRow>
            </TableFooter>
        </Table>
      </div>
    </div>
  );
}
