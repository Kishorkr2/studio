
"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppLayoutProps } from "@/components/app-layout";
import { format } from "date-fns";
import {
  CalendarIcon,
  CheckCircle,
  Clipboard,
  Clock,
  Eraser,
  Filter,
  Mail,
  MessageSquare,
  PlusCircle,
  Save,
  Share2,
  Sigma,
  Trash2,
} from "lucide-react";

import * as actions from "./actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  SkuProduction,
} from "@/lib/types";
import { Loader } from "@/components/ui/loader";
import { Card, CardContent } from "@/components/ui/card";

const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
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

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" {...props}>
    <path
      d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.962a.427.427 0 0 0-.073-.215c-.33-1.01-.99-2.512-.99-3.264 0-.426-.24-.426-.51-.426h-1.62a.63.63 0 0 0-.315.1c-.843.43-1.518 1.39-1.518 2.162 0 1.582 1.518 4.816 3.544 6.988 2.026 2.17 4.57 2.648 5.746 2.648.72 0 2.4-1.25 2.4-2.648s-.99-1.69-.99-1.69z"
      fill="#fff"
    ></path>
    <path
      d="M20.213 4.933a10.27 10.27 0 0 0-16.488 11.103L2.645 22.47l6.57-4.085a10.27 10.27 0 0 0 11.002-13.45z"
      fill="#4caf50"
    ></path>
    <path
      d="M19.11,17.205 c-0.372,0 -1.088,1.39 -1.518,1.39 a0.63,0.63 0,0 1,-0.315,-0.1 c-0.802,-0.402 -1.504,-0.817 -2.163,-1.447 c-0.545,-0.516 -1.146,-1.29 -1.46,-1.963 a0.426,0.426 0,0 1,-0.073,-0.215 c0,-0.33 0.99,-0.945 0.99,-1.962 a0.427,0.427 0,0 0,-0.073,-0.215 c-0.33,-1.01 -0.99,-2.512 -0.99,-3.264 c0,-0.426 -0.24,-0.426 -0.51,-0.426 h-1.62 a0.63,0.63 0,0 0,-0.315,0.1 c-0.843,0.43 -1.518,1.39 -1.518,2.162 c0,1.582 1.518,4.816 3.544,6.988 c2.026,2.17 4.57,2.648 5.746,2.648 c0.72,0 2.4,-1.25 2.4,-2.648 s-0.99,-1.69 -0.99,-1.69 z"
      fill="#fff"
    ></path>
  </svg>
);

interface LocalEntry {
  machineId: string;
  machineName: string;
  operatorId: string;
  operatorName: string;
  sku: string;
  sapCode: string;
  quantity: number;
}

