"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, CheckCircle, Clock, Save, SlidersHorizontal } from 'lucide-react';
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

export default function DashboardPage() {
  const { toast } = useToast();

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
  });

  // Helper function to initialize entries for a round
  const getInitialEntries = useCallback((): MachineProductionData[] => {
    const availableMachines = initialMachines.filter(m => m.isAvailable);
    return availableMachines.map(machine => {
      const planItem = initialProductionPlan.find(p => p.machineId === machine.id);
      return {
        machineId: machine.id,
        name: machine.name,
        status: 'Online',
        sku: planItem?.sku || '',
        quantity: 0,
        operatorId: '',
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
    // User specified round start times
    const roundStartHour = shift.name === 'Day Shift' ? 9 : 21; // 9 AM for Day, 9 PM for Night

    let [endHour] = shift.endTime.split(':').map(Number);
    const startHour = roundStartHour;
    
    // Handle overnight shifts
    let loopEndHour = endHour;
    if (shift.name === 'Night Shift') {
        // If the end hour is in the morning (e.g., 7) and start is in the evening (e.g., 21),
        // we've crossed midnight.
        if (loopEndHour < startHour) {
            loopEndHour += 24;
        }
    }

    for (let i = startHour; i < loopEndHour; i++) {
      const hour = i % 24;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12; // for 12 AM and 12 PM
      
      times.push(`${displayHour}:00 ${ampm}`);
    }
    return times;
  };

  // Effect to handle shift or date changes
  useEffect(() => {
    const newRoundTimes = generateRoundTimes(selectedShift);
    setRoundTimes(newRoundTimes);
    const firstRound = newRoundTimes[0] || '';
    setSelectedRound(firstRound);
    setProductionLog({}); // Reset log on date/shift change
    setEntries(getInitialEntries()); // Set initial entries for the first round
  }, [selectedShift, selectedDate, getInitialEntries]);

  // Effect to update entries when round changes
  useEffect(() => {
    if (!selectedRound) return;
    const loggedEntries = productionLog[selectedRound];
    if (loggedEntries) {
      setEntries(loggedEntries);
    } else {
      setEntries(getInitialEntries());
    }
  }, [selectedRound, productionLog, getInitialEntries]);
  
  const handleEntryChange = (machineId: string, field: 'operatorId' | 'quantity', value: string) => {
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
      [selectedRound]: entries,
    }));

    toast({
      title: 'Round Data Saved!',
      description: `Data for ${selectedShift.name} at ${selectedRound} has been saved.`,
      action: <CheckCircle className="text-green-500" />,
    });
  };

  const roundTotal = useMemo(() => {
    return entries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    // This correctly calculates total from the log of *saved* rounds
    const loggedTotal = Object.values(productionLog)
      .flat()
      .reduce((acc, entry) => acc + (entry.quantity || 0), 0);

    return loggedTotal;
  }, [productionLog]);

  const footerColSpan = 1 + (columnVisibility.operator ? 1 : 0) + (columnVisibility.sku ? 1 : 0);

  return (
    <div className="flex flex-col h-full gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Production Data Entry</h1>
        <p className="text-muted-foreground">Select date, shift, and round to enter production quantities.</p>
      </header>

      {/* Control bar with selectors, totals, and save button */}
      <Card>
        <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
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
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}
                    </SelectContent>
                  </Select>

                   <Select value={selectedRound} onValueChange={setSelectedRound}>
                    <SelectTrigger className="w-[180px]">
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {roundTimes.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
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
                    </DropdownMenuContent>
                  </DropdownMenu>

              </div>
              
              <div className="flex items-center gap-6">
                  <div className="flex gap-6 text-center">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => {
              const planItem = initialProductionPlan.find(p => p.machineId === entry.machineId);
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
                      placeholder={planItem ? "Assigned from plan" : "e.g., P-215-65R17"}
                      value={entry.sku}
                      disabled={!!planItem}
                      className={cn(!!planItem && 'cursor-not-allowed bg-muted/50')}
                    />
                  </TableCell>
                )}

                <TableCell>
                  <Input
                    type="number"
                    placeholder="e.g., 50"
                    value={entry.quantity === 0 ? '' : entry.quantity}
                    onChange={(e) => handleEntryChange(entry.machineId, 'quantity', e.target.value)}
                  />
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
           <TableFooter>
                <TableRow>
                    <TableCell colSpan={footerColSpan} className="text-right font-bold text-lg">Round Total</TableCell>
                    <TableCell className="font-bold text-lg">{roundTotal.toLocaleString()}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
      </div>
    </div>
  );
}
