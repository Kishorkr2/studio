"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, CheckCircle, Clock } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { format } from "date-fns";
import type { MachineProductionData, ShiftInfo, Operator } from '@/lib/types';
import { initialOperators, initialMachines, initialProductionPlan, shifts } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo>(shifts[0]);
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

  useEffect(() => {
    setAvailableOperators(initialOperators.filter(op => !op.isAbsent));
    
    const availableMachines = initialMachines.filter(m => m.isAvailable);
    const initialEntries = availableMachines.map(machine => {
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
    setEntries(initialEntries);
  }, []);

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

  useEffect(() => {
    const newRoundTimes = generateRoundTimes(selectedShift);
    setRoundTimes(newRoundTimes);
    setSelectedRound(newRoundTimes[0] || '');
  }, [selectedShift]);
  
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
  
  const handleSubmitAll = () => {
    const submissionData = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      shift: selectedShift.name,
      round: selectedRound,
      entries: entries.filter(e => e.quantity > 0 && e.operatorId),
    };
    console.log('Submitting data:', submissionData);
    toast({
      title: 'Success!',
      description: `Data for ${submissionData.shift} at ${submissionData.round} submitted.`,
      action: <CheckCircle className="text-green-500" />,
    });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Production Data Entry</h1>
        <p className="text-muted-foreground">Select date, shift, and round to enter production quantities.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg">
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
        <Button onClick={handleSubmitAll} className="h-10">Submit All Data</Button>
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
        </Table>
      </div>
    </div>
  );
}
