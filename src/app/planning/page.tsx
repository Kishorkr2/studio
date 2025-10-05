
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Spline, Circle, ToyBrick, Layers, Factory, Scale, ClipboardList, Download, FileText, Calendar as CalendarIcon } from 'lucide-react';
import type {
  ProductionPlanItem,
  TreadStock,
  Machine,
  SkuPlan,
  ReportDataRow,
  ShiftInfo,
} from '@/lib/types';
import * as actions from '../actions';
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
import { Badge } from '@/components/ui/badge';
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

interface EnrichedSkuPlan extends SkuPlan {
  machineId: string;
  machineName: string;
}

interface GTPlanningData extends EnrichedSkuPlan {
  actualProduction: number;
  balance: number;
  todaysPlan: number;
}

function GTPlanning() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [gtPlanningData, setGtPlanningData] = useState<GTPlanningData[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [productionLogs, setProductionLogs] = useState<ReportDataRow[]>([]);
  const [skuFilter, setSkuFilter] = useState('');
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();

  const loadData = useCallback(async () => {
    setLoading(true);
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
      if (shifts.length > 0 && !selectedShift) {
        setSelectedShift(shifts[0]);
      }
    } catch (error) {
      console.error('Failed to load GT planning data', error);
      toast({ variant: 'destructive', title: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedShift]);

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
    return <Skeleton className="h-64 w-full" />;
  }

  return (
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
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full md:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
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
  )
}

function TreadPlanning() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [openingStockData, setOpeningStockData] = useState<TreadStock[]>([]);
  const [totalProductionBySapCode, setTotalProductionBySapCode] = useState<Record<string, number>>({});
  const [tyreProductionData, setTyreProductionData] = useState<Record<string, number>>({});
  
  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plan, machines, stock, dailyLogs, historyLogs] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('TBM'),
        actions.getTreadOpeningStock(),
        actions.getDailyTreadProductionLog(),
        actions.getProductionLogs(),
      ]);

      setProductionPlan(plan);
      setAllMachines(machines);
      setOpeningStockData(stock);

      const dailyTotals: Record<string, number> = {};
      for (const dateKey in dailyLogs) {
        for (const shiftName in dailyLogs[dateKey]) {
          for (const sapCode in dailyLogs[dateKey][shiftName]) {
            dailyTotals[sapCode] = (dailyTotals[sapCode] || 0) + (dailyLogs[dateKey][shiftName][sapCode].quantity || 0);
          }
        }
      }
      setTotalProductionBySapCode(dailyTotals);

      const tyreProd: Record<string, number> = {};
      (historyLogs as any[])
        .filter(log => log.machineName && (log.machineName.startsWith('CP') || log.machineName.startsWith('TBM')))
        .forEach(entry => {
          if (entry.sapCode && entry.quantity > 0) {
            tyreProd[entry.sapCode] = (tyreProd[entry.sapCode] || 0) + (entry.quantity || 0);
          }
        });
      setTyreProductionData(tyreProd);

    } catch (error) {
      console.error('Failed to load data', error);
      toast({ variant: 'destructive', title: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const allSkusFromPlan = useMemo((): EnrichedSkuPlan[] => {
    const machineMap = new Map(allMachines.map(m => [m.id, m.name]));
    const skuMap = new Map<string, EnrichedSkuPlan>();

    productionPlan.forEach(item => {
      item.skus.forEach(skuPlan => {
        if (!skuPlan.sapCode) return;
        
        const key = skuPlan.sapCode;
        const existing = skuMap.get(key);

        const enrichedSku = {
          ...skuPlan,
          machineId: item.machineId,
          machineName: machineMap.get(item.machineId) || item.machineId,
        };

        if (existing) {
          skuMap.set(key, { ...existing, quantity: existing.quantity + skuPlan.quantity });
        } else {
          skuMap.set(key, enrichedSku);
        }
      });
    });
    return Array.from(skuMap.values()).sort((a,b) => a.sku.localeCompare(b.sku));
  }, [productionPlan, allMachines]);


  const treadPlanningData = useMemo(() => {
    return allSkusFromPlan
      .map(req => {
        const openingStockInfo = openingStockData.find(t => t.sapCode === req.sapCode) || { openingStock: 0 };
        const totalProduction = totalProductionBySapCode[req.sapCode] || 0;
        const tyreProduction = tyreProductionData[req.sapCode] || 0;
        
        const gtPlan = req.quantity;
        const withBuffer = Math.ceil(gtPlan * 1.10);
        const currentTreadStock = openingStockInfo.openingStock + totalProduction - tyreProduction;
        const treadBalanceToProduce = Math.max(0, withBuffer - currentTreadStock);

        return {
          ...req,
          gtPlan,
          withBuffer,
          currentTreadStock,
          treadBalanceToProduce,
        };
      })
      .filter(item => 
        (item.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase()) &&
        (item.sapCode?.toLowerCase() || '').includes(sapCodeFilter.toLowerCase())
      );
  }, [allSkusFromPlan, openingStockData, totalProductionBySapCode, tyreProductionData, skuFilter, sapCodeFilter]);

  const summary = useMemo(() => {
    return treadPlanningData.reduce((acc, item) => {
        acc.totalGtPlan += item.gtPlan;
        acc.totalRequired += item.withBuffer;
        acc.totalStock += item.currentTreadStock;
        acc.totalBalance += item.treadBalanceToProduce;
        return acc;
    }, { totalGtPlan: 0, totalRequired: 0, totalStock: 0, totalBalance: 0 });
  }, [treadPlanningData]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total GT Plan</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalGtPlan.toLocaleString()}</div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Required Tread (Plan + 10%)</CardTitle>
              <Spline className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalRequired.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Tread Stock</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalStock.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance to Produce</CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.totalBalance.toLocaleString()}</div>
            </CardContent>
          </Card>
      </div>

       <Card>
          <CardHeader>
            <CardTitle>Tread Production Plan Details</CardTitle>
             <CardDescription>
                Calculates required tread based on GT plan plus a 10% buffer, minus current stock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
                 <Input 
                    placeholder="Filter by SKU..." 
                    value={skuFilter} 
                    onChange={e => setSkuFilter(e.target.value)}
                    className="max-w-xs"
                />
                 <Input 
                    placeholder="Filter by SAP Code..." 
                    value={sapCodeFilter} 
                    onChange={e => setSapCodeFilter(e.target.value)}
                    className="max-w-xs"
                />
            </div>
            <div className="border rounded-lg max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>SAP Code</TableHead>
                    <TableHead className="text-right">GT Plan</TableHead>
                    <TableHead className="text-right">Required Tread (+10%)</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Balance to Produce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treadPlanningData.map((item) => (
                    <TableRow key={item.sapCode}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell>{item.sapCode}</TableCell>
                      <TableCell className="text-right">{item.gtPlan.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{item.withBuffer.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">{item.currentTreadStock.toLocaleString()}</TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        item.treadBalanceToProduce > 0 ? "text-destructive" : "text-green-600"
                      )}>
                        {item.treadBalanceToProduce.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </CardContent>
       </Card>

    </div>
  );
}


const planningSections = [
  {
    value: 'tread',
    title: 'Tread Planning',
    description: 'Plan and manage tread production requirements.',
    icon: Spline,
    content: <TreadPlanning />,
  },
  {
    value: 'gt',
    title: 'GT (Green Tyre) Planning',
    description: 'Coordinate Green Tyre building schedules.',
    icon: ToyBrick,
     content: <GTPlanning />,
  },
  {
    value: 'bead',
    title: 'Bead Planning',
    description: 'Schedule and track bead manufacturing.',
    icon: Circle,
    content: (
      <div className="text-center text-muted-foreground p-8">
        <p>Bead planning features will be implemented here.</p>
      </div>
    ),
  },
  {
    value: 'fabric',
    title: 'Fabric Planning',
    description: 'Manage fabric cutting and allocation.',
    icon: Layers,
     content: (
      <div className="text-center text-muted-foreground p-8">
        <p>Fabric planning features will be implemented here.</p>
      </div>
    ),
  },
];

export default function PlanningPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Production Planning
        </h1>
        <p className="text-muted-foreground">
          A centralized hub for all production planning activities.
        </p>
      </div>

      <Accordion
        type="multiple"
        className="w-full space-y-4"
        defaultValue={['tread', 'gt']}
      >
        {planningSections.map(section => {
          const Icon = section.icon;
          return (
            <AccordionItem
              key={section.value}
              value={section.value}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="hover:no-underline p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-left">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground text-left">
                      {section.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 pt-0">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

    

    