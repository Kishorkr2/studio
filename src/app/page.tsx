"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, CheckCircle, Clock, Save, BarChart, Package } from 'lucide-react';
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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from "date-fns";
import type { MachineProductionData, ShiftInfo, Operator, ProductionLog } from '@/lib/types';
import { initialOperators, initialMachines, initialProductionPlan, shifts } from '@/lib/data';
import { cn } from '@/lib/utils';

// Helper function to initialize entries for a round
const getInitialEntries = (): MachineProductionData[] => {
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
};

export default function DashboardPage() {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo>(shifts[0]);
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  
  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

  // Initialize operators on mount
  useEffect(() => {
    setAvailableOperators(initialOperators.filter(op => !op.isAbsent));
  }, []);

  // Function to generate round times based on shift
  const generateRoundTimes = (shift: ShiftInfo): string[] => {
    const times: string[] = [];
    let [startHour] = shift.startTime.split(':').map(Number);
    let [endHour] = shift.endTime.split(':').map(Number);
    
    // Handle overnight shifts
    if (endHour <= startHour) {
      endHour += 24;
    }

    for (let i = startHour; i < endHour; i++) {
      const hour = i % 24;
      times.push(`${String(hour).padStart(2, '0')}:00`);
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
  }, [selectedShift, selectedDate]);

  // Effect to update entries when round changes
  useEffect(() => {
    if (!selectedRound) return;
    const loggedEntries = productionLog[selectedRound];
    if (loggedEntries) {
      setEntries(loggedEntries);
    } else {
      setEntries(getInitialEntries());
    }
    // This dependency array intentionally omits productionLog to avoid re-running when log is updated.
    // We only want to run this when the user actively changes the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound]);
  
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
    const savedRoundEntries = Object.values(productionLog).flat();
    const currentRoundEntries = entries.filter(e => !productionLog[selectedRound]?.some(l => l.machineId === e.machineId));
    
    const savedTotal = savedRoundEntries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
    // This calculation is a bit complex, let's simplify. Cumulative should just be what's in the log.
    // When the user saves, it will be added. Let's recalculate based only on the log.
    
    const loggedTotal = Object.values(productionLog)
      .flat()
      .reduce((acc, entry) => acc + (entry.quantity || 0), 0);

    return loggedTotal;
  }, [productionLog]);


  return (
    <div className="flex flex-col h-full gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Production Data Entry</h1>
        <p className="text-muted-foreground">Select date, shift, and round to enter production quantities.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
        <div className="grid gap-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
        </div>
        <div className="grid gap-2">
            <Label>Shift</Label>
            <Select value={selectedShift.name} onValueChange={(name) => setSelectedShift(shifts.find(s => s.name === name) || shifts[0])}>
              <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
              <SelectContent>
                {shifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}
              </SelectContent>
            </Select>
        </div>
        <div className="grid gap-2">
            <Label>Production Round</Label>
             <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger>
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {roundTimes.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
              </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
            <CardHeader>
                <CardTitle className="text-lg">Round Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <Package className="h-10 w-10 text-primary"/>
                <div>
                    <p className="text-sm text-muted-foreground">Current Round Total</p>
                    <p className="text-3xl font-bold">{roundTotal.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
        <Card className="md:col-span-1">
            <CardHeader>
                <CardTitle className="text-lg">Shift Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <BarChart className="h-10 w-10 text-primary"/>
                <div>
                    <p className="text-sm text-muted-foreground">Saved Cumulative Total</p>
                    <p className="text-3xl font-bold">{cumulativeTotal.toLocaleString()}</p>
                </div>
            </CardContent>
        </Card>
         <div className="md:col-span-1 flex items-end">
             <Button onClick={handleSaveRound} className="w-full h-14 text-lg"><Save className="mr-2 h-5 w-5" /> Save Round Data</Button>
         </div>
      </div>


      <div className="flex-1 overflow-y-auto border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/50">
            <TableRow>
              <TableHead className="w-[200px]">Machine</TableHead>
              <TableHead>Operator Name</TableHead>
              <TableHead>SKU (Size)</TableHead>
              <TableHead className="w-[150px]">Quantity Produced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(entry => {
              const planItem = initialProductionPlan.find(p => p.machineId === entry.machineId);
              return (
              <TableRow key={entry.machineId}>
                <TableCell className="font-medium">{entry.name}</TableCell>
                <TableCell>
                  <Select value={entry.operatorId} onValueChange={(val) => handleEntryChange(entry.machineId, 'operatorId', val)}>
                    <SelectTrigger><SelectValue placeholder="Select Operator" /></SelectTrigger>
                    <SelectContent>
                      {availableOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder={planItem ? "Assigned from plan" : "e.g., P-215-65R17"}
                    value={entry.sku}
                    disabled={!!planItem}
                    className={cn(!!planItem && 'cursor-not-allowed bg-muted/50')}
                  />
                </TableCell>
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
                    <TableCell colSpan={3} className="text-right font-bold text-lg">Round Total</TableCell>
                    <TableCell className="font-bold text-lg">{roundTotal.toLocaleString()}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
      </div>
    </div>
  );
}
