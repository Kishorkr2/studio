
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MarketRequirement, ProductionLog, TreadStock, ShiftInfo } from '@/lib/types';
import { Save, SlidersHorizontal, ClipboardList, Factory, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shifts as initialShifts } from '@/lib/data';

const TREAD_OPENING_STOCK_KEY = 'tyretrack-tread-opening-stock';
const TREAD_DAILY_PRODUCTION_KEY = 'tyretrack-tread-daily-production';

interface DailyProductionEntry {
  quantity: number;
  trolleyNo: string;
}

export default function TreadExtrusionPage() {
  const { toast } = useToast();
  
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  const [openingStockData, setOpeningStockData] = useState<TreadStock[]>([]);
  const [tyreProductionData, setTyreProductionData] = useState<Record<string, number>>({});
  const [dailyProductionLog, setDailyProductionLog] = useState<Record<string, Record<string, Record<string, DailyProductionEntry> | DailyProductionEntry | number>>>(
    {}
  );
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);

  const [columnVisibility, setColumnVisibility] = useState({
    sapCode: true,
    demand: true,
    openingStock: true,
    production: true,
    tyreProduction: true,
    currentTreadStock: true,
    treadBalanceToProduce: true,
  });

  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
    // Load shifts
    const loadedShifts: ShiftInfo[] = JSON.parse(localStorage.getItem('tyretrack-shifts') || 'null') || initialShifts;
    setAllShifts(loadedShifts);

    // Load market requirements
    const loadedMarketReqs = JSON.parse(localStorage.getItem('tyretrack-market-requirements') || '[]') as MarketRequirement[];
    setMarketRequirements(loadedMarketReqs);
    
    // Load saved opening stock data
    const savedOpeningStock = JSON.parse(localStorage.getItem(TREAD_OPENING_STOCK_KEY) || '[]') as TreadStock[];
    
    const initialOpeningStock = loadedMarketReqs.map(req => {
        const existing = savedOpeningStock.find(t => t.sku === req.sku);
        return existing || { sku: req.sku, openingStock: 0, production: 0 }; // production is unused here
    });
    setOpeningStockData(initialOpeningStock);

    // Load daily production log for total calculation
    const savedDailyProduction = JSON.parse(localStorage.getItem(TREAD_DAILY_PRODUCTION_KEY) || '{}');
    setDailyProductionLog(savedDailyProduction);

    // Calculate tyre production from all production logs
    const tyreProduction: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('production-log-')) {
            const logData: ProductionLog = JSON.parse(localStorage.getItem(key) || '{}');
            Object.values(logData).forEach(logEntry => {
              if (logEntry.entries) {
                logEntry.entries.forEach(entry => {
                    if (entry.sku && entry.quantity > 0) {
                        tyreProduction[entry.sku] = (tyreProduction[entry.sku] || 0) + entry.quantity;
                    }
                });
              }
            });
        }
    }
    setTyreProductionData(tyreProduction);
  }, []);
  
  const handleOpeningStockChange = (sku: string, value: string) => {
    const numericValue = parseInt(value, 10) || 0;
    setOpeningStockData(currentData =>
      currentData.map(item =>
        item.sku === sku ? { ...item, openingStock: numericValue } : item
      )
    );
  };
  
  const handleSaveOpeningStock = () => {
    localStorage.setItem(TREAD_OPENING_STOCK_KEY, JSON.stringify(openingStockData));
    toast({
      title: 'Success!',
      description: 'Opening stock data has been saved.',
      action: <Save className="text-green-500" />,
    });
  };

  const totalProductionBySku = useMemo(() => {
    const totals: Record<string, number> = {};
    if (allShifts.length === 0) return totals;

    for (const dateKey in dailyProductionLog) {
        const dateData = dailyProductionLog[dateKey];
        if (!dateData || typeof dateData !== 'object') continue;

        const firstKey = Object.keys(dateData)[0];
        if (!firstKey) continue;
        
        const isNewFormat = allShifts.some(shift => shift.name === firstKey);

        if (isNewFormat) {
            // Handle new format: { [dateKey]: { [shiftName]: { [sku]: entry } } }
            for (const shiftName in dateData) {
                const shiftEntries = dateData[shiftName] as Record<string, DailyProductionEntry | number>;
                if (shiftEntries && typeof shiftEntries === 'object') {
                    for (const sku in shiftEntries) {
                        const entry = shiftEntries[sku];
                        const quantity = typeof entry === 'number' ? entry : (entry?.quantity || 0);
                        totals[sku] = (totals[sku] || 0) + quantity;
                    }
                }
            }
        } else {
            // Handle old format: { [dateKey]: { [sku]: entry } }
            for (const sku in dateData) {
                const entry = dateData[sku] as DailyProductionEntry | number;
                const quantity = typeof entry === 'number' ? entry : (entry?.quantity || 0);
                totals[sku] = (totals[sku] || 0) + quantity;
            }
        }
    }
    return totals;
  }, [dailyProductionLog, allShifts]);
  
  const filteredMarketRequirements = useMemo(() => {
    return marketRequirements.filter(req =>
      (req.sapCode?.toLowerCase() || '').includes(sapCodeFilter.toLowerCase()) &&
      (req.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [marketRequirements, sapCodeFilter, skuFilter]);

  const combinedData = useMemo(() => {
    if (filteredMarketRequirements.length === 0) return [];
    
    return filteredMarketRequirements.map(req => {
      const openingStockInfo = openingStockData.find(t => t.sku === req.sku) || { openingStock: 0 };
      const totalProduction = totalProductionBySku[req.sku] || 0;
      const tyreProduction = tyreProductionData[req.sku] || 0;
      const currentTreadStock = openingStockInfo.openingStock + totalProduction - tyreProduction;
      const treadBalanceToProduce = Math.max(0, req.demand - openingStockInfo.openingStock - tyreProduction);
      
      return {
        ...req,
        openingStock: openingStockInfo.openingStock,
        production: totalProduction,
        tyreProduction,
        currentTreadStock,
        treadBalanceToProduce,
      };
    });
  }, [filteredMarketRequirements, openingStockData, tyreProductionData, totalProductionBySku]);
  
  const visibleColumnsCount = 1 + Object.values(columnVisibility).filter(Boolean).length;

  const summary = useMemo(() => {
    if (!combinedData?.length) {
        return { totalDemand: 0, totalProduction: 0, totalCurrentStock: 0 };
    }
    const totalDemand = combinedData.reduce((acc, item) => acc + (item.demand || 0), 0);
    const totalProduction = combinedData.reduce((acc, item) => acc + (item.production || 0), 0);
    const totalCurrentStock = combinedData.reduce((acc, item) => acc + (item.currentTreadStock || 0), 0);
    return { totalDemand, totalProduction, totalCurrentStock };
  }, [combinedData]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tread Extrusion Planning</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Market Demand</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDemand.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total units required by market.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tread Production</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProduction.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total tread units produced to date.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tread Stock</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCurrentStock.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Current available tread in stock.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Tread Stock &amp; Planning</CardTitle>
              <CardDescription>Manage tread inventory and plan production to meet market demand.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.sapCode}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, sapCode: !!value}))}
                  >
                    SAP Code
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.demand}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, demand: !!value}))}
                  >
                    Demand
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.openingStock}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, openingStock: !!value}))}
                  >
                    Opening Stock
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.production}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, production: !!value}))}
                  >
                    Total Production
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.tyreProduction}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, tyreProduction: !!value}))}
                  >
                    Tyre Production
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.currentTreadStock}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, currentTreadStock: !!value}))}
                  >
                    Current Tread Stock
                  </DropdownMenuCheckboxItem>
                   <DropdownMenuCheckboxItem
                    checked={columnVisibility.treadBalanceToProduce}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, treadBalanceToProduce: !!value}))}
                  >
                    Tread Balance to Produce
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleSaveOpeningStock}><Save className="mr-2 h-4 w-4" /> Save Opening Stock</Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="flex gap-4 my-4">
              <Input
                placeholder="Filter by SAP Code..."
                value={sapCodeFilter}
                onChange={(e) => setSapCodeFilter(e.target.value)}
                className="max-w-sm"
              />
              <Input
                placeholder="Filter by SKU..."
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columnVisibility.sapCode && <TableHead>SAP Code</TableHead>}
                            <TableHead>SKU</TableHead>
                            {columnVisibility.demand && <TableHead className="text-right">Demand</TableHead>}
                            {columnVisibility.openingStock && <TableHead className="text-right">Opening Stock</TableHead>}
                            {columnVisibility.production && <TableHead className="text-right">Total Production</TableHead>}
                            {columnVisibility.tyreProduction && <TableHead className="text-right">Tyre Production</TableHead>}
                            {columnVisibility.currentTreadStock && <TableHead className="text-right">Current Tread Stock</TableHead>}
                            {columnVisibility.treadBalanceToProduce && <TableHead className="text-right">Tread Balance to Produce</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {combinedData.length > 0 ? combinedData.map((item, index) => (
                            <TableRow key={`${item.sku}-${index}`}>
                                {columnVisibility.sapCode && <TableCell>{item.sapCode}</TableCell>}
                                <TableCell className="font-medium">{item.sku}</TableCell>
                                {columnVisibility.demand && <TableCell className="text-right">{item.demand.toLocaleString()}</TableCell>}
                                {columnVisibility.openingStock && (
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="w-28 ml-auto text-right"
                                            placeholder="0"
                                            value={item.openingStock === 0 ? '' : item.openingStock}
                                            onChange={(e) => handleOpeningStockChange(item.sku, e.target.value)}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility.production && <TableCell className="text-right">{item.production.toLocaleString()}</TableCell>}
                                {columnVisibility.tyreProduction && <TableCell className="text-right">{item.tyreProduction.toLocaleString()}</TableCell>}
                                {columnVisibility.currentTreadStock && <TableCell className="text-right font-bold">{item.currentTreadStock.toLocaleString()}</TableCell>}
                                {columnVisibility.treadBalanceToProduce && (
                                  <TableCell className={cn("text-right font-bold", item.treadBalanceToProduce > 0 ? "text-destructive" : "text-green-600")}>
                                    {item.treadBalanceToProduce.toLocaleString()}
                                  </TableCell>
                                )}
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={visibleColumnsCount} className="h-24 text-center text-muted-foreground">
                                    No data matches your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
