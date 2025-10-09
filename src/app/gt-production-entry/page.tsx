
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2,
  Factory,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Clock,
  BarChart3,
  Save,
  CalendarIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as actions from "../actions";
import { useAuth } from "@/components/auth-provider";
import type {
  Machine,
  Operator,
  ProductionPlanItem,
  ShiftInfo,
  MachineProductionData,
  ProductionLog,
} from "@/lib/types";
import { Loader } from "@/components/ui/loader";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

type NewEntry = {
  id: number;
  machineId: string;
  operatorId: string;
  sku: string;
  quantity: string;
};

export default function GTProductionEntry() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isFetchingLog, setIsFetchingLog] = useState(false);

  // Data from DB
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<ProductionPlanItem[]>([]);
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [newEntries, setNewEntries] = useState<NewEntry[]>([
    { id: Date.now(), machineId: "", operatorId: "", sku: "", quantity: "" },
  ]);
  const [showEntries, setShowEntries] = useState(true);
  const [showSaved, setShowSaved] = useState(true);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});

  const availableOperators = useMemo(() => allOperators.filter(op => !op.isAbsent), [allOperators]);

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

      setAllShifts(shiftsData);
      setAllMachines(machinesData.filter(m => m.isAvailable));
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
        await fetchAndSetLog(new Date(), currentShift);
      }
    } catch (error) {
      console.error("Failed to load initial data", error);
      toast({ variant: "destructive", title: "Error loading initial data." });
    } finally {
      setLoading(false);
    }
  }, [toast, generateRoundTimes, fetchAndSetLog]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const hourlyProduction = useMemo(() => {
    if (!productionLog) return {};
    const grouped: { [hour: string]: number } = {};
    Object.entries(productionLog).forEach(([round, logEntry]) => {
      const totalForRound = logEntry.entries.reduce(
        (sum, machineEntry) =>
          sum +
          machineEntry.skus.reduce(
            (skuSum, sku) => skuSum + (sku.quantity || 0),
            0
          ),
        0
      );
      if (totalForRound > 0) {
        grouped[round] = totalForRound;
      }
    });
    return grouped;
  }, [productionLog]);
  
  const totalShiftProduction = useMemo(() => {
    return Object.values(hourlyProduction).reduce((sum, qty) => sum + qty, 0);
  }, [hourlyProduction]);

  const handleEntryChange = (id: number, field: keyof Omit<NewEntry, "id">, value: string) => {
    setNewEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  const handleAddEntry = () => {
    setNewEntries([
      ...newEntries,
      { id: Date.now(), machineId: "", operatorId: "", sku: "", quantity: "" },
    ]);
  };

  const handleDeleteEntry = (id: number) => {
    setNewEntries((prev) => prev.filter((entry) => entry.id !== id));
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
    
    const validEntries = newEntries.filter(e => e.machineId && e.operatorId && e.sku && e.quantity && Number(e.quantity) > 0);

    if (validEntries.length === 0) {
      toast({ variant: "destructive", title: "Nothing to Save", description: "Add valid production data first." });
      return;
    }
    
    const entriesByMachineAndOperator: Record<string, MachineProductionData> = {};
    
    validEntries.forEach(entry => {
        const key = `${entry.machineId}-${entry.operatorId}`;
        const machineName = allMachines.find(m => m.id === entry.machineId)?.name || '';
        const sapCode = allProductionPlan.flatMap(p => p.skus).find(s => s.sku === entry.sku)?.sapCode || '';
        
        if (!entriesByMachineAndOperator[key]) {
            entriesByMachineAndOperator[key] = {
                machineId: entry.machineId,
                name: machineName,
                operatorId: entry.operatorId,
                skus: [],
                userId: user.id,
                userName: user.name,
            };
        }
        
        entriesByMachineAndOperator[key].skus.push({
            sku: entry.sku,
            sapCode: sapCode,
            quantity: Number(entry.quantity),
        });
    });
    
    try {
      await actions.saveProductionRound(selectedDate, selectedShift, selectedRound, Object.values(entriesByMachineAndOperator));
      await fetchAndSetLog(selectedDate, selectedShift);
      setNewEntries([{ id: Date.now(), machineId: "", operatorId: "", sku: "", quantity: "" }]);
      
      toast({
        title: "✅ Data Saved Successfully!",
        description: `${validEntries.length} production entries saved for ${selectedRound}.`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: "destructive", title: "❌ Save Failed", description: "Please try again." });
    }
  }, [selectedDate, selectedShift, selectedRound, newEntries, toast, user, allMachines, allProductionPlan, fetchAndSetLog]);

  const availableSkus = (machineId: string) => {
    if (!machineId) return [];
    return allProductionPlan.find(p => p.machineId === machineId)?.skus || [];
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date && selectedShift) {
        setSelectedDate(date);
        fetchAndSetLog(date, selectedShift);
    }
  };

  const handleShiftChange = (shiftName: string) => {
    const newShift = allShifts.find(s => s.name === shiftName);
    if(newShift) {
        setSelectedShift(newShift);
        const newRoundTimes = generateRoundTimes(newShift);
        setRoundTimes(newRoundTimes);
        setSelectedRound(newRoundTimes[0] || "");
        fetchAndSetLog(selectedDate, newShift);
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-purple-100 p-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-700 via-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center space-x-4">
          <Factory className="w-10 h-10 drop-shadow-md" />
          <h1 className="text-3xl font-extrabold tracking-wide drop-shadow-lg">
            GT Production Entry
          </h1>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <div className="bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Shift Prod: {totalShiftProduction.toLocaleString()}</span>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Active TBM: {allMachines.length}</span>
          </div>
        </div>
      </div>

      <Card className="shadow-md border-l-4 border-green-400 bg-gradient-to-r from-white to-green-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowEntries(!showEntries)}
        >
          <CardTitle className="text-green-700 font-bold flex items-center space-x-2">
            <span>Production Entries</span>
            {showEntries ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>

        {showEntries && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                        <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                    </PopoverContent>
                </Popover>
                <Select value={selectedShift?.name} onValueChange={handleShiftChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Shift" />
                    </SelectTrigger>
                    <SelectContent>
                        {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedRound} onValueChange={(value) => { setSelectedRound(value); setLocalStorageItem("selectedRound", value); }}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Hour" />
                    </SelectTrigger>
                    <SelectContent>
                        {roundTimes.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-4">
              {newEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition"
                >
                  <Select
                    value={entry.machineId}
                    onValueChange={(value) => handleEntryChange(entry.id, "machineId", value)}
                  >
                    <SelectTrigger className="w-full sm:w-[120px] bg-blue-50">
                      <SelectValue placeholder="TBM No" />
                    </SelectTrigger>
                    <SelectContent>
                      {allMachines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.operatorId}
                    onValueChange={(value) => handleEntryChange(entry.id, "operatorId", value)}
                  >
                    <SelectTrigger className="w-full sm:w-[150px] bg-green-50">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map((op) => (
                        <SelectItem key={op.cardNo} value={op.cardNo}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.sku}
                    onValueChange={(value) => handleEntryChange(entry.id, "sku", value)}
                    disabled={!entry.machineId}
                  >
                    <SelectTrigger className="w-full sm:w-[140px] bg-purple-50">
                      <SelectValue placeholder="SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSkus(entry.machineId).map((sku) => (
                        <SelectItem key={sku.sapCode} value={sku.sku}>
                          {sku.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    placeholder="Qty"
                    className="w-full sm:w-[80px] text-center"
                    value={entry.quantity}
                    onChange={(e) => handleEntryChange(entry.id, "quantity", e.target.value)}
                  />

                  <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleSaveAllEntries} className="mt-6 bg-green-600 hover:bg-green-700 w-full">
              <Save className="mr-2 h-4 w-4" />
              SAVE ENTRIES
            </Button>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-md border-l-4 border-blue-400 bg-gradient-to-r from-white to-blue-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={()={() => setShowSaved(!showSaved)}
        >
          <CardTitle className="text-blue-700 font-bold flex items-center space-x-2">
            <span>Hourly Production Summary</span>
            {showSaved ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>

        {showSaved && (
          <CardContent>
            {isFetchingLog ? <Loader /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hour</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(hourlyProduction).length > 0 ? (
                  Object.entries(hourlyProduction).map(([hour, qty]) => (
                    <TableRow key={hour} className="hover:bg-blue-100 transition">
                      <TableCell>{hour}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-700">
                        {qty.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-gray-500 italic">
                      No production saved for this shift yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        )}
      </Card>

      <Button
        className="fixed bottom-6 right-6 rounded-full p-5 shadow-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:scale-105 transition-transform"
        onClick={handleAddEntry}
      >
        <PlusCircle className="mr-2" /> Add Entry
      </Button>
    </div>
  );
}

