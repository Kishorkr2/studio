
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  Operator,
  ProductionPlanItem,
  ReportDataRow,
  ShiftInfo,
} from '@/lib/types';
import {
  Package,
  Factory,
  Percent,
  Users2,
  CheckCircle,
  Trophy,
  BarChart,
  AreaChart,
  LineChart,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as actions from '../actions';
import { Loader } from '@/components/ui/loader';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { BarChart as RechartsBarChart, Bar as RechartsBar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [productionLogs, setProductionLogs] = useState<ReportDataRow[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);

  const { toast } = useToast();

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, plan, logs, shifts] = await Promise.all([
        actions.getOperators(),
        actions.getProductionPlan(),
        actions.getProductionLogs(),
        actions.getShifts(),
      ]);
      setOperators(ops);
      setProductionPlan(plan);
      setProductionLogs(logs as ReportDataRow[]);
      setAllShifts(shifts);
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load data from the server.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });
  
  const [selectedShift, setSelectedShift] = useState('All');

  const filteredLogs = useMemo(() => {
    return productionLogs.filter(log => {
      const logDate = parseISO(log.date);
      const inDateRange = dateRange?.from && dateRange?.to ? 
        (logDate >= dateRange.from && logDate <= dateRange.to) : true;
      
      const inShift = selectedShift === 'All' ? true : log.shift === selectedShift;

      return inDateRange && inShift;
    });
  }, [productionLogs, dateRange, selectedShift]);

  const clearFilters = () => {
    setDateRange({ from: addDays(new Date(), -7), to: new Date() });
    setSelectedShift('All');
  };
  
  const kpiData = useMemo(() => {
    const totalProduction = filteredLogs.reduce((sum, log) => sum + log.quantity, 0);
    const activeMachines = new Set(filteredLogs.map(log => log.machineId)).size;
    const activeOperators = new Set(filteredLogs.map(log => log.operatorId)).size;
    const totalPlanQty = productionPlan.reduce((sum, item) => sum + item.skus.reduce((s, sku) => s + sku.quantity, 0), 0);
    const totalActualProdForPlan = productionLogs.reduce((sum, log) => sum + log.quantity, 0);
    const productionVsPlan = totalPlanQty > 0 ? (totalActualProdForPlan / totalPlanQty) * 100 : 0;
    
    return { totalProduction, activeMachines, activeOperators, productionVsPlan: Math.min(100, productionVsPlan) };
  }, [filteredLogs, productionPlan, productionLogs]);
  
  const operatorProduction = useMemo(() => {
    const operatorData = filteredLogs.reduce((acc, curr) => {
        if (!curr.operatorName || curr.operatorName === 'N/A') return acc;
        if (!acc[curr.operatorName]) {
            acc[curr.operatorName] = { name: curr.operatorName, production: 0 };
        }
        acc[curr.operatorName].production += curr.quantity;
        return acc;
    }, {} as Record<string, { name: string; production: number }>);

    return Object.values(operatorData).sort((a, b) => b.production - a.production);
  }, [filteredLogs]);

  const topOperator = useMemo(() => operatorProduction[0], [operatorProduction]);
  
  const skuProduction = useMemo(() => {
     const skuData = filteredLogs.reduce((acc, curr) => {
        if (!curr.sku || curr.sku === 'N/A') return acc;
        if (!acc[curr.sku]) {
            acc[curr.sku] = { name: curr.sku, production: 0 };
        }
        acc[curr.sku].production += curr.quantity;
        return acc;
    }, {} as Record<string, { name: string; production: number }>);
    
    return Object.values(skuData).sort((a,b) => b.production - a.production);
  }, [filteredLogs]);


  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-muted/40 min-h-screen">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Production Dashboard</h1>
              <p className="text-muted-foreground">Real-time overview of your factory performance.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal bg-card",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-card">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Shifts</SelectItem>
                    {allShifts.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                 <Button variant="outline" onClick={clearFilters} className="bg-card">Clear Filters</Button>
            </div>
        </header>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Production</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData.totalProduction.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Units produced in selected range</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Machines</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData.activeMachines}</div>
                <p className="text-xs text-muted-foreground">Machines with logged production</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Operators</CardTitle>
                <Users2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData.activeOperators}</div>
                <p className="text-xs text-muted-foreground">Operators with logged production</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Plan Compliance</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData.productionVsPlan.toFixed(1)}%</div>
                <Progress value={kpiData.productionVsPlan} className="w-full mt-2 h-2" />
              </CardContent>
            </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
             <CardHeader>
                <CardTitle>Top 10 SKU Production</CardTitle>
                <CardDescription>Production quantity by SKU for the selected period.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsBarChart 
                    data={skuProduction.slice(0,10)} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                    <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))'}}/>
                    <Legend />
                    <RechartsBar dataKey="production" name="Production" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
          </Card>
          
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-300"/>
                  <span>Top Performer</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                 {topOperator ? (
                    <>
                      <h3 className="text-2xl font-bold">{topOperator.name}</h3>
                      <p className="text-4xl font-extrabold mt-2">{topOperator.production.toLocaleString()}</p>
                      <p className="text-sm opacity-80">units produced</p>
                    </>
                  ) : (
                    <p>No operator data available for this period.</p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Operators</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[250px] overflow-y-auto">
                <div className="space-y-4">
                  {operatorProduction.map((op, index) => (
                    <div key={op.name} className="flex items-center">
                      <span className="text-sm font-medium w-8">{index + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">{op.name}</p>
                      </div>
                      <div className="font-medium">{op.production.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Operator-wise Production</CardTitle>
             <CardDescription>Production quantity by operator for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <RechartsBarChart data={operatorProduction.slice(0,10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{backgroundColor: 'hsl(var(--background))'}}/>
                <Legend />
                <RechartsBar dataKey="production" name="Production" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
    </div>
  )
}
