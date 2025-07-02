
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
import type { Machine, MachineProductionData, ShiftInfo, Operator, ProductionLog, ProductionPlanItem } from '@/lib/types';
import { initialOperators, initialMachines, initialProductionPlan, shifts } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/use-online-status';

export default function DashboardPage() {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<ProductionPlanItem[]>([]);
  
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

  useEffect(() => {
    const loadedShifts = JSON.parse(localStorage.getItem('tyretrack-shifts') || 'null') || shifts;
    const loadedMachines = JSON.parse(localStorage.getItem('tyretrack-machines') || 'null') || initialMachines;
    const loadedOperators = JSON.parse(localStorage.getItem('tyretrack-operators') || 'null') || initialOperators;
    const loadedProductionPlan = JSON.parse(localStorage.getItem('tyretrack-production-plan') || 'null') || initialProductionPlan;

    setAllShifts(loadedShifts);
    setAllMachines(loadedMachines);
    setAllOperators(loadedOperators);
    setAllProductionPlan(loadedProductionPlan);

    setAvailableOperators(loadedOperators.filter((op: Operator) => !op.isAbsent));
    
    if (loadedShifts.length > 0) {
      setSelectedShift(loadedShifts[0]);
    }
  }, []);
  
  const getLogKey = useCallback((date: Date, shift: ShiftInfo | undefined) => {
    if (!shift) return '';
    return `production-log-${format(date, "yyyy-MM-dd")}-${shift.name.replace(/\s+/g, '-')}`;
  }, []);

  const getInitialEntries = useCallback((): MachineProductionData[] => {
    const availableMachines = allMachines.filter(m => m.isAvailable);
    return availableMachines.map(machine => {
      const planItem = allProductionPlan.find(p => p.machineId === machine.id);
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
  }, [allMachines, allProductionPlan]);

  const generateRoundTimes = useCallback((shift: ShiftInfo | undefined): string[] => {
    if (!shift) return [];
    
    const times: string[] = [];
    const [startHourStr, startMinuteStr] = shift.startTime.split(':');
    let currentHour = parseInt(startHourStr, 10);

    // If start time is on the half hour, the first round is at the next full hour.
    if (startMinuteStr === '30') {
        currentHour = (currentHour + 1) % 24;
    }

    // A 12-hour shift has 12 hourly rounds.
    for (let i = 0; i < 12; i++) {
        const hour = (currentHour + i) % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12; // For 12 AM and 12 PM
        times.push(`${displayHour}:00 ${ampm}`);
    }

    return times;
  }, []);
  
  useEffect(() => {
    if(typeof window === 'undefined' || !selectedShift) return;

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
  }, [selectedDate, selectedShift, getLogKey, getInitialEntries, generateRoundTimes]);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedShift) {
        const logKey = getLogKey(selectedDate, selectedShift);
        if (logKey) {
            localStorage.setItem(logKey, JSON.stringify(productionLog));
        }
    }
  }, [productionLog, selectedDate, selectedShift, getLogKey]);

  useEffect(() => {
    if (!selectedRound) return;
    const loggedEntry = productionLog[selectedRound];
    if (loggedEntry) {
      const availableMachineIds = allMachines.filter(m => m.isAvailable).map(m => m.id);
      const filteredEntries = loggedEntry.entries.filter(e => availableMachineIds.includes(e.machineId));
      setEntries(filteredEntries);
    } else {
      setEntries(getInitialEntries());
    }
  }, [selectedRound, productionLog, getInitialEntries, allMachines]);
  
  useEffect(() => {
    if (isOnline) {
      const syncData = async () => {
        let changesMade = false;
        const updatedLog = { ...productionLog };

        for (const round of Object.keys(updatedLog)) {
          if (updatedLog[round].status === 'pending') {
            console.log(`Syncing round: ${round}`);
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
    if (!selectedRound) {
        toast({
            variant: "destructive",
            title: "Cannot Save",
            description: "Please select a round time first.",
        });
        return;
    }
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

  const handleShiftChange = (name: string) => {
    const newShift = allShifts.find(s => s.name === name);
    if(newShift) setSelectedShift(newShift);
  }

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
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Select value={selectedShift?.name || ''} onValueChange={handleShiftChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}
                    </SelectContent>
                  </Select>

                   <Select value={selectedRound} onValueChange={setSelectedRound}>
                    <SelectTrigger>
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
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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
              const planItem = allProductionPlan.find(p => p.machineId === entry.machineId);
              const machineSkus = planItem?.skus || [];
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
                    <Select
                      value={entry.sku}
                      onValueChange={(val) => handleEntryChange(entry.machineId, 'sku', val)}
                      disabled={machineSkus.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={machineSkus.length > 0 ? "Select SKU" : "No SKUs planned"} />
                      </SelectTrigger>
                      <SelectContent>
                        {machineSkus.map(sku => <SelectItem key={sku} value={sku}>{sku}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
