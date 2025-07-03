"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MarketRequirement } from '@/lib/types';
import { CalendarIcon, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const TREAD_DAILY_PRODUCTION_KEY = 'tyretrack-tread-daily-production';

export default function DailyTreadProductionPage() {
  const { toast } = useToast();
  
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  const [dailyProductionLog, setDailyProductionLog] = useState<Record<string, Record<string, number>>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyProductionEntries, setDailyProductionEntries] = useState<Record<string, number>>({});
  
  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
    // Load market requirements
    const loadedMarketReqs = JSON.parse(localStorage.getItem('tyretrack-market-requirements') || '[]') as MarketRequirement[];
    setMarketRequirements(loadedMarketReqs);
    
    // Load daily production log
    const savedDailyProduction = JSON.parse(localStorage.getItem(TREAD_DAILY_PRODUCTION_KEY) || '{}');
    setDailyProductionLog(savedDailyProduction);
  }, []);

  useEffect(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    setDailyProductionEntries(dailyProductionLog[dateKey] || {});
  }, [selectedDate, dailyProductionLog]);

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

  const filteredMarketRequirements = useMemo(() => {
    return marketRequirements.filter(req =>
      (req.sapCode?.toLowerCase() || '').includes(sapCodeFilter.toLowerCase()) &&
      (req.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [marketRequirements, sapCodeFilter, skuFilter]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Daily Tread Production</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Log Tread Production</CardTitle>
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

          <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
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
                      No SKUs available. Please upload market requirements in the Admin panel.
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
