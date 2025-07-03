
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MarketRequirement, ProductionLog, TreadStock } from '@/lib/types';
import { Save, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TREAD_STOCK_KEY = 'tyretrack-tread-stock';

export default function TreadExtrusionPage() {
  const { toast } = useToast();
  
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  const [treadData, setTreadData] = useState<TreadStock[]>([]);
  const [tyreConsumption, setTyreConsumption] = useState<Record<string, number>>({});
  
  const [columnVisibility, setColumnVisibility] = useState({
    sapCode: true,
    demand: true,
    openingStock: true,
    production: true,
    consumption: true,
    currentTreadStock: true,
    treadBalanceToProduce: true,
  });

  useEffect(() => {
    // Load market requirements
    const loadedMarketReqs = JSON.parse(localStorage.getItem('tyretrack-market-requirements') || '[]') as MarketRequirement[];
    setMarketRequirements(loadedMarketReqs);
    
    // Load saved tread stock data
    const savedTreadData = JSON.parse(localStorage.getItem(TREAD_STOCK_KEY) || '[]') as TreadStock[];
    
    // Initialize tread data from market requirements if it's not already saved
    const initialTreadData = loadedMarketReqs.map(req => {
        const existing = savedTreadData.find(t => t.sku === req.sku);
        return existing || { sku: req.sku, openingStock: 0, production: 0 };
    });
    setTreadData(initialTreadData);

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
  
  const handleDataChange = (sku: string, field: 'openingStock' | 'production', value: string) => {
    const numericValue = parseInt(value, 10) || 0;
    setTreadData(currentData =>
      currentData.map(item =>
        item.sku === sku ? { ...item, [field]: numericValue } : item
      )
    );
  };
  
  const handleSave = () => {
    localStorage.setItem(TREAD_STOCK_KEY, JSON.stringify(treadData));
    toast({
      title: 'Success!',
      description: 'Tread extrusion data has been saved.',
      action: <Save className="text-green-500" />,
    });
  };

  const combinedData = useMemo(() => {
    if (marketRequirements.length === 0) return [];
    
    return marketRequirements.map(req => {
      const stock = treadData.find(t => t.sku === req.sku) || { openingStock: 0, production: 0 };
      const consumption = tyreConsumption[req.sku] || 0;
      const currentTreadStock = stock.openingStock + stock.production - consumption;
      const treadBalanceToProduce = Math.max(0, req.demand - stock.openingStock - consumption);
      
      return {
        ...req,
        ...stock,
        consumption,
        currentTreadStock,
        treadBalanceToProduce,
      };
    });
  }, [marketRequirements, treadData, tyreConsumption]);
  
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
                    Production
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
              <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Save Data</Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columnVisibility.sapCode && <TableHead>SAP Code</TableHead>}
                            <TableHead>SKU</TableHead>
                            {columnVisibility.demand && <TableHead className="text-right">Demand</TableHead>}
                            {columnVisibility.openingStock && <TableHead className="text-right">Opening Stock</TableHead>}
                            {columnVisibility.production && <TableHead className="text-right">Production</TableHead>}
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
                                            onChange={(e) => handleDataChange(item.sku, 'openingStock', e.target.value)}
                                        />
                                    </TableCell>
                                )}
                                {columnVisibility.production && (
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            className="w-28 ml-auto text-right"
                                            placeholder="0"
                                            value={item.production === 0 ? '' : item.production}
                                            onChange={(e) => handleDataChange(item.sku, 'production', e.target.value)}
                                        />
                                    </TableCell>
                                )}
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
                                    No market requirements found. Please upload demand data in the Admin panel.
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
