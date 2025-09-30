
"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Factory,
  PlusCircle,
  Save,
  Trash2,
} from "lucide-react";

import * as actions from "./actions";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  Machine,
  MachineProductionData,
  Operator,
  ProductionLog,
  ProductionPlanItem,
  ShiftInfo,
  SkuPlan,
} from "@/lib/types";
import { Loader } from "@/components/ui/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    window.localStorage.removeItem(key);
    return defaultValue;
  }
};

const setLocalStorageItem = (key: string, value: any) => {
  if (typeof window === "undefined") return;
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
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);

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

interface NewEntryRow {
  id: number;
  machineId: string;
  operatorId: string;
  sku: string;
  quantity: number | "";
}

interface SavedEntry {
  machineName: string;
  operatorName: string;
  sku: string;
  quantity: number;
  time: string;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");

  const [newEntries, setNewEntries] = useState<NewEntryRow[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([]);

  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

  const generateRoundTimes = useCallback((shift: ShiftInfo): string[] => {
    if (!shift) return [];
    const times: string[] = [];
    const shiftName = shift.name.toLowerCase();

    if (shiftName.includes("night")) {
      for (let h = 21; h <= 23; h++) times.push(`${String(h).padStart(2, "0")}:00`);
      for (let h = 0; h <= 6; h++) times.push(`${String(h).padStart(2, "0")}:00`);
      times.push("07:00");
    } else {
      for (let h = 9; h <= 18; h++) times.push(`${String(h).padStart(2, "0")}:00`);
      times.push("19:00");
    }

    return times.map((t) => {
      const [h] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      let displayHour = h % 12;
      if (displayHour === 0) displayHour = 12;
      return `${String(displayHour).padStart(2, "0")}:00 ${ampm}`;
    });
  }, []);

  const loadSavedEntriesForRound = useCallback((round: string, log: ProductionLog, operators: Operator[], machines: Machine[]) => {
      const logForRound = log[round]?.entries || [];
      const flattenedEntries: SavedEntry[] = [];

      logForRound.forEach(machineEntry => {
        machineEntry.skus.forEach(sku => {
          if (sku.quantity > 0) {
            flattenedEntries.push({
              machineName: machines.find(m => m.id === machineEntry.machineId)?.name || machineEntry.machineId,
              operatorName: operators.find(op => op.cardNo === machineEntry.operatorId)?.name || 'N/A',
              sku: sku.sku,
              quantity: sku.quantity,
              time: round,
            });
          }
        });
      });
      setSavedEntries(flattenedEntries);
    },
    []
  );

  const fetchAndSetLog = useCallback(async (date: Date, shift: ShiftInfo) => {
    setIsFetchingLog(true);
    try {
      const log = await actions.getProductionLogForShift(date, shift);
      setProductionLog(log);
      return log;
    } catch (error) {
      console.error("Failed to fetch production log:", error);
      toast({ variant: "destructive", title: "Error fetching shift data." });
      return {};
    } finally {
      setIsFetchingLog(false);
    }
  }, [toast]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsData, machinesData, operatorsData, planData] = await Promise.all([
        actions.getShifts(),
        actions.getMachines("TBM"),
        actions.getOperators(),
        actions.getProductionPlan(),
      ]);

      const availableMachines = machinesData.filter(m => m.isAvailable);
      setAllShifts(shiftsData);
      setAllMachines(availableMachines);
      setAllOperators(operatorsData);
      setAllProductionPlan(planData);
      const currentShift = getCurrentShift(shiftsData);
      setSelectedShift(currentShift);

      if (currentShift) {
        const newRoundTimes = generateRoundTimes(currentShift);
        setRoundTimes(newRoundTimes);
        
        const savedRound = getLocalStorageItem("selectedRound", "");
        const currentRound = newRoundTimes.includes(savedRound) ? savedRound : newRoundTimes[0] || "";
        setSelectedRound(currentRound);

        const log = await fetchAndSetLog(selectedDate, currentShift);
        loadSavedEntriesForRound(currentRound, log, operatorsData, availableMachines);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast({ variant: "destructive", title: "Error loading data" });
    } finally {
      setLoading(false);
    }
  }, [toast, generateRoundTimes, fetchAndSetLog, loadSavedEntriesForRound, selectedDate]);

  useEffect(() => {
    loadInitialData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAvailableOperators(allOperators.filter((op) => !op.isAbsent));
  }, [allOperators]);

  const handleSelectedRoundChange = useCallback(async (round: string) => {
    if (round === selectedRound) return;
    
    setSelectedRound(round);
    setLocalStorageItem("selectedRound", round);
    setNewEntries([]);
    
    if (selectedShift) {
      const log = await fetchAndSetLog(selectedDate, selectedShift);
      loadSavedEntriesForRound(round, log, allOperators, allMachines);
    }
  }, [selectedRound, selectedShift, selectedDate, fetchAndSetLog, loadSavedEntriesForRound, allOperators, allMachines]);

  const handleDateChange = useCallback(async (date: Date | undefined) => {
    if (!date || !selectedShift) return;
    
    const newDateStr = format(date, "yyyy-MM-dd");
    const currentDateStr = format(selectedDate, "yyyy-MM-dd");
    
    if (newDateStr !== currentDateStr) {
      setSelectedDate(date);
      setNewEntries([]);
      const log = await fetchAndSetLog(date, selectedShift);
      loadSavedEntriesForRound(selectedRound, log, allOperators, allMachines);
    }
  }, [selectedDate, selectedShift, fetchAndSetLog, loadSavedEntriesForRound, selectedRound, allOperators, allMachines]);

  const handleShiftChange = useCallback(async (name: string) => {
    const newShift = allShifts.find((s) => s.name === name);
    if (!newShift || newShift.name === selectedShift?.name) return;
    
    setSelectedShift(newShift);
    setNewEntries([]);

    const newRoundTimes = generateRoundTimes(newShift);
    setRoundTimes(newRoundTimes);
    const currentRound = newRoundTimes[0] || '';
    setSelectedRound(currentRound);

    const log = await fetchAndSetLog(selectedDate, newShift);
    loadSavedEntriesForRound(currentRound, log, allOperators, allMachines);
  }, [allShifts, selectedShift, generateRoundTimes, fetchAndSetLog, selectedDate, loadSavedEntriesForRound, allOperators, allMachines]);

  const handleAddEntryRow = () => {
    setNewEntries(prev => [...prev, { id: Date.now(), machineId: '', operatorId: '', sku: '', quantity: '' }]);
  };

  const handleRemoveEntryRow = (id: number) => {
    setNewEntries(prev => prev.filter(row => row.id !== id));
  };

  const handleNewEntryChange = (id: number, field: keyof NewEntryRow, value: string | number) => {
    setNewEntries(prev => prev.map(row => row.id === id ? { ...row, [field]: value, ...(field === 'machineId' && { sku: '' }) } : row));
  };

  const handleSaveAllEntries = useCallback(async () => {
    if (!selectedRound || !selectedShift) {
      toast({ variant: "destructive", title: "Cannot Save", description: "Select shift and hour." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in." });
      return;
    }
    
    const validEntries = newEntries.filter(e => e.machineId && e.operatorId && e.sku && e.quantity && e.quantity > 0);

    if (validEntries.length === 0) {
      toast({ variant: "destructive", title: "Nothing to Save", description: "Add valid production data first." });
      return;
    }

    const entriesToSave: MachineProductionData[] = validEntries.reduce<MachineProductionData[]>((acc, entry) => {
      const machineName = allMachines.find(m => m.id === entry.machineId)?.name || '';
      const sapCode = allProductionPlan
        .flatMap(p => p.skus)
        .find(s => s.sku === entry.sku)?.sapCode || '';

      let machineData = acc.find(m => m.machineId === entry.machineId && m.operatorId === entry.operatorId);
      if (!machineData) {
        machineData = {
          machineId: entry.machineId,
          name: machineName,
          operatorId: entry.operatorId,
          skus: [],
          userId: user.id,
          userName: user.name,
        };
        acc.push(machineData);
      }
      
      machineData.skus.push({
        sku: entry.sku,
        sapCode: sapCode,
        quantity: Number(entry.quantity),
      });

      return acc;
    }, []);
    
    try {
      await actions.saveProductionRound(selectedDate, selectedShift, selectedRound, entriesToSave);
      const log = await fetchAndSetLog(selectedDate, selectedShift);
      loadSavedEntriesForRound(selectedRound, log, allOperators, allMachines);
      setNewEntries([]);
      
      toast({
        title: "✅ Data Saved Successfully!",
        description: `${validEntries.length} production entries saved for ${selectedRound}.`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: "destructive", title: "❌ Save Failed", description: "Please try again." });
    }
  }, [selectedDate, selectedShift, selectedRound, newEntries, toast, user, allMachines, allProductionPlan, fetchAndSetLog, loadSavedEntriesForRound, allOperators]);


  const totalSavedQty = useMemo(() => {
    return savedEntries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [savedEntries]);
  
  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  const availableSkus = (machineId: string) => {
    if (!machineId) return [];
    return allProductionPlan.find(p => p.machineId === machineId)?.skus || [];
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-center gap-2">
        <Factory className="h-8 w-8 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-center">GT Production Entry</h1>
      </div>
      
      <Card className="shadow-md">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date-picker">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-picker"
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd-MM-yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-select">Shift</Label>
            <Select value={selectedShift?.name || ""} onValueChange={handleShiftChange}>
              <SelectTrigger id="shift-select">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {allShifts.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hour-select">Hour</Label>
            <Select value={selectedRound} onValueChange={handleSelectedRoundChange}>
              <SelectTrigger id="hour-select">
                <SelectValue placeholder="Select hour" />
              </SelectTrigger>
              <SelectContent>
                {roundTimes.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Production Entries</CardTitle>
          <Button variant="outline" size="sm" onClick={handleAddEntryRow}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {newEntries.length > 0 && newEntries.map((row, index) => (
            <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr,1fr,1fr,0.5fr,auto] gap-2 items-center p-2 border rounded-md">
               <Select value={row.machineId} onValueChange={(value) => handleNewEntryChange(row.id, 'machineId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="TBM No" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMachines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.operatorId} onValueChange={(value) => handleNewEntryChange(row.id, 'operatorId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Operator Name" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOperators.map(op => <SelectItem key={op.cardNo} value={op.cardNo}>{op.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.sku} onValueChange={(value) => handleNewEntryChange(row.id, 'sku', value)} disabled={!row.machineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkus(row.machineId).map(s => <SelectItem key={s.sku} value={s.sku}>{s.sku}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Quantity" value={row.quantity} onChange={e => handleNewEntryChange(row.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveEntryRow(row.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
          ))}
          {newEntries.length > 0 && (
             <Button onClick={handleSaveAllEntries} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <Save className="mr-2 h-4 w-4" />
                SAVE ALL ENTRIES
            </Button>
          )}
           {newEntries.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Click "Add Entry" to start adding production data.</p>
           )}
        </CardContent>
      </Card>
      
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
           <CardTitle>Saved Entries ({savedEntries.length} records)</CardTitle>
           <Badge variant="secondary" className="text-base">Total Qty: {totalSavedQty}</Badge>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg max-h-[40vh] overflow-auto">
                 <Table>
                  <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                      <TableHead>TBM No</TableHead>
                      <TableHead>Operator Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetchingLog ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <Loader />
                        </TableCell>
                      </TableRow>
                    ) : savedEntries.length > 0 ? savedEntries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.machineName}</TableCell>
                        <TableCell>{entry.operatorName}</TableCell>
                        <TableCell>{entry.sku}</TableCell>
                        <TableCell>{entry.quantity}</TableCell>
                        <TableCell>{entry.time}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No entries found for selected date, shift, and hour.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
