
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { MarketRequirement, ShiftInfo } from '@/lib/types';
import { CalendarIcon, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { shifts as initialShifts } from '@/lib/data';


const TREAD_DAILY_PRODUCTION_KEY = 'tyretrack-tread-daily-production';

interface DailyProductionEntry {
  quantity: number;
  trolleyNo: string;
  noOfSpool: string;
}

export default function DailyTreadProductionPage() {
  const { toast } = useToast();
  
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  const [dailyProductionLog, setDailyProductionLog] = useState<Record<string, Record<string, Record<string, DailyProductionEntry>>>>({});
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dailyProductionEntries, setDailyProductionEntries] = useState<Record<string, DailyProductionEntry>>({});
  
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();

  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    // Load shifts
    const loadedShifts: ShiftInfo[] = JSON.parse(localStorage.getItem('tyretrack-shifts') || 'null') || initialShifts;
    setAllShifts(loadedShifts);
    if (loadedShifts.length > 0) {
        setSelectedShift(loadedShifts[0]);
    }

    // Load market requirements
    const loadedMarketReqs = JSON.parse(localStorage.getItem('tyretrack-market-requirements') || '[]') as MarketRequirement[];
    setMarketRequirements(loadedMarketReqs);
    
    // Load daily production log and migrate old data if necessary
    const savedDailyProduction = JSON.parse(localStorage.getItem(TREAD_DAILY_PRODUCTION_KEY) || '{}');
    const normalizedLog: Record<string, Record<string, Record<string, DailyProductionEntry>>> = {};
    const defaultShiftName = (loadedShifts.length > 0 && loadedShifts[0].name) || 'Day Shift';

    for (const dateKey in savedDailyProduction) {
      const dateData = savedDailyProduction[dateKey];
      if (!dateData || typeof dateData !== 'object' || Array.isArray(dateData)) continue;

      const firstKey = Object.keys(dateData)[0];
      if (!firstKey) continue;
      
      const isNewFormat = loadedShifts.some(shift => shift.name === firstKey);

      if (isNewFormat) {
        // Data is already in the new format { [dateKey]: { [shiftName]: { [sku]: entry } } }
        normalizedLog[dateKey] = {};
        for (const shiftName in dateData) {
          normalizedLog[dateKey][shiftName] = {};
          const shiftEntries = dateData[shiftName];
          for (const sku in shiftEntries) {
            const entry = shiftEntries[sku];
            if (typeof entry === 'number') {
              normalizedLog[dateKey][shiftName][sku] = { quantity: entry, trolleyNo: '', noOfSpool: '' };
            } else {
              normalizedLog[dateKey][shiftName][sku] = {
                 quantity: entry?.quantity || 0,
                 trolleyNo: entry?.trolleyNo || '',
                 noOfSpool: entry?.noOfSpool || '',
              };
            }
          }
        }
      } else {
        // Data is in the old format { [dateKey]: { [sku]: entry } }. Migrate it.
        normalizedLog[dateKey] = { [defaultShiftName]: {} };
        for (const sku in dateData) {
          const entry = dateData[sku];
          if (typeof entry === 'number') {
            normalizedLog[dateKey][defaultShiftName][sku] = { quantity: entry, trolleyNo: '', noOfSpool: '' };
          } else {
            normalizedLog[dateKey][defaultShiftName][sku] = {
              quantity: entry?.quantity || 0,
              trolleyNo: entry?.trolleyNo || '',
              noOfSpool: entry?.noOfSpool || '',
            };
          }
        }
      }
    }
    setDailyProductionLog(normalizedLog);
  }, []);

  useEffect(() => {
    if (!selectedDate || !selectedShift) return;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const shiftName = selectedShift.name;
    setDailyProductionEntries(dailyProductionLog[dateKey]?.[shiftName] || {});
  }, [selectedDate, selectedShift, dailyProductionLog]);

  const handleDailyProductionChange = (sku: string, field: 'quantity' | 'trolleyNo' | 'noOfSpool', value: string) => {
    setDailyProductionEntries(currentEntries => {
        const entry = currentEntries[sku] || { quantity: 0, trolleyNo: '', noOfSpool: '' };
        const newEntry = {
            ...entry,
            [field]: field === 'quantity' ? parseInt(value, 10) || 0 : value,
        };
        return {
            ...currentEntries,
            [sku]: newEntry
        };
    });
  };
  
  const handleSaveDailyProduction = () => {
    if (!selectedDate || !selectedShift) {
      toast({
        variant: 'destructive',
        title: 'Please wait',
        description: 'The date or shift is still loading. Please try again in a moment.',
      });
      return;
    }
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const shiftName = selectedShift.name;

    const updatedLogForDate = {
      ...(dailyProductionLog[dateKey] || {}),
      [shiftName]: dailyProductionEntries,
    };
    
    const newLog = { ...dailyProductionLog, [dateKey]: updatedLogForDate };

    setDailyProductionLog(newLog);
    localStorage.setItem(TREAD_DAILY_PRODUCTION_KEY, JSON.stringify(newLog));
    toast({
      title: 'Success!',
      description: `Tread production for ${selectedShift.name} on ${format(selectedDate, "PPP")} has been saved.`,
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
          <CardDescription>Enter the quantity of tread produced and the trolley number for each SKU.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full sm:w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                  </PopoverContent>
                </Popover>

                <Select value={selectedShift?.name} onValueChange={(name) => setSelectedShift(allShifts.find(s => s.name === name))}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                        {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
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
                  <TableHead>Trolley No</TableHead>
                  <TableHead>No of Spool</TableHead>
                  <TableHead className="text-right">Production Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMarketRequirements.length > 0 ? filteredMarketRequirements.map((req, index) => (
                  <TableRow key={`${req.sku}-${index}`}>
                    <TableCell className="font-medium">{req.sku}</TableCell>
                    <TableCell>
                      <Input
                        className="w-32"
                        placeholder="e.g., T-123"
                        value={dailyProductionEntries[req.sku]?.trolleyNo || ''}
                        onChange={(e) => handleDailyProductionChange(req.sku, 'trolleyNo', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-32"
                        placeholder="e.g., S-456"
                        value={dailyProductionEntries[req.sku]?.noOfSpool || ''}
                        onChange={(e) => handleDailyProductionChange(req.sku, 'noOfSpool', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-32 ml-auto text-right"
                        placeholder="0"
                        value={dailyProductionEntries[req.sku]?.quantity || ''}
                        onChange={(e) => handleDailyProductionChange(req.sku, 'quantity', e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