export default function DashboardPage({ setPageActions }: AppLayoutProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isFetchingLog, setIsFetchingLog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allOperators, setAllOperators] = useState<Operator[]>([]);
  const [allProductionPlan, setAllProductionPlan] = useState<
    ProductionPlanItem[]
  >([]);
  const [roundTimes, setRoundTimes] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");

  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);

  // States for the new entry form
  const [newEntryMachineId, setNewEntryMachineId] = useState<string>("");
  const [newEntryOperatorId, setNewEntryOperatorId] = useState<string>("");
  const [newEntrySku, setNewEntrySku] = useState<string>("");
  const [newEntryQuantity, setNewEntryQuantity] = useState<number | "">("");

  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);

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

  const loadEntriesForRound = useCallback((log: ProductionLog) => {
    const logForRound = log[selectedRound]?.entries || [];
    const flattenedEntries: LocalEntry[] = [];
    
    logForRound.forEach(machineEntry => {
      machineEntry.skus.forEach(sku => {
        if(sku.quantity > 0) {
          flattenedEntries.push({
            machineId: machineEntry.machineId,
            machineName: machineEntry.name,
            operatorId: machineEntry.operatorId || '',
            operatorName: allOperators.find(op => op.cardNo === machineEntry.operatorId)?.name || '',
            sku: sku.sku,
            sapCode: sku.sapCode,
            quantity: sku.quantity
          });
        }
      });
    });
    setLocalEntries(flattenedEntries);
  }, [selectedRound, allOperators]);

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

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftsData, machinesData, operatorsData, planData] =
        await Promise.all([
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
        
        const log = await fetchAndSetLog(selectedDate, currentShift);

        const savedRound = getLocalStorageItem("selectedRound", "");
        const currentRound = newRoundTimes.includes(savedRound)
          ? savedRound
          : newRoundTimes[0] || "";
        setSelectedRound(currentRound);
        loadEntriesForRound(log);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast({ variant: "destructive", title: "Error loading data" });
    } finally {
      setLoading(false);
    }
  }, [
    toast,
    generateRoundTimes,
    fetchAndSetLog,
    loadEntriesForRound,
    selectedDate,
  ]);

  useEffect(() => {
    loadInitialData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAvailableOperators(allOperators.filter((op) => !op.isAbsent));
  }, [allOperators]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    setLocalEntries([]);
    toast({
      title: "Shift Data Cleared",
      description: `All production entries for ${
        selectedShift.name
      } on ${format(selectedDate, "PPP")} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast]);

  useEffect(() => {
    if (setPageActions) {
      const pageActions = (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Page Actions</DropdownMenuLabel>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Eraser className="mr-2 h-4 w-4" />
                Clear Shift Data
              </DropdownMenuItem>
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
        </>
      );
      setPageActions(pageActions);
    }
    return () => {
      if (setPageActions) {
        setPageActions(null);
      }
    };
  }, [handleClearShiftData, selectedDate, selectedShift, setPageActions]);

  const handleSelectedRoundChange = useCallback(
    async (round: string) => {
      if (round === selectedRound) return;
      
      setSelectedRound(round);
      setLocalStorageItem("selectedRound", round);
      setLocalEntries([]);
      
      if (selectedShift) {
        const log = await fetchAndSetLog(selectedDate, selectedShift);
        const logForRound = log[round]?.entries || [];
        const flattenedEntries: LocalEntry[] = [];
        
        logForRound.forEach(machineEntry => {
          machineEntry.skus.forEach(sku => {
            if (sku.quantity > 0) {
              flattenedEntries.push({
                machineId: machineEntry.machineId,
                machineName: machineEntry.name,
                operatorId: machineEntry.operatorId || '',
                operatorName: allOperators.find(op => op.cardNo === machineEntry.operatorId)?.name || '',
                sku: sku.sku,
                sapCode: sku.sapCode,
                quantity: sku.quantity
              });
            }
          });
        });
        setLocalEntries(flattenedEntries);
      }
    },
    [selectedRound, selectedShift, selectedDate, fetchAndSetLog, allOperators],
  );

  const handleAddNewEntry = () => {
    if (!newEntryMachineId || !newEntryOperatorId || !newEntrySku || !newEntryQuantity) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please fill out all fields to add an entry.",
      });
      return;
    }

    const machine = allMachines.find(m => m.id === newEntryMachineId);
    const operator = allOperators.find(op => op.cardNo === newEntryOperatorId);
    const planItem = allProductionPlan.find(p => p.machineId === newEntryMachineId);
    const skuPlan = planItem?.skus.find(s => s.sku === newEntrySku);

    if (!machine || !operator || !skuPlan) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Could not find matching machine, operator, or SKU.",
      });
      return;
    }

    const newLocalEntry: LocalEntry = {
      machineId: machine.id,
      machineName: machine.name,
      operatorId: operator.cardNo,
      operatorName: operator.name,
      sku: skuPlan.sku,
      sapCode: skuPlan.sapCode,
      quantity: Number(newEntryQuantity),
    };

    setLocalEntries(prev => [...prev, newLocalEntry]);

    // Reset form
    setNewEntryMachineId("");
    setNewEntryOperatorId("");
    setNewEntrySku("");
    setNewEntryQuantity("");
  };

  const handleRemoveLocalEntry = (index: number) => {
    setLocalEntries(prev => prev.filter((_, i) => i !== index));
  };
  

  const handleSaveRound = useCallback(async () => {
    if (!selectedRound || !selectedShift) {
      toast({ variant: "destructive", title: "Cannot Save", description: "Select shift and round." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Cannot Save", description: "User not logged in." });
      return;
    }
    if (localEntries.length === 0) {
      toast({ variant: "destructive", title: "Nothing to Save", description: "Add production data first." });
      return;
    }

    const entriesByMachine = localEntries.reduce<Record<string, MachineProductionData>>((acc, entry) => {
      if (!acc[entry.machineId]) {
        acc[entry.machineId] = {
          machineId: entry.machineId,
          name: entry.machineName,
          operatorId: entry.operatorId,
          skus: [],
          userId: user.id,
          userName: user.name,
        };
      }
      
      acc[entry.machineId].skus.push({
        sku: entry.sku,
        sapCode: entry.sapCode,
        quantity: entry.quantity,
      });

      return acc;
    }, {});
    
    const entriesToSave = Object.values(entriesByMachine);

    try {
      await actions.saveProductionRound(selectedDate, selectedShift, selectedRound, entriesToSave);
      const log = await actions.getProductionLogForShift(selectedDate, selectedShift);
      setProductionLog(log);
      
      toast({
        title: "✅ Data Saved Successfully!",
        description: `${entriesToSave.length} machine summaries saved for ${selectedRound}`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: "destructive", title: "❌ Save Failed", description: "Please try again." });
    }
  }, [selectedDate, selectedShift, selectedRound, localEntries, toast, user]);

  const handleShiftChange = useCallback(
    async (name: string) => {
      const newShift = allShifts.find((s) => s.name === name);
      if (!newShift || newShift.name === selectedShift?.name) return;
      
      setSelectedShift(newShift);
      setProductionLog({});
      setLocalEntries([]);

      const newRoundTimes = generateRoundTimes(newShift);
      setRoundTimes(newRoundTimes);

      const log = await fetchAndSetLog(selectedDate, newShift);
      loadEntriesForRound(log);
    },
    [allShifts, selectedShift, generateRoundTimes, fetchAndSetLog, selectedDate, loadEntriesForRound],
  );

  const handleDateChange = useCallback(
    async (date: Date | undefined) => {
      if (!date || !selectedShift) return;
      
      const newDateStr = format(date, "yyyy-MM-dd");
      const currentDateStr = format(selectedDate, "yyyy-MM-dd");
      
      if (newDateStr !== currentDateStr) {
        setSelectedDate(date);
        setProductionLog({});
        setLocalEntries([]);

        const log = await fetchAndSetLog(date, selectedShift);
        loadEntriesForRound(log);
      }
    },
    [selectedDate, selectedShift, fetchAndSetLog, loadEntriesForRound],
  );

  const roundTotal = useMemo(() => {
    return localEntries.reduce((acc, entry) => acc + (entry.quantity || 0), 0);
  }, [localEntries]);

  const cumulativeTotal = useMemo(() => {
    const total = Object.values(productionLog)
      .flatMap((logEntry) => logEntry.entries)
      .flatMap((machineEntry) => machineEntry.skus)
      .reduce((acc, sku) => acc + (sku.quantity || 0), 0);
    return total;
  }, [productionLog]);

  const generateShareText = useCallback(() => {
    if (!selectedShift || !selectedRound) return "";
    let text = `*Hourly Production Report*\n\n`;
    text += `*Date:* ${format(selectedDate, "PPP")}\n`;
    text += `*Shift:* ${selectedShift.name}\n`;
    text += `*Time:* ${selectedRound}\n\n`;
    text += `*Round Production:* ${roundTotal}\n`;
    text += `*Shift Cumulative:* ${cumulativeTotal}\n\n`;
    const producedEntries = localEntries.filter((entry) => entry.quantity > 0);

    if (producedEntries.length > 0) {
      text += `*TBM wise production:*\n`;
      const entriesByTBM = producedEntries.reduce<Record<string, LocalEntry[]>>((acc, entry) => {
        if (!acc[entry.machineName]) {
          acc[entry.machineName] = [];
        }
        acc[entry.machineName].push(entry);
        return acc;
      }, {});

      Object.entries(entriesByTBM).forEach(([machineName, entries]) => {
        const operatorName = entries[0]?.operatorName || 'N/A';
        const skuTexts = entries.map(e => `${e.sku}: ${e.quantity}`).join(", ");
        if (skuTexts) {
          text += `- *${machineName}* (${operatorName}): ${skuTexts}\n`;
        }
      });
    } else {
      text += `*No production was recorded for this round.*\n`;
    }
    return text;
  }, [localEntries, cumulativeTotal, roundTotal, selectedDate, selectedRound, selectedShift]);

  const handleShare = useCallback(
    async (type: "native" | "whatsapp" | "sms" | "email" | "copy") => {
      const shareText = generateShareText();
      if (!shareText) {
        toast({ variant: "destructive", title: "Cannot Share", description: "Please select a date, shift, and round." });
        return;
      }
      const encodedText = encodeURIComponent(shareText);
      if (type === "native" && navigator.share) {
        try {
          await navigator.share({ title: "Hourly Production Report", text: shareText });
        } catch (error) {
          console.log("Share was cancelled or failed", error);
        }
      } else if (type === "whatsapp") {
        window.open(`https://wa.me/?text=${encodedText}`, "_blank");
      } else if (type === "sms") {
        window.open(`sms:?body=${encodedText}`, "_blank");
      } else if (type === "email") {
        window.open(`mailto:?subject=Hourly Production Report&body=${encodedText}`, "_blank");
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          toast({ title: "Report Copied!", description: "Copied to clipboard." });
        } catch {
          toast({ variant: "destructive", title: "Share Failed", description: "Could not copy the report." });
        }
      }
    },
    [generateShareText, toast],
  );

  const availableSkusForMachine = useMemo(() => {
    if (!newEntryMachineId) return [];
    const planItem = allProductionPlan.find(p => p.machineId === newEntryMachineId);
    return planItem?.skus || [];
  }, [newEntryMachineId, allProductionPlan]);


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
      return <CheckCircle className="h-4 w-4 text-green-500" title="Synced" />;
    }
    return (
      <Clock className="h-4 w-4 text-muted-foreground" title="Not Synced" />
    );
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
        <p className="text-2xl font-bold text-accent">
          {cumulativeTotal.toLocaleString()}
        </p>
      </div>
    </div>
  );

  const ShareMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
        >
          <Share2 className="h-5 w-5" />
          <span className="ml-2">Share</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Share Report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleShare("native")}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>General Share</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare("whatsapp")}>
          <WhatsAppIcon className="mr-2 h-4 w-4" />
          <span>WhatsApp</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare("sms")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>SMS / Message</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleShare("email")}>
          <Mail className="mr-2 h-4 w-4" />
          <span>Email</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleShare("copy")}>
          <Clipboard className="mr-2 h-4 w-4" />
          <span>Copy to Clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="flex-shrink-0 p-2 md:p-4 border-b">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <h1 className="text-lg font-bold tracking-tight">GT Prod Entry</h1>
          <div className="flex items-center gap-2">
            <Popover>
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
              <SelectTrigger className="w-[150px]" size="sm">
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
              <SelectTrigger
                className="w-[150px] font-semibold text-sm"
                size="sm"
              >
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
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2 md:col-span-1">
                <label>TBM No</label>
                <Select value={newEntryMachineId} onValueChange={setNewEntryMachineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select TBM" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMachines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <label>Operator</label>
                <Select value={newEntryOperatorId} onValueChange={setNewEntryOperatorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOperators.map(op => <SelectItem key={op.cardNo} value={op.cardNo}>{op.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <label>SKU</label>
                <Select value={newEntrySku} onValueChange={setNewEntrySku} disabled={!newEntryMachineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSkusForMachine.map(s => <SelectItem key={s.sku} value={s.sku}>{s.sku}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-1">
                <label>Quantity</label>
                <Input type="number" placeholder="0" value={newEntryQuantity} onChange={e => setNewEntryQuantity(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <Button onClick={handleAddNewEntry} className="w-full md:w-auto">
                <PlusCircle />
                <span>Add</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {isFetchingLog ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Loader />
              <p className="mt-2">Loading shift data...</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[calc(100vh-350px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TBM No</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localEntries.length > 0 ? localEntries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.machineName}</TableCell>
                        <TableCell>{entry.operatorName}</TableCell>
                        <TableCell>{entry.sku}</TableCell>
                        <TableCell>{entry.quantity}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveLocalEntry(index)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No production data added for this round yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <footer className="sticky bottom-0 z-10 flex h-20 items-center justify-between gap-4 border-t bg-background px-4">
        <div className="hidden lg:block">
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center gap-6 p-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Round Total
                  </p>
                  <p className="text-lg font-bold text-primary">
                    {roundTotal.toLocaleString()}
                  </p>
                </div>
                <div className="border-l h-10"></div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Shift Total (Saved)
                  </p>
                  <p className="text-lg font-bold text-accent">
                    {cumulativeTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-2">
          <ShareMenu />
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
