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

// 🧩 Local Storage Helpers
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

// 🕒 Shift Detection Logic
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
      // Overnight shift
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

  // 🔹 Database Data
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<ProductionPlanItem[]>([]);

  // 🔹 State
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

  // 🔹 Round Time Generator
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

  // 🔹 Fetch Log Data
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

  // 🔹 Load Initial Data
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

  // 🔹 Hourly Summary
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
      if (totalForRound > 0) grouped[round] = totalForRound;
    });
    return grouped;
  }, [productionLog]);

  const totalShiftProduction = useMemo(() => {
    return Object.values(hourlyProduction).reduce((sum, qty) => sum + qty, 0);
  }, [hourlyProduction]);

  // 🔹 UI Logic
  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  // 🧠 Final UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-purple-100 p-6 space-y-6">
      {/* HEADER */}
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

      {/* 🧾 HOURLY SUMMARY */}
      <Card className="shadow-md border-l-4 border-blue-400 bg-gradient-to-r from-white to-blue-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowSaved(!showSaved)}
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
    </div>
  );
}
