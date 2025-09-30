
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuCheckboxItem,
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
} from "@/lib/types";
import { Loader } from "@/components/ui/loader";

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
  const [entries, setEntries] = useState<MachineProductionData[]>([]);
  const [productionLog, setProductionLog] = useState<ProductionLog>({});
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([]);
  const machineOperatorMapRef = useRef<Record<string, string>>({});

  const [columnVisibility, setColumnVisibility] = useState(() =>
    getLocalStorageItem("columnVisibility", {
      operator: true,
      sku: true,
    }),
  );

  useEffect(() => {
    setLocalStorageItem("columnVisibility", columnVisibility);
  }, [columnVisibility]);

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
      // Day shift
      for (let h = 9; h <= 18; h++)
        times.push(`${String(h).padStart(2, "0")}:00`);
      times.push("19:00");
    }

    return times.map((t) => {
      const [h] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      let displayHour = h % 12;
      if (displayHour === 0) displayHour = 12; // Handle midnight and noon
      return `${String(displayHour).padStart(2, "0")}:00 ${ampm}`;
    });
  }, []);

  const loadEntriesForRound = useCallback(
    (round: string, log: ProductionLog) => {
      const logForRound = log[round]?.entries || [];
      const availableMachines = allMachines.filter(
        (machine) => machine.isAvailable,
      );

      const newEntries = availableMachines.map((machine) => {
        const loggedEntry = logForRound.find((e) => e.machineId === machine.id);
        const skus = loggedEntry?.skus || [];
        const operatorId = loggedEntry?.operatorId || machineOperatorMapRef.current[machine.id] || "";

        // Update operator map with saved data
        if (loggedEntry?.operatorId) {
          machineOperatorMapRef.current[machine.id] = loggedEntry.operatorId;
        }

        return {
          machineId: machine.id,
          name: machine.name,
          operatorId: operatorId,
          skus: skus.length > 0 ? skus : [{ sku: "", sapCode: "", quantity: 0 }],
        };
      });

      setEntries(newEntries);
      setLocalStorageItem("machineOperatorMap", machineOperatorMapRef.current);
    },
    [allMachines],
  );

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

        machineOperatorMapRef.current = getLocalStorageItem(
          "machineOperatorMap",
          {},
        );
        loadEntriesForRound(currentRound, log);
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
  }, []);

  useEffect(() => {
    setAvailableOperators(allOperators.filter((op) => !op.isAbsent));
  }, [allOperators]);

  const handleClearShiftData = useCallback(async () => {
    if (!selectedShift) return;
    await actions.clearShiftData(selectedDate, selectedShift);
    setProductionLog({});
    loadEntriesForRound(selectedRound, {});
    machineOperatorMapRef.current = {};
    setLocalStorageItem("machineOperatorMap", {});
    toast({
      title: "Shift Data Cleared",
      description: `All production entries for ${
        selectedShift.name
      } on ${format(selectedDate, "PPP")} have been removed.`,
    });
  }, [selectedDate, selectedShift, toast, selectedRound, loadEntriesForRound]);

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
  }, [
    handleClearShiftData,
    selectedDate,
    selectedShift,
    setPageActions,
  ]);

  const handleSelectedRoundChange = useCallback(
    async (round: string) => {
      if (round === selectedRound) return;
      
      setSelectedRound(round);
      setLocalStorageItem("selectedRound", round);

      if (selectedShift) {
        if (Object.keys(productionLog).length > 0 && productionLog[round]) {
          loadEntriesForRound(round, productionLog);
        } else {
          const log = await fetchAndSetLog(selectedDate, selectedShift);
          loadEntriesForRound(round, log);
        }
      }
    },
    [selectedRound, selectedShift, selectedDate, fetchAndSetLog, loadEntriesForRound, productionLog],
  );

  const handleOperatorChange = (machineId: string, operatorId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.machineId === machineId ? { ...entry, operatorId } : entry,
      ),
    );
    machineOperatorMapRef.current[machineId] = operatorId;
    setLocalStorageItem("machineOperatorMap", machineOperatorMapRef.current);
  };

  const handleSkuChange = (
    machineId: string,
    skuIndex: number,
    newSku: string,
  ) => {
    const planItem = allProductionPlan.find((p) => p.machineId === machineId);
    const newSkuPlan = planItem?.skus.find((s) => s.sku === newSku);
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.machineId === machineId) {
          const updatedSkus = [...entry.skus];
          updatedSkus[skuIndex] = {
            ...updatedSkus[skuIndex],
            sku: newSku,
            sapCode: newSkuPlan?.sapCode || "",
          };
          return { ...entry, skus: updatedSkus };
        }
        return entry;
      }),
    );
  };

  const handleQuantityChange = (
    machineId: string,
    skuIndex: number,
    quantity: number,
  ) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.machineId === machineId) {
          const updatedSkus = [...entry.skus];
          updatedSkus[skuIndex] = {
            ...updatedSkus[skuIndex],
            quantity: isNaN(quantity) ? 0 : quantity,
          };
          return { ...entry, skus: updatedSkus };
        }
        return entry;
      }),
    );
  };

  const handleAddSku = (machineId: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.machineId === machineId) {
          return {
            ...entry,
            skus: [...entry.skus, { sku: "", sapCode: "", quantity: 0 }],
          };
        }
        return entry;
      }),
    );
  };

  const handleRemoveSku = (machineId: string, skuIndex: number) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.machineId === machineId) {
          const updatedSkus = entry.skus.filter(
            (_, index) => index !== skuIndex,
          );
          return { ...entry, skus: updatedSkus };
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
    
    const entriesToSave = entries
      .filter(entry => {
        const hasOperator = entry.operatorId && entry.operatorId.trim() !== '';
        const hasProduction = entry.skus.some(sku => (sku.quantity || 0) > 0);
        const hasSkuData = entry.skus.some(sku => sku.sku && sku.sku.trim() !== '');
        return hasOperator && (hasProduction || hasSkuData);
      })
      .map(entry => ({
        machineId: entry.machineId,
        name: entry.name,
        operatorId: entry.operatorId,
        skus: entry.skus.filter(sku => (sku.sku && sku.sku.trim() !== '') || (sku.quantity || 0) > 0),
        userId: user.id,
        userName: user.name,
      }));
    
    if (entriesToSave.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to Save",
        description: "Please assign operators and enter production data first.",
      });
      return;
    }
    
    try {
      await actions.saveProductionRound(
        selectedDate,
        selectedShift,
        selectedRound,
        entriesToSave,
      );
      
      const log = await actions.getProductionLogForShift(
        selectedDate,
        selectedShift,
      );
      setProductionLog(log);
      
      toast({
        title: "✅ Data Saved Successfully!",
        description: `${entriesToSave.length} entries saved for ${selectedRound}`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: "destructive",
        title: "❌ Save Failed",
        description: "Failed to save production data. Please try again.",
      });
    }
  }, [selectedDate, selectedShift, selectedRound, entries, toast, user]);

  const handleShiftChange = useCallback(
    async (name: string) => {
      const newShift = allShifts.find((s) => s.name === name);
      if (!newShift || newShift.name === selectedShift?.name) return;
      
      setSelectedShift(newShift);
      setProductionLog({});
      setEntries([]);

      const newRoundTimes = generateRoundTimes(newShift);
      setRoundTimes(newRoundTimes);

      const log = await fetchAndSetLog(selectedDate, newShift);
      const currentRound = newRoundTimes[0] || "";
      setSelectedRound(currentRound);
      loadEntriesForRound(currentRound, log);
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
        setEntries([]);

        const log = await fetchAndSetLog(date, selectedShift);
        loadEntriesForRound(selectedRound, log);
      }
    },
    [selectedDate, selectedShift, fetchAndSetLog, loadEntriesForRound, selectedRound],
  );

  const roundTotal = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const entryTotal = entry.skus.reduce(
        (skuAcc, sku) => skuAcc + (sku.quantity || 0),
        0,
      );
      return acc + entryTotal;
    }, 0);
  }, [entries]);

  const cumulativeTotal = useMemo(() => {
    const total = Object.values(productionLog)
      .flatMap((logEntry) => logEntry.entries)
      .flatMap((machineEntry) => machineEntry.skus)
      .reduce((acc, sku) => acc + (sku.quantity || 0), 0);
    return total;
  }, [productionLog]);

  const generateShareText = useCallback(() => {
    if (!selectedShift || !selectedRound) return "";
    const operatorMap = new Map(allOperators.map((op) => [op.cardNo, op.name]));
    let text = `*Hourly Production Report*\n\n`;
    text += `*Date:* ${format(selectedDate, "PPP")}\n`;
    text += `*Shift:* ${selectedShift.name}\n`;
    text += `*Time:* ${selectedRound}\n\n`;
    text += `*Round Production:* ${roundTotal}\n`;
    text += `*Shift Cumulative:* ${cumulativeTotal}\n\n`;
    const producedEntries = entries.filter((entry) =>
      entry.skus.some((sku) => sku.quantity > 0),
    );
    if (producedEntries.length > 0) {
      text += `*TBM wise production:*\n`;
      producedEntries.forEach((entry) => {
        const operatorName = operatorMap.get(entry.operatorId || "") || "N/A";
        const skuTexts = entry.skus
          .filter((s) => s.quantity > 0)
          .map((s) => `${s.sku}: ${s.quantity}`)
          .join(", ");
        if (skuTexts) {
          text += `- *${entry.name}* (${operatorName}): ${skuTexts}\n`;
        }
      });
    } else {
      text += `*No production was recorded for this round.*\n`;
    }
    return text;
  }, [
    allOperators,
    cumulativeTotal,
    entries,
    roundTotal,
    selectedDate,
    selectedRound,
    selectedShift,
  ]);

  const handleShare = useCallback(
    async (type: "native" | "whatsapp" | "sms" | "email" | "copy") => {
      const shareText = generateShareText();
      if (!shareText) {
        toast({
          variant: "destructive",
          title: "Cannot Share",
          description: "Please select a date, shift, and round.",
        });
        return;
      }
      const encodedText = encodeURIComponent(shareText);
      if (type === "native" && navigator.share) {
        try {
          await navigator.share({
            title: "Hourly Production Report",
            text: shareText,
          });
        } catch (error) {
          console.log("Share was cancelled or failed", error);
        }
      } else if (type === "whatsapp") {
        window.open(`https://wa.me/?text=${encodedText}`, "_blank");
      } else if (type === "sms") {
        window.open(`sms:?body=${encodedText}`, "_blank");
      } else if (type === "email") {
        window.open(
          `mailto:?subject=Hourly Production Report&body=${encodedText}`,
          "_blank",
        );
      } else {
        try {
          await navigator.clipboard.writeText(shareText);
          toast({
            title: "Report Copied!",
            description:
              "The production report has been copied to your clipboard.",
          });
        } catch (copyError) {
          // Fallback for clipboard API issues
          const textArea = document.createElement('textarea');
          textArea.value = shareText;
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            toast({
              title: "Report Copied!",
              description: "The production report has been copied to your clipboard.",
            });
          } catch (fallbackError) {
            toast({
              variant: "destructive",
              title: "Share Failed",
              description: "Could not copy the report.",
            });
          }
          document.body.removeChild(textArea);
        }
      }
    },
    [generateShareText, toast],
  );

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

  const ShareMenu = ({ isMobile = false }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isMobile ? "ghost" : "outline"}
          size={isMobile ? "icon" : "sm"}
          className={isMobile ? "h-auto p-2" : ""}
        >
          <Share2 className="h-5 w-5" />
          {isMobile ? (
            <span className="sr-only">Share</span>
          ) : (
            <span className="ml-2">Share</span>
          )}
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
      <main className="flex-1 overflow-y-auto p-4">
        {isFetchingLog && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Loader />
              <p className="mt-2">Loading shift data...</p>
            </CardContent>
          </Card>
        )}
        {!isFetchingLog && entries.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <p>No machines available for data entry.</p>
              <p className="text-sm">
                Total machines loaded: {allMachines.length}, Available:{" "}
                {allMachines.filter((m) => m.isAvailable).length}
              </p>
              <p className="text-sm">
                Please check machine availability in the Admin panel.
              </p>
            </CardContent>
          </Card>
        )}
        {!isFetchingLog && entries.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">TBM No</TableHead>
                    <TableHead className="w-[200px]">Operator</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="w-[120px]">Quantity</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                      const planItem = allProductionPlan.find(
                        (p) => p.machineId === entry.machineId,
                      );
                      const machineSkus = planItem?.skus || [];
                      return (
                        <React.Fragment key={entry.machineId}>
                          {entry.skus.map((skuEntry, skuIndex) => (
                            <TableRow key={`${entry.machineId}-${skuIndex}`}>
                              {skuIndex === 0 && (
                                <TableCell rowSpan={entry.skus.length} className="font-bold align-top pt-6">
                                  {entry.name}
                                </TableCell>
                              )}
                              {skuIndex === 0 && (
                                <TableCell rowSpan={entry.skus.length} className="align-top pt-4">
                                  <Select
                                    value={entry.operatorId || ""}
                                    onValueChange={(val) => handleOperatorChange(entry.machineId, val)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select Operator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableOperators.map((op) => (
                                        <SelectItem key={op.cardNo} value={op.cardNo}>
                                          {op.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              )}
                              <TableCell>
                                <Select
                                  value={skuEntry.sku}
                                  onValueChange={(val) => handleSkuChange(entry.machineId, skuIndex, val)}
                                  disabled={machineSkus.length === 0}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={machineSkus.length > 0 ? "Select SKU" : "No SKUs"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {machineSkus.map((skuPlan) => (
                                      <SelectItem key={`${skuPlan.sku}-${skuPlan.sapCode}`} value={skuPlan.sku}>
                                        {skuPlan.sku}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={skuEntry.quantity === 0 ? "" : skuEntry.quantity}
                                  onChange={(e) => handleQuantityChange(entry.machineId, skuIndex, parseInt(e.target.value) || 0)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveSku(entry.machineId, skuIndex)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  {skuIndex === entry.skus.length - 1 && (
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleAddSku(entry.machineId)}
                                      >
                                        <PlusCircle className="h-4 w-4" />
                                      </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      )
                  })}
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
