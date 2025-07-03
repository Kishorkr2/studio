"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MarketRequirement, ProductionLog, TreadStock } from '@/lib/types';
import { CalendarIcon, Save, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const TREAD_OPENING_STOCK_KEY = 'tyretrack-tread-opening-stock';
const TREAD_DAILY_PRODUCTION_KEY = 'tyretrack-tread-daily-production';

export default function TreadExtrusionPage() {
  const { toast } = useToast();
  
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  const [openingStockData, setOpeningStockData] = useState<TreadStock[]>([]);
  const [tyreConsumption, setTyreConsumption] = useState<Record<string, number>>({});
  
  const [dailyProductionLog, setDailyProductionLog] = useState<Record<string, Record<string, number>>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyProductionEntries, setDailyProductionEntries] = useState<Record<string, number>>({});

  const [columnVisibility, setColumnVisibility] = useState({
    sapCode: true,
    demand: true,
    openingStock: true,
    production: true,
    consumption: true,
    currentTreadStock: true,
    treadBalanceToProduce: true,
  });

  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
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

    // Load daily production log
    const savedDailyProduction = JSON.parse(localStorage.getItem(TREAD_DAILY_PRODUCTION_KEY) || '{}');
    setDailyProductionLog(savedDailyProduction);

    // Calculate tyre consumption from all production logs
    const consumption: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('production-log-')) {
            const logData: ProductionLog = JSON.parse(localStorage.getItem(key) || '{}');
            Object.values(logData).forEach(logEntry => {
              if (logEntry.entries) {
                logEntry.entries.forEach(entry => {
                    if (entry.sku && entry.quantity > 0) {
                        consumption[entry.sku] = (consumption[entry.sku] || 0) + entry.quantity;
                    }
                });
              }
            });
        }
    }
    setTyreConsumption(consumption);
  }, []);

  useEffect(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    setDailyProductionEntries(dailyProductionLog[dateKey] || {});
  }, [selectedDate, dailyProductionLog]);
  
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

  const handleDailyProductionChange = (sku: string, value: string) => {
    const numericValue = parseInt(value, 10) || 0;
    setDailyProductionEntries(currentEntries => ({
      ...currentEntries,
      [sku]: numericValue
    }));
  };
  
  const handleSaveDailyProduction = () => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const newLog = { ...dailyProductionLog, [dateKey]: dailyProductionEntries };
    setDailyProductionLog(newLog);
    localStorage.setItem(TREAD_DAILY_PRODUCTION_KEY, JSON.stringify(newLog));
    toast({
      title: 'Success!',
      description: `Tread production for ${format(selectedDate, "PPP")} has been saved.`,
      action: <Save className="text-green-500" />,
    });
  };

  const totalProductionBySku = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const date in dailyProductionLog) {
      for (const sku in dailyProductionLog[date]) {
        totals[sku] = (totals[sku] || 0) + dailyProductionLog[date][sku];
      }
    }
    return totals;
  }, [dailyProductionLog]);
  
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
      const consumption = tyreConsumption[req.sku] || 0;
      const currentTreadStock = openingStockInfo.openingStock + totalProduction - consumption;
      const treadBalanceToProduce = Math.max(0, req.demand - openingStockInfo.openingStock - consumption);
      
      return {
        ...req,
        openingStock: openingStockInfo.openingStock,
        production: totalProduction,
        consumption,
        currentTreadStock,
        treadBalanceToProduce,
      };
    });
  }, [filteredMarketRequirements, openingStockData, tyreConsumption, totalProductionBySku]);
  
  const visibleColumnsCount = 1 + Object.values(columnVisibility).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tread Extrusion Section</h1>
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
                    checked={columnVisibility.consumption}
                    onCheckedChange={(value) => setColumnVisibility(prev => ({...prev, consumption: !!value}))}
                  >
                    Consumption (Tyres)
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
                            {columnVisibility.consumption && <TableHead className="text-right">Consumption (Tyres)</TableHead>}
                            {columnVisibility.currentTreadStock && <TableHead className="text-right">Current Tread Stock</TableHead>}
                            {columnVisibility.treadBalanceToProduce && <TableHead className="text-right">Tread Balance to Produce</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {combinedData.length > 0 ? combinedData.map(item => (
                            <TableRow key={item.sku}>
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
                                {columnVisibility.consumption && <TableCell className="text-right">{item.consumption.toLocaleString()}</TableCell>}
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

      <Card>
        <CardHeader>
          <CardTitle>Daily Tread Production</CardTitle>
          <CardDescription>Enter the quantity of tread produced for each SKU for a specific day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={handleSaveDailyProduction}><Save className="mr-2 h-4 w-4" /> Save Daily Production</Button>
          </div>
          <div className="border rounded-lg max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Production Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMarketRequirements.length > 0 ? filteredMarketRequirements.map(req => (
                  <TableRow key={req.sku}>
                    <TableCell className="font-medium">{req.sku}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-32 ml-auto text-right"
                        placeholder="0"
                        value={dailyProductionEntries[req.sku] || ''}
                        onChange={(e) => handleDailyProductionChange(req.sku, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                      No SKUs available for the current filters.
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
