
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, CheckCircle, Clock, Eraser, Save, SlidersHorizontal, Loader2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import type { Machine, MachineProductionData, ShiftInfo, Operator, ProductionLog, ProductionPlanItem } from '@/lib/types';
import { initialOperators, initialMachines, initialProductionPlan, shifts } from '@/lib/data';
import { cn } from '@/lib/utils';
import * as DataService from '@/lib/data-service';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
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
    trolleyNo: true,
    noOfSpool: true,
    remark: true,
  });

  // --- Data Fetching and Subscriptions ---
  useEffect(() => {
    setLoading(true);
    const unsubShifts = DataService.subscribeToCollection<ShiftInfo>('shifts', (data) => {
        setAllShifts(data);
        if (data.length > 0 && !selectedShift) {
            setSelectedShift(data[0]);
        }
    }, shifts);
    const unsubMachines = DataService.subscribeToCollection<Machine>('machines', setAllMachines, initialMachines);
    const unsubOperators = DataService.subscribeToCollection<Operator>('operators', (data) => {
        setAllOperators(data);
        setAvailableOperators(data.filter(op => !op.isAbsent));
    }, initialOperators);
    const unsubProductionPlan = DataService.subscribeToCollection<ProductionPlanItem>('productionPlan', setAllProductionPlan, initialProductionPlan);
    
    setLoading(false);

    return () => {
        unsubShifts();
        unsubMachines();
        unsubOperators();
        unsubProductionPlan();
    };
  }, []);

  const generateRoundTimes = useCallback((shift: ShiftInfo | undefined): string[] => {
    if (!shift) return [];
    
    const times: string[] = [];
    const [startHourStr] = shift.startTime.split(':');
    let currentHour = parseInt(startHourStr, 10);
    
    if (shift.name.toLowerCase().includes('day')) {
        currentHour = 8;
    } else {
        currentHour = 20;
    }
    
    for (let i = 0; i < 12; i++) {
        const hour = (currentHour + i) % 24;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        let displayHour = hour % 12;
        if (displayHour === 0) displayHour = 12;
        times.push(`${displayHour}:00 ${ampm}`);
    }

    return times;
  }, []);
  
  useEffect(() => {
    if(!selectedShift) return;

    const newRoundTimes = generateRoundTimes(selectedShift);
    setRoundTimes(newRoundTimes);
    
    if (!newRoundTimes.includes(selectedRound) || !selectedRound) {
      setSelectedRound(newRoundTimes[0] || '');
    }
  
    const unsub = DataService.subscribeToProductionLog(selectedDate, selectedShift, setProductionLog);
    return () => unsub();
  }, [selectedDate, selectedShift, generateRoundTimes, selectedRound]);

  useEffect(() => {
    if (!selectedRound || allMachines.length === 0) {
      setEntries([]);
      return;
    }

    // 1. Create a map of the current production plan for efficient lookup.
    const planMap = new Map(allProductionPlan.map(p => [p.machineId, p.skus]));
    
    // 2. Filter machines that are available AND in the current plan.
    const machinesForPlan = allMachines.filter(m => m.isAvailable && planMap.has(m.id));

    // 3. Get the logged entries for the currently selected round.
    const roundLogEntries = productionLog[selectedRound]?.entries || [];
    const logMap = new Map(roundLogEntries.map(e => [e.machineId, e]));

    // 4. Map over the planned machines to create the final list of entries for display.
    const newEntries = machinesForPlan.map(machine => {
      const loggedEntry = logMap.get(machine.id);
      const machineSkus = planMap.get(machine.id) || [];
      
      let finalSku = machineSkus[0] || ''; // Default to the first SKU in the plan.

      // If there's a logged entry, check if its SKU is still valid in the new plan.
      if (loggedEntry && loggedEntry.sku && machineSkus.includes(loggedEntry.sku)) {
        finalSku = loggedEntry.sku;
      }

      // Build the final entry object, merging plan data with log data.
      return {
        machineId: machine.id,
        name: machine.name,
        status: 'Online' as const,
        sku: finalSku,
        quantity: loggedEntry?.quantity || 0,
        operatorId: loggedEntry?.operatorId || '',
        remark: loggedEntry?.remark || '',
        trolleyNo: loggedEntry?.trolleyNo || '',
        noOfSpool: loggedEntry?.noOfSpool || '',
      };
    });

    setEntries(newEntries);
  }, [selectedRound, productionLog, allMachines, allProductionPlan]);


  const handleEntryChange = (machineId: string, field: 'operatorId' | 'quantity' | 'remark' | 'sku' | 'trolleyNo' | 'noOfSpool', value: string) => {
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
  
  const handleSaveRound = async () => {
    if (!selectedRound || !selectedShift) {
        toast({
            variant: "destructive",
            title: "Cannot Save",
            description: "Please select a shift and round time first.",
        });
        return;
    }
    
    await DataService.saveProductionRound(selectedDate, selectedShift, selectedRound, entries);

    toast({
      title: 'Round Data Saved',
      description: `Data for round ${selectedRound} has been saved to the cloud.`,
      action: <Save className="text-green-500" />,
    });
  };

  const handleClearShiftData = async () => {
    if (!selectedShift) return;
    await DataService.clearShiftData(selectedDate, selectedShift);
    // The onSnapshot listener will automatically clear the log and trigger a re-render.
    toast({
      title: 'Shift Data Cleared',
      description: `All production entries for ${selectedShift.name} on ${format(selectedDate, "PPP")} have been removed.`,
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

  if(loading) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Green Tyre Production Entry</h1>
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

  return (
    <div className="flex flex-col h-full gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Green Tyre Production Entry</h1>
        <p className="text-muted-foreground">Select date, shift, and round to enter production quantities.</p>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
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
                                <Loader2 className="w-4 h-4 ml-2 animate-spin text-yellow-500" title="Syncing..." />
                            )}
                            {logEntry?.status === 'synced' && (
                                <CheckCircle className="w-4 h-4 ml-2 text-green-500" title="Synced"/>
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
                    checked={columnVisibility.trolleyNo}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, trolleyNo: !!value}))}
                  >
                    Trolley No
                  </DropdownMenuCheckboxItem>
                   <DropdownMenuCheckboxItem
                    className="capitalize"
                    checked={columnVisibility.noOfSpool}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, noOfSpool: !!value}))}
                  >
                    No of Spool
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

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        <Eraser className="mr-2 h-4 w-4" />
                        Clear Shift Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all production data for the
                        selected shift ({selectedShift?.name} on {selectedDate ? format(selectedDate, "PPP") : ''}). This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearShiftData}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={handleSaveRound} size="lg" className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
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
              <p className="text-sm">Please upload a market requirement file in the Admin panel.</p>
            </CardContent>
          </Card>
        )}
        {entries.map(entry => {
          const planItem = allProductionPlan.find(p => p.machineId === entry.machineId);
          const machineSkus = planItem?.skus || [];
          return (
          <Card key={entry.machineId}>
            <CardHeader>
              <CardTitle>{entry.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
                {columnVisibility.operator && (
                  <div className="space-y-2">
                    <Label htmlFor={`operator-${entry.machineId}`}>Operator Name</Label>
                    <Select value={entry.operatorId} onValueChange={(val) => handleEntryChange(entry.machineId, 'operatorId', val)}>
                      <SelectTrigger id={`operator-${entry.machineId}`}><SelectValue placeholder="Select Operator" /></SelectTrigger>
                      <SelectContent>
                        {availableOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {columnVisibility.sku && (
                  <div className="space-y-2">
                    <Label htmlFor={`sku-${entry.machineId}`}>SKU (Size)</Label>
                    <Select
                      value={entry.sku}
                      onValueChange={(val) => handleEntryChange(entry.machineId, 'sku', val)}
                      disabled={machineSkus.length === 0}
                    >
                      <SelectTrigger id={`sku-${entry.machineId}`}>
                        <SelectValue placeholder={machineSkus.length > 0 ? "Select SKU" : "No SKUs planned"} />
                      </SelectTrigger>
                      <SelectContent>
                        {machineSkus.map(sku => <SelectItem key={sku} value={sku}>{sku}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${entry.machineId}`}>Quantity Produced</Label>
                  <Input
                    id={`quantity-${entry.machineId}`}
                    type="number"
                    placeholder="e.g., 50"
                    value={entry.quantity === 0 ? '' : entry.quantity}
                    onChange={(e) => handleEntryChange(entry.machineId, 'quantity', e.target.value)}
                  />
                </div>
                {columnVisibility.trolleyNo && (
                  <div className="space-y-2">
                    <Label htmlFor={`trolley-${entry.machineId}`}>Trolley No</Label>
                    <Input
                      id={`trolley-${entry.machineId}`}
                      placeholder="e.g., T-123"
                      value={entry.trolleyNo || ''}
                      onChange={(e) => handleEntryChange(entry.machineId, 'trolleyNo', e.target.value)}
                    />
                  </div>
                )}
                {columnVisibility.noOfSpool && (
                  <div className="space-y-2">
                    <Label htmlFor={`spool-${entry.machineId}`}>No of Spool</Label>
                    <Input
                      id={`spool-${entry.machineId}`}
                      placeholder="e.g., S-456"
                      value={entry.noOfSpool || ''}
                      onChange={(e) => handleEntryChange(entry.machineId, 'noOfSpool', e.target.value)}
                    />
                  </div>
                )}
                {columnVisibility.remark && (
                  <div className="space-y-2">
                    <Label htmlFor={`remark-${entry.machineId}`}>Remark</Label>
                    <Input
                      id={`remark-${entry.machineId}`}
                      placeholder="Add remark..."
                      value={entry.remark || ''}
                      onChange={(e) => handleEntryChange(entry.machineId, 'remark', e.target.value)}
                    />
                  </div>
                )}
            </CardContent>
          </Card>
        )})}
      </div>
    </div>
  );
}
