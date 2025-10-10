
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
  Package,
  Users,
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

type NewEntry = {
  id: number;
  machineId: string;
  operatorId: string;
  sku: string;
  quantity: string;
};

export default function GTProductionEntryPage() {
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
  
  const loadInitialData = useCallback(() => {
    setLoading(true);
    Promise.all([
      actions.getShifts(),
      actions.getMachines("TBM"),
      actions.getOperators(),
      actions.getProductionPlan(),
    ]).then(([shiftsData, machinesData, operatorsData, planData]) => {
      setAllShifts(shiftsData);
      setAllMachines(machinesData.filter(m => m.isAvailable));
      setAllOperators(operatorsData);
      setAllProductionPlan(planData);
      
      const currentShift = getCurrentShift(shiftsData);
      if (currentShift) {
        setSelectedShift(currentShift);
        const newRoundTimes = generateRoundTimes(currentShift);
        setRoundTimes(newRoundTimes);
        const savedRound = getLocalStorageItem("selectedRound", "");
        const currentRound = newRoundTimes.includes(savedRound) ? savedRound : newRoundTimes[0] || "";
        setSelectedRound(currentRound);
        fetchAndSetLog(new Date(), currentShift);
      }
    }).catch(error => {
      console.error("Failed to load initial data", error);
      toast({ variant: "destructive", title: "Error loading initial data." });
    }).finally(() => {
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const activeTbmCount = useMemo(() => {
    const machineIds = new Set<string>();
    Object.values(productionLog).forEach(logEntry => {
        logEntry.entries.forEach(machineEntry => {
            if (machineEntry.skus.some(sku => sku.quantity > 0)) {
                machineIds.add(machineEntry.machineId);
            }
        });
    });
    return machineIds.size;
  }, [productionLog]);

  const activeOperatorsCount = useMemo(() => {
    const operatorIds = new Set<string>();
    Object.values(productionLog).forEach(logEntry => {
        logEntry.entries.forEach(machineEntry => {
            if (machineEntry.operatorId) {
                operatorIds.add(machineEntry.operatorId);
            }
        });
    });
    return operatorIds.size;
  }, [productionLog]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6 space-y-6">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Factory className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                GT Production Entry
              </h1>
              <p className="text-indigo-100 mt-1">Real-time production tracking and management</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/20 px-4 py-3 rounded-xl backdrop-blur-sm flex items-center space-x-3">
              <BarChart3 className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium text-white/80">Shift Production</p>
                <p className="text-lg font-bold">{totalShiftProduction.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-3 rounded-xl backdrop-blur-sm flex items-center space-x-3">
              <Clock className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium text-white/80">Active TBM</p>
                <p className="text-lg font-bold">{activeTbmCount}</p>
              </div>
            </div>
            <div className="bg-white/20 px-4 py-3 rounded-xl backdrop-blur-sm flex items-center space-x-3">
              <Users className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium text-white/80">Operators</p>
                <p className="text-lg font-bold">{activeOperatorsCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Entry Card */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader
          className="flex flex-row justify-between items-center cursor-pointer p-6 border-b"
          onClick={() => setShowEntries(!showEntries)}
        >
          <CardTitle className="text-xl font-bold text-slate-800 flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <PlusCircle className="w-5 h-5 text-green-600" />
            </div>
            <span>Production Entries</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {newEntries.length} entries
            </Badge>
            {showEntries ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </div>
        </CardHeader>

        {showEntries && (
          <CardContent className="p-6 space-y-6">
            {/* Date/Shift Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal bg-white", !selectedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Shift</label>
                <Select value={selectedShift?.name} onValueChange={handleShiftChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Hour</label>
                <Select value={selectedRound} onValueChange={(value) => { setSelectedRound(value); setLocalStorageItem("selectedRound", value); }}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Hour" />
                  </SelectTrigger>
                  <SelectContent>
                    {roundTimes.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Entry Forms */}
            <div className="space-y-4">
              {newEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-slate-300 transition-all"
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Machine</label>
                      <Select
                        value={entry.machineId}
                        onValueChange={(value) => handleEntryChange(entry.id, "machineId", value)}
                      >
                        <SelectTrigger className="w-full bg-slate-50">
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
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Operator</label>
                      <Select
                        value={entry.operatorId}
                        onValueChange={(value) => handleEntryChange(entry.id, "operatorId", value)}
                      >
                        <SelectTrigger className="w-full bg-slate-50">
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
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">SKU</label>
                      <Select
                        value={entry.sku}
                        onValueChange={(value) => handleEntryChange(entry.id, "sku", value)}
                        disabled={!entry.machineId}
                      >
                        <SelectTrigger className="w-full bg-slate-50">
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
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Quantity</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0"
                          className="text-center bg-slate-50"
                          value={entry.quantity}
                          onChange={(e) => handleEntryChange(entry.id, "quantity", e.target.value)}
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleAddEntry} 
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Another Entry
              </Button>
              <Button 
                onClick={handleSaveAllEntries} 
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-1 shadow-lg"
                size="lg"
              >
                <Save className="mr-2 h-5 w-5" />
                SAVE ALL ENTRIES
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Hourly Production Summary */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader
          className="flex flex-row justify-between items-center cursor-pointer p-6 border-b"
          onClick={() => setShowSaved(!showSaved)}
        >
          <CardTitle className="text-xl font-bold text-slate-800 flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <span>Hourly Production Summary</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {Object.keys(hourlyProduction).length} hours
            </Badge>
            {showSaved ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </div>
        </CardHeader>

        {showSaved && (
          <CardContent className="p-6">
            {isFetchingLog ? (
              <div className="flex justify-center py-8">
                <Loader />
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Hour</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(hourlyProduction).length > 0 ? (
                      Object.entries(hourlyProduction).map(([hour, qty]) => (
                        <TableRow key={hour} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                          <TableCell className="font-medium py-4">{hour}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600 py-4">
                            {qty.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-slate-500">
                          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <p className="font-medium">No production data for this shift yet</p>
                          <p className="text-sm mt-1">Start adding production entries above</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Floating Action Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full p-4 shadow-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl hover:scale-105 transition-all z-10"
        onClick={handleAddEntry}
        size="lg"
      >
        <PlusCircle className="w-6 h-6" />
      </Button>
    </div>
  );
}

    