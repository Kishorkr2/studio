
'use client';

import {useState, useEffect, useCallback, useMemo} from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import type {
  Operator,
  ProductionPlanItem,
  ReportDataRow,
} from '@/lib/types';
import {
  Package,
  Factory,
  Percent,
  Users2,
  CheckCircle,
} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import * as actions from '../actions';
import { Loader } from '@/components/ui/loader';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Progress } from '@/components/ui/progress';


export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [productionLogs, setProductionLogs] = useState<ReportDataRow[]>([]);

  const {toast} = useToast();

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, plan, logs] = await Promise.all([
        actions.getOperators(),
        actions.getProductionPlan(),
        actions.getProductionLogs(),
      ]);
      setOperators(ops);
      setProductionPlan(plan);
      setProductionLogs(logs as ReportDataRow[]);
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

  const filteredLogs = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return productionLogs;
    }
    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
    return productionLogs.filter(log => {
      const logDate = parseISO(log.date);
      return logDate >= from && logDate <= to;
    });
  }, [productionLogs, dateRange]);
  
  // Section 1: Production Overview
  const productionOverview = useMemo(() => {
    const totalProduction = filteredLogs.reduce((sum, log) => sum + log.quantity, 0);
    const productionByTbm = filteredLogs
      .filter(log => log.machineName.startsWith('TBM'))
      .reduce((acc, log) => {
        acc[log.machineName] = (acc[log.machineName] || 0) + log.quantity;
        return acc;
      }, {} as Record<string, number>);
      
    const productionByCuring = filteredLogs
      .filter(log => log.machineName.startsWith('CP'))
      .reduce((acc, log) => {
        acc[log.machineName] = (acc[log.machineName] || 0) + log.quantity;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalProduction,
      oee: 75.8, // Mock data
      activeMachines: new Set(filteredLogs.map(log => log.machineId)).size,
      tbmChartData: Object.entries(productionByTbm).map(([name, quantity]) => ({ name, quantity })).sort((a,b) => b.quantity - a.quantity).slice(0, 5),
      curingChartData: Object.entries(productionByCuring).map(([name, quantity]) => ({ name, quantity })).sort((a,b) => b.quantity - a.quantity).slice(0, 5),
    };
  }, [filteredLogs]);

  // Section 2: Manpower
  const manpower = useMemo(() => {
    const present = operators.filter(op => !op.isAbsent).length;
    const absent = operators.length - present;
    const efficiency = operators.length > 0 ? (present / operators.length) * 100 : 0;
    return { present, absent, efficiency };
  }, [operators]);
  
  // Section 3: Planning & Performance
  const planning = useMemo(() => {
    const totalPlanQty = productionPlan.reduce((sum, item) => sum + item.skus.reduce((s, sku) => s + sku.quantity, 0), 0);
    const productionVsPlan = totalPlanQty > 0 ? (productionOverview.totalProduction / totalPlanQty) * 100 : 0;
    return {
      totalPlanQty,
      productionVsPlan,
    }
  }, [productionPlan, productionOverview.totalProduction]);


  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Real-Time Dashboard</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-[300px] justify-start text-left font-normal",
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
                        <span>Pick a date</span>
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
            </CardTitle>
            <CardDescription>
              Live overview of production, manpower, and planning performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Section 1: Production Overview */}
            <section>
              <h3 className="text-lg font-semibold mb-4">Production Overview</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Production</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{productionOverview.totalProduction.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Units produced in selected range</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall OEE (Demo)</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{productionOverview.oee}%</div>
                    <p className="text-xs text-muted-foreground">Availability, Performance, Quality</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Machines</CardTitle>
                    <Factory className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{productionOverview.activeMachines}</div>
                    <p className="text-xs text-muted-foreground">Machines with production log</p>
                  </CardContent>
                </Card>
              </div>
               <div className="grid gap-4 md:grid-cols-2 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">TBM Production</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={productionOverview.tbmChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                        <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Curing Production</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                       <BarChart data={productionOverview.curingChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                        <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Section 2: Manpower */}
            <section>
              <h3 className="text-lg font-semibold mb-4">Manpower</h3>
              <div className="grid gap-4 md:grid-cols-3">
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Present Operators</CardTitle>
                    <Users2 className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{manpower.present}</div>
                    <p className="text-xs text-muted-foreground">out of {operators.length} total operators</p>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Absent Operators</CardTitle>
                    <Users2 className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{manpower.absent}</div>
                     <p className="text-xs text-muted-foreground">({(100 - manpower.efficiency).toFixed(1)}% of workforce)</p>
                  </CardContent>
                </Card>
                 <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Manpower Efficiency</CardTitle>
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{manpower.efficiency.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">Percentage of workforce present</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Section 3: Planning & Performance */}
             <section>
              <h3 className="text-lg font-semibold mb-4">Planning & Performance</h3>
              <Card>
                <CardHeader>
                  <CardTitle>Production W.R.T. Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className='flex justify-between items-baseline'>
                    <span className='text-4xl font-bold text-primary'>{planning.productionVsPlan.toFixed(2)}%</span>
                    <span className='text-muted-foreground text-sm'>{productionOverview.totalProduction.toLocaleString()} / {planning.totalPlanQty.toLocaleString()} units</span>
                  </div>
                  <Progress value={planning.productionVsPlan} className="w-full" />
                  <p className="text-xs text-muted-foreground pt-2">
                    This reflects performance for the full plan, not just the selected date range.
                  </p>
                </CardContent>
              </Card>
            </section>
          </CardContent>
        </Card>
    </div>
  )
}
