
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Spline, Circle, ToyBrick, Layers, Factory, Scale, ClipboardList } from 'lucide-react';
import type {
  ProductionPlanItem,
  TreadStock,
  Machine,
  SkuPlan,
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

interface EnrichedSkuPlan extends SkuPlan {
  machineId: string;
  machineName: string;
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
    value: 'gt',
    title: 'GT (Green Tyre) Planning',
    description: 'Coordinate Green Tyre building schedules.',
    icon: ToyBrick,
     content: (
      <div className="text-center text-muted-foreground p-8">
        <p>GT planning features will be implemented here.</p>
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
        defaultValue={['tread']}
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

    