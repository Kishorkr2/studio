
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Spline, Circle, ToyBrick, Layers, Factory, Scale, ClipboardList, Download, FileText, Calendar as CalendarIcon } from 'lucide-react';
import type {
  ProductionPlanItem,
  Machine,
  SkuPlan,
  ReportDataRow,
  ShiftInfo,
} from '@/lib/types';
import * as actions from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface GTPlanningData extends SkuPlan {
    machineId: string;
    machineName: string;
    actualProduction: number;
    balance: number;
    todaysPlan: number;
}

export default function GTPlanningPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gtPlanningData, setGtPlanningData] = useState<GTPlanningData[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [productionLogs, setProductionLogs] = useState<ReportDataRow[]>([]);
  const [skuFilter, setSkuFilter] = useState('');
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();

  const loadData = useCallback(async () => {
    try {
      const [plan, machines, logs, shifts] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('TBM'),
        actions.getProductionLogs(),
        actions.getShifts(),
      ]);
      setProductionPlan(plan);
      setAllMachines(machines);
      setProductionLogs(logs as ReportDataRow[]);
      setAllShifts(shifts);
      if (shifts.length > 0) {
        setSelectedShift(shifts[0]);
      }
    } catch (error) {
      console.error('Failed to load GT planning data', error);
      toast({ variant: 'destructive', title: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  useEffect(() => {
      const machineMap = new Map(allMachines.map(m => [m.id, m.name]));
      
      const productionBySapCode = productionLogs.reduce((acc, log) => {
        if (log.sapCode) {
          acc[log.sapCode] = (acc[log.sapCode] || 0) + log.quantity;
        }
        return acc;
      }, {} as Record<string, number>);

      const planningData = productionPlan.flatMap(item => 
        item.skus.map(skuPlan => {
            const actualProduction = productionBySapCode[skuPlan.sapCode] || 0;
            const marketRequirement = skuPlan.quantity || 0;
            
            return {
              ...skuPlan,
              machineId: item.machineId,
              machineName: machineMap.get(item.machineId) || item.machineId,
              actualProduction: actualProduction,
              balance: marketRequirement - actualProduction,
              todaysPlan: 0,
            }
        })
      );
      setGtPlanningData(planningData);

  }, [productionPlan, allMachines, productionLogs]);
  
  const handleTodaysPlanChange = (sapCode: string, value: string) => {
    const newPlan = parseInt(value, 10) || 0;
    setGtPlanningData(currentData =>
      currentData.map(item =>
        item.sapCode === sapCode ? { ...item, todaysPlan: newPlan } : item
      )
    );
  };
  
  const filteredData = useMemo(() => {
    return gtPlanningData.filter(item => 
      (item.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [gtPlanningData, skuFilter]);

  const exportableData = useMemo(() => {
    return filteredData.filter(item => item.todaysPlan > 0);
  }, [filteredData]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsDatePickerOpen(false);
    }
  };

  const handleExportPdf = () => {
    if (exportableData.length === 0) {
        toast({ variant: 'destructive', title: "No data to export", description: "Please enter values in 'Today's Plan'." });
        return;
    }
    
    const doc = new jsPDF() as jsPDFWithAutoTable;

    doc.setFontSize(16);
    doc.text("RALSON RUBBER PVT LTD", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("Green Tyre Planning", doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

    doc.autoTable({
        startY: 40,
        head: [['TBM NO', 'SKU', "Today's Plan"]],
        body: exportableData.map(item => [item.machineName, item.sku, item.todaysPlan.toLocaleString()]),
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
    });

    doc.save(`GT_Planning_${format(selectedDate, 'yyyy-MM-dd')}_${selectedShift?.name}.pdf`);
  };

  const handleExportExcel = () => {
    if (exportableData.length === 0) {
        toast({ variant: 'destructive', title: "No data to export", description: "Please enter values in 'Today's Plan'." });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
        exportableData.map(item => ({
            'TBM NO': item.machineName,
            'SKU': item.sku,
            "Today's Plan": item.todaysPlan,
        }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'GT Planning');
    XLSX.writeFile(workbook, `GT_Planning_${format(selectedDate, 'yyyy-MM-dd')}_${selectedShift?.name}.xlsx`);
  };

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
            Green Tyre Planning
            </h1>
            <p className="text-muted-foreground">
            A centralized hub for all production planning activities.
            </p>
        </div>
        <Card>
        <CardHeader>
            <CardTitle>Green Tyre (GT) Daily Planning</CardTitle>
            <CardDescription>
            Plan daily GT production based on market requirements and actual output.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 p-4 border rounded-lg">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Date</label>
                        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full md:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Shift</label>
                        <Select value={selectedShift?.name} onValueChange={(name) => setSelectedShift(allShifts.find(s => s.name === name))}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="Select shift" />
                            </SelectTrigger>
                            <SelectContent>
                                {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExportPdf} variant="outline"><FileText className="mr-2 h-4 w-4" /> Export PDF</Button>
                    <Button onClick={handleExportExcel}><Download className="mr-2 h-4 w-4" /> Export Excel</Button>
                </div>
            </div>
            <div className="flex gap-4 mb-4">
                <Input 
                    placeholder="Filter by SKU..." 
                    value={skuFilter} 
                    onChange={e => setSkuFilter(e.target.value)}
                    className="max-w-xs"
                />
            </div>
            <div className="border rounded-lg max-h-[60vh] overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                    <TableHead>TBM No</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Market Requirement</TableHead>
                    <TableHead className="text-right">Actual Production</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right w-[150px]">Today's Plan</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredData.map(item => (
                    <TableRow key={`${item.machineId}-${item.sapCode}`}>
                    <TableCell>{item.machineName}</TableCell>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.actualProduction.toLocaleString()}</TableCell>
                    <TableCell className={cn("text-right font-bold", item.balance < 0 ? "text-green-600" : "text-destructive")}>
                        {item.balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                        <Input
                        type="number"
                        placeholder="0"
                        className="w-24 ml-auto text-right"
                        value={item.todaysPlan || ''}
                        onChange={(e) => handleTodaysPlanChange(item.sapCode, e.target.value)}
                        />
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </div>
        </CardContent>
        </Card>
    </div>
  )
}
