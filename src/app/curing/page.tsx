"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Eraser,
  Package,
  PlusCircle,
  Save,
  Sigma,
  Trash2,
} from "lucide-react";

import * as actions from "../actions";
import { useAuth } from "@/components/auth-provider";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  Machine,
  Operator,
  ProductionLog,
  ShiftInfo,
  TreadStock,
  SkuPlan,
} from "@/lib/types";
import { Loader } from "@/components/ui/loader";

interface CuringEntry {
  id: number;
  pressId: string;
  cavity: "left" | "right" | "";
  operatorId: string;
  sku: string;
  sapCode: string;
  quantity: number | "";
}

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

export default function CuringPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isFetchingLog, setIsFetchingLog] = useState(false);

  // Data State
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [allCuringPresses, setAllCuringPresses] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allSkusFromPlan, setAllSkusFromPlan] = useState<SkuPlan[]>([]);
  const [greenTyreStock, setGreenTyreStock] = useState<TreadStock[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});

  // UI/Selection State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Entry State
  const [curingEntries, setCuringEntries] = useState<CuringEntry[]>([]);

  const availableOperators = useMemo(
    () => allOperators.filter((op) => !op.isAbsent),
    [allOperators],
  );

  const generateRoundTimes = useCallback((shift: ShiftInfo): string[] => {
    if (!shift) return [];
    const times: string[] = [];
    const shiftName = shift.name.toLowerCase();

    if (shiftName.includes("night")) {
      for (let h = 21; h <= 23; h++)
        times.push(`${String(h).padStart(2, "0")}:00`);
      for (let h = 0; h <= 6; h++)
        times.push(`${String(h).padStart(2, "0")}:00`);
      times.push("07:00");
    } else {
      for (let h = 9; h <= 18; h++)
        times.push(`${String(h).padStart(2, "0")}:00`);
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

  const fetchAndSetLog = useCallback(
    async (date: Date, shift: ShiftInfo) => {
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
    },
    [toast],
  );

  const loadEntriesForRound = useCallback(
    (round: string, log: ProductionLog) => {
      const logForRound = log[round]?.entries || [];

      const newEntries: CuringEntry[] = logForRound.flatMap((machineEntry) => {
        return machineEntry.skus.map((sku) => ({
          id: Math.random(),
          pressId: machineEntry.machineId,
          cavity: sku.leftQty && sku.leftQty > 0 ? "left" : "right",
          operatorId: machineEntry.operatorId || "",
          sku: sku.sku,
          sapCode: sku.sapCode,
          quantity: sku.quantity,
        }));
      });

      if (newEntries.length === 0) {
        setCuringEntries([
          {
            id: Date.now(),
            pressId: "",
            cavity: "",
            operatorId: "",
            sku: "",
            sapCode: "",
            quantity: "",
          },
        ]);
      } else {
        setCuringEntries(newEntries);
      }
    },
    [],
  );

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [
          shiftsData,
          machinesData,
          operatorsData,
          planData,
          openingStock,
          dailyLogs,
          historyLogs,
        ] = await Promise.all([
          actions.getShifts(),
          actions.getMachines("CuringPress"),
          actions.getOperators(),
          actions.getProductionPlan(),
          actions.getTreadOpeningStock(),
          actions.getDailyTreadProductionLog(),
          actions.getProductionLogs(),
        ]);

        setAllShifts(shiftsData);
        setAllCuringPresses(machinesData);
        setAllOperators(operatorsData);

        const skuMap = new Map<string, SkuPlan>();
        planData.forEach((item) => {
          item.skus.forEach((skuPlan) => {
            if (!skuPlan.sapCode) return;
            const key = skuPlan.sapCode;
            const existing = skuMap.get(key);
            if (existing) {
              skuMap.set(key, {
                ...existing,
                quantity: (existing.quantity || 0) + (skuPlan.quantity || 0),
              });
            } else {
              skuMap.set(key, { ...skuPlan });
            }
          });
        });
        const skus = Array.from(skuMap.values());
        setAllSkusFromPlan(skus);

        const dailyTotals: Record<string, number> = {};
        if (dailyLogs) {
          for (const dateKey in dailyLogs) {
            for (const shiftName in dailyLogs[dateKey]) {
              for (const sapCode in dailyLogs[dateKey][shiftName]) {
                const entry = dailyLogs[dateKey][shiftName][sapCode];
                dailyTotals[sapCode] =
                  (dailyTotals[sapCode] || 0) + (entry.quantity || 0);
              }
            }
          }
        }

        const tyreProd: Record<string, number> = {};
        (historyLogs as any[])
          .filter((log) => log.machineName && log.machineName.startsWith("CP"))
          .forEach((entry) => {
            if (entry.sapCode && entry.quantity > 0) {
              tyreProd[entry.sapCode] =
                (tyreProd[entry.sapCode] || 0) + (entry.quantity || 0);
            }
          });

        const stock = skus.map((req) => {
          const openingStockInfo = openingStock.find(
            (t) => t.sapCode === req.sapCode,
          ) || { openingStock: 0 };
          const totalProduction = dailyTotals[req.sapCode] || 0;
          const tyreProduction = tyreProd[req.sapCode] || 0;
          const currentTreadStock =
            (openingStockInfo.openingStock || 0) +
            totalProduction -
            tyreProduction;
          return {
            ...req,
            openingStock: openingStockInfo.openingStock,
            production: totalProduction,
            currentTreadStock,
          };
        });
        setGreenTyreStock(stock);

        const currentShift = getCurrentShift(shiftsData);

        if (currentShift) {
          setSelectedShift(currentShift);
          const newRoundTimes = generateRoundTimes(currentShift);
          setRoundTimes(newRoundTimes);

          const log = await fetchAndSetLog(new Date(), currentShift);

          const savedRound = getLocalStorageItem("curingSelectedRound", "");
          const currentRound = newRoundTimes.includes(savedRound)
            ? savedRound
            : newRoundTimes[0] || "";
          setSelectedRound(currentRound);

          loadEntriesForRound(currentRound, log);
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
        toast({ variant: "destructive", title: "Error loading data" });
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [generateRoundTimes, loadEntriesForRound, toast, fetchAndSetLog]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift || !selectedDate) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    setCuringEntries([
      {
        id: Date.now(),
        pressId: "",
        cavity: "",
        operatorId: "",
        sku: "",
        sapCode: "",
        quantity: "",
      },
    ]);
    toast({
      title: "Shift Data Cleared",
      description: `All production entries for ${selectedShift.name} on ${format(selectedDate, "PPP")} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast]);

  const handleSelectedRoundChange = (round: string) => {
    setSelectedRound(round);
    setLocalStorageItem("curingSelectedRound", round);
    loadEntriesForRound(round, productionLog);
  };

  const handleAddCuringEntry = () => {
    setCuringEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        pressId: "",
        cavity: "",
        operatorId: "",
        sku: "",
        sapCode: "",
        quantity: "",
      },
    ]);
  };

  const handleRemoveCuringEntry = (id: number) => {
    setCuringEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleCuringEntryChange = (
    id: number,
    field: keyof CuringEntry,
    value: any,
  ) => {
    setCuringEntries((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          const updated = { ...entry, [field]: value };
          if (field === "sku") {
            const selectedSku = allSkusFromPlan.find((s) => s.sku === value);
            if (selectedSku) {
              updated.sapCode = selectedSku.sapCode;
            }
          }
          return updated;
        }
        return entry;
      }),
    );
  };

  const handleSaveRound = useCallback(async () => {
    if (!selectedRound || !selectedShift) {
      toast({
        variant: "destructive",
        title: "Cannot Save",
        description: "Please select a shift and round time first.",
      });
      return;
    }
    if (!user) {
      toast({
        variant: "destructive",
        title: "Cannot Save",
        description: "User information not available. Please log in again.",
      });
      return;
    }

    const validEntries = curingEntries.filter(
      (e) =>
        e.pressId && e.cavity && e.sku && e.quantity && Number(e.quantity) > 0,
    );

    if (validEntries.length === 0) {
      toast({
        variant: "destructive",
        title: "No valid entries to save.",
      });
      return;
    }

    const entriesByMachine = new Map();
    validEntries.forEach((entry) => {
      if (!entriesByMachine.has(entry.pressId)) {
        entriesByMachine.set(entry.pressId, {
          machineId: entry.pressId,
          name:
            allCuringPresses.find((p) => p.id === entry.pressId)?.name || "",
          operatorId: entry.operatorId,
          skus: [],
          userId: user.id,
          userName: user.name,
        });
      }

      const machineEntry = entriesByMachine.get(entry.pressId);
      const quantity = Number(entry.quantity);
      const skuEntry = {
        sku: entry.sku,
        sapCode: entry.sapCode,
        quantity: quantity,
        leftQty: entry.cavity === "left" ? quantity : 0,
        rightQty: entry.cavity === "right" ? quantity : 0,
      };
      machineEntry.skus.push(skuEntry);
    });

    await actions.saveProductionRound(
      selectedDate,
      selectedShift,
      selectedRound,
      Array.from(entriesByMachine.values()),
    );
    await fetchAndSetLog(selectedDate, selectedShift);

    toast({
      title: "Round Data Saved",
      description: `Data for round ${selectedRound} has been saved.`,
      action: <Save className="text-green-500" />,
    });
  }, [
    selectedDate,
    selectedShift,
    selectedRound,
    curingEntries,
    allCuringPresses,
    toast,
    user,
    fetchAndSetLog,
  ]);

  const handleShiftChange = useCallback(
    async (name: string) => {
      const newShift = allShifts.find((s) => s.name === name);
      if (newShift && newShift?.name !== selectedShift?.name) {
        setProductionLog({});
        setCuringEntries([]);
        setSelectedShift(newShift);

        const newRoundTimes = generateRoundTimes(newShift);
        setRoundTimes(newRoundTimes);

        const log = await fetchAndSetLog(selectedDate, newShift);
        const currentRound = newRoundTimes[0] || "";
        setSelectedRound(currentRound);
        loadEntriesForRound(currentRound, log);
      }
    },
    [
      allShifts,
      selectedShift,
      generateRoundTimes,
      fetchAndSetLog,
      selectedDate,
      loadEntriesForRound,
    ],
  );

  const handleDateChange = useCallback(
    async (date: Date | undefined) => {
      if (date && selectedShift) {
        setSelectedDate(date);
        setProductionLog({});
        setCuringEntries([]);
        const log = await fetchAndSetLog(date, selectedShift);
        loadEntriesForRound(selectedRound, log);
      }
      setIsDatePickerOpen(false);
    },
    [selectedShift, fetchAndSetLog, loadEntriesForRound, selectedRound],
  );

  const roundTotal = useMemo(() => {
    return curingEntries.reduce(
      (acc, entry) => acc + (Number(entry.quantity) || 0),
      0,
    );
  }, [curingEntries]);

  const cumulativeTotal = useMemo(() => {
    return Object.values(productionLog)
      .flatMap((logEntry) => logEntry.entries)
      .flatMap((machineEntry) => machineEntry.skus)
      .reduce((acc, sku) => acc + (sku.quantity || 0), 0);
  }, [productionLog]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  const RoundStatusIndicator = ({
    status,
  }: {
    status?: "synced" | "pending";
  }) => {
    if (status === "synced") {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const SummaryContent = () => (
    <div className="space-y-4 p-4 text-center">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Round Total</p>
        <p className="text-2xl font-bold text-primary">
          {roundTotal.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Shift Total (Saved)
        </p>
        <p className="text-2xl font-bold text-accent-foreground">
          {cumulativeTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="flex-shrink-0 p-2 md:p-4 border-b">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Curing Prod Entry
            </h1>
            <p className="text-sm text-blue-600 font-medium">
              Created by Production Dept Unit 2
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Card>
              <CardContent className="p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Shift Total
                </p>
                <p className="text-lg font-bold text-accent-foreground">
                  {cumulativeTotal.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Round Total
                </p>
                <p className="text-lg font-bold text-primary">
                  {roundTotal.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  size="sm"
                  className={cn(
                    "w-[150px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select
              value={selectedShift?.name || ""}
              onValueChange={handleShiftChange}
            >
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {allShifts.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedRound}
              onValueChange={handleSelectedRoundChange}
            >
              <SelectTrigger className="w-[150px] h-9 font-semibold text-sm">
                <div className="flex items-center gap-2">
                  <RoundStatusIndicator
                    status={productionLog[selectedRound]?.status}
                  />
                  <SelectValue placeholder="Select time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {roundTimes.map((time) => (
                  <SelectItem key={time} value={time}>
                    <div className="flex items-center justify-between w-full">
                      <span>{time}</span>
                      <RoundStatusIndicator
                        status={productionLog[time]?.status}
                      />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Clear Shift Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all production data for the
                    selected shift ({selectedShift?.name} on{" "}
                    {selectedDate ? format(selectedDate, "PPP") : ""}). This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearShiftData}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <span>Green Tyre Stock</span>
            </CardTitle>
            <CardDescription>
              Real-time availability of green tyres for curing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">
                      Available Stock
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {greenTyreStock.map((item) => (
                    <TableRow key={item.sapCode}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell className="text-right font-bold">
                        {item.currentTreadStock.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {isFetchingLog && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Loader />
              <p className="mt-2">Loading shift data...</p>
            </CardContent>
          </Card>
        )}
        {curingEntries.map((entry, index) => (
          <Card key={entry.id}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 min-w-[120px] max-w-[200px]">
                  <div className="space-y-2">
                    <Label>Press No</Label>
                    <Select
                      value={entry.pressId || ""}
                      onValueChange={(val) =>
                        handleCuringEntryChange(entry.id, "pressId", val)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Press" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCuringPresses
                          .filter((p) => p.isAvailable)
                          .map((press) => (
                            <SelectItem key={press.id} value={press.id}>
                              {press.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-1 min-w-[120px] max-w-[180px]">
                  <div className="space-y-2">
                    <Label>Cavity</Label>
                    <Select
                      value={entry.cavity || ""}
                      onValueChange={(val) =>
                        handleCuringEntryChange(entry.id, "cavity", val)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Cavity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            Left Cavity
                          </div>
                        </SelectItem>
                        <SelectItem value="right">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Right Cavity
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-[1.5] min-w-[150px] max-w-[250px]">
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select
                      value={entry.operatorId || ""}
                      onValueChange={(val) =>
                        handleCuringEntryChange(entry.id, "operatorId", val)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOperators.map((op) => (
                          <SelectItem key={op.cardNo} value={op.cardNo}>
                            {op.name} ({op.cardNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-[2] min-w-[200px] max-w-[300px]">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Select
                      value={entry.sku || ""}
                      onValueChange={(val) =>
                        handleCuringEntryChange(entry.id, "sku", val)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSkusFromPlan.map((skuPlan) => (
                          <SelectItem
                            key={`${skuPlan.sku}-${skuPlan.sapCode}`}
                            value={skuPlan.sku}
                          >
                            {skuPlan.sku} ({skuPlan.sapCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-1 min-w-[100px] max-w-[150px]">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={entry.quantity === 0 ? "" : entry.quantity}
                      onChange={(e) =>
                        handleCuringEntryChange(
                          entry.id,
                          "quantity",
                          parseInt(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex gap-2 pt-6">
                    {curingEntries.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCuringEntry(entry.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <Button onClick={handleAddCuringEntry} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Curing Entry
            </Button>
          </CardContent>
        </Card>
      </main>
      <footer className="sticky bottom-0 z-10 flex h-20 items-center justify-end gap-4 border-t bg-background px-4">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <Sigma className="h-4 w-4" />
                <span className="ml-2">Summary</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Summary</SheetTitle>
              </SheetHeader>
              <SummaryContent />
            </SheetContent>
          </Sheet>
          <Button
            onClick={handleSaveRound}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Round
          </Button>
        </div>
      </footer>
    </div>
  );
}
