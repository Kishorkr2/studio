
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ProductionPlanItem,
  TreadStock,
  Machine,
  SkuPlan,
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
import { Spline, ClipboardList, Factory, Scale, FileDown, Circle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface EnrichedSkuPlan extends SkuPlan {
  machineId: string;
  machineName: string;
}

export default function StockReportPage() {
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
        
        const currentTreadStock = openingStockInfo.openingStock + totalProduction - tyreProduction;

        return {
          ...req,
          openingStock: openingStockInfo.openingStock,
          production: totalProduction,
          consumption: tyreProduction,
          currentTreadStock,
        };
      })
      .filter(item => 
        (item.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase()) &&
        (item.sapCode?.toLowerCase() || '').includes(sapCodeFilter.toLowerCase())
      );
  }, [allSkusFromPlan, openingStockData, totalProductionBySapCode, tyreProductionData, skuFilter, sapCodeFilter]);

  const summary = useMemo(() => {
    return treadPlanningData.reduce((acc, item) => {
        acc.totalOpeningStock += item.openingStock;
        acc.totalProduction += item.production;
        acc.totalConsumption += item.consumption;
        acc.totalCurrentStock += item.currentTreadStock;
        return acc;
    }, { totalOpeningStock: 0, totalProduction: 0, totalConsumption: 0, totalCurrentStock: 0 });
  }, [treadPlanningData]);

  const handleExportExcel = () => {
    if (treadPlanningData.length === 0) {
        toast({ variant: 'destructive', title: "No data to export" });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
        treadPlanningData.map(item => ({
            'SKU': item.sku,
            'SAP Code': item.sapCode,
            'Opening Stock': item.openingStock,
            'Total Production': item.production,
            'Total Consumption': item.consumption,
            'Current Stock': item.currentTreadStock,
        }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tread Stock Report');
    XLSX.writeFile(workbook, 'Tread_Stock_Report.xlsx');
  };

  if (loading) {
     return (
        <div className="space-y-6 p-4 md:p-8">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
        <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
                Component Stock Report
            </h1>
            <p className="text-muted-foreground">
                View current stock levels for Tread, Bead, and Ply.
            </p>
        </div>

        <Tabs defaultValue="tread" className="w-full">
            <TabsList>
                <TabsTrigger value="tread">
                    <Spline className="mr-2 h-4 w-4" /> Tread Stock
                </TabsTrigger>
                <TabsTrigger value="bead" disabled>
                    <Circle className="mr-2 h-4 w-4" /> Bead Stock
                </TabsTrigger>
                <TabsTrigger value="ply" disabled>
                    <Layers className="mr-2 h-4 w-4" /> Ply Stock
                </TabsTrigger>
            </TabsList>
            <TabsContent value="tread" className="mt-4">
                <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <CardTitle>Tread Stock Report</CardTitle>
                            <CardDescription>
                                Current SKU-wise stock of tread available.
                            </CardDescription>
                        </div>
                        <Button onClick={handleExportExcel}>
                            <FileDown className="mr-2 h-4 w-4" /> Export to Excel
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-4 mb-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Opening Stock</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-2xl font-bold">{summary.totalOpeningStock.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Production</CardTitle>
                            <Factory className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-2xl font-bold">{summary.totalProduction.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-2xl font-bold">{summary.totalConsumption.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Current Stock</CardTitle>
                            <Spline className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-2xl font-bold text-primary">{summary.totalCurrentStock.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                    </div>

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
                            <TableHead className="text-right">Opening Stock</TableHead>
                            <TableHead className="text-right">Production</TableHead>
                            <TableHead className="text-right">Consumption</TableHead>
                            <TableHead className="text-right">Current Stock</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {treadPlanningData.map((item) => (
                            <TableRow key={item.sapCode}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell>{item.sapCode}</TableCell>
                            <TableCell className="text-right">{item.openingStock.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{item.production.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{item.consumption.toLocaleString()}</TableCell>
                            <TableCell className={cn(
                                "text-right font-bold",
                                item.currentTreadStock < 0 ? "text-destructive" : "text-green-600"
                            )}>
                                {item.currentTreadStock.toLocaleString()}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="bead">
                <Card>
                    <CardHeader>
                        <CardTitle>Bead Stock Report</CardTitle>
                        <CardDescription>This feature is coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                         <Circle className="w-12 h-12 mb-4" />
                        <p>Bead stock tracking and reporting will be implemented here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="ply">
                <Card>
                    <CardHeader>
                        <CardTitle>Ply Stock Report</CardTitle>
                        <CardDescription>This feature is coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                        <Layers className="w-12 h-12 mb-4" />
                        <p>Ply stock tracking and reporting will be implemented here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
