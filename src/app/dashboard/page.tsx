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
  Users2,
  CheckCircle,
  Calendar as CalendarIcon,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as actions from '../actions';
import { Loader } from '@/components/ui/loader';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Professional color scheme for enterprise dashboards
const SKU_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#4f46e5', '#0d9488', '#ea580c', '#9333ea',
];

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
    return productionLogs.filter((log) => {
      try {
        const logDate = parseISO(log.date);
        const inDateRange =
          dateRange?.from && dateRange?.to
            ? logDate >= dateRange.from && logDate <= dateRange.to
            : true;
        const inShift =
          selectedShift === 'All' ? true : log.shift === selectedShift;
        return inDateRange && inShift;
      } catch (error) {
        console.warn('Invalid date format in log:', log.date);
        return false;
      }
    });
  }, [productionLogs, dateRange, selectedShift]);

  const clearFilters = () => {
    setDateRange({ from: addDays(new Date(), -7), to: new Date() });
    setSelectedShift('All');
  };

  const kpiData = useMemo(() => {
    const totalProduction = filteredLogs.reduce(
      (sum, log) => sum + (log.quantity || 0),
      0
    );
    const activeMachines = new Set(filteredLogs.map((log) => log.machineId))
      .size;
    const activeOperators = new Set(filteredLogs.map((log) => log.operatorId))
      .size;
    const totalPlanQty = productionPlan.reduce(
      (sum, item) =>
        sum + item.skus.reduce((s, sku) => s + (sku.quantity || 0), 0),
      0
    );
    const productionVsPlan =
      totalPlanQty > 0 ? (totalProduction / totalPlanQty) * 100 : 0;
    return {
      totalProduction,
      activeMachines,
      activeOperators,
      productionVsPlan: Math.min(100, productionVsPlan),
    };
  }, [filteredLogs, productionPlan]);

  const operatorProduction = useMemo(() => {
    const operatorData = filteredLogs.reduce((acc, curr) => {
      if (!curr.operatorName || curr.operatorName === 'N/A') return acc;
      if (!acc[curr.operatorName]) {
        acc[curr.operatorName] = { name: curr.operatorName, production: 0 };
      }
      acc[curr.operatorName].production += curr.quantity || 0;
      return acc;
    }, {} as Record<string, { name: string; production: number }>);
    return Object.values(operatorData).sort(
      (a, b) => b.production - a.production
    );
  }, [filteredLogs]);

  const topOperator = useMemo(
    () => operatorProduction[0],
    [operatorProduction]
  );

  const skuProduction = useMemo(() => {
    const skuData = filteredLogs.reduce((acc, curr) => {
      if (!curr.sku || curr.sku === 'N/A') return acc;
      if (!acc[curr.sku]) {
        acc[curr.sku] = { name: curr.sku, production: 0 };
      }
      acc[curr.sku].production += curr.quantity || 0;
      return acc;
    }, {} as Record<string, { name: string; production: number }>);
    return Object.values(skuData).sort((a, b) => b.production - a.production);
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-slate-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/50">
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6 md:p-8">
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Production Dashboard
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Monitor key performance indicators and production metrics.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal sm:w-[260px]',
                      !dateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'LLL dd, y')} -{' '}
                          {format(dateRange.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(dateRange.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Select date range</span>
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
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Shifts</SelectItem>
                  {allShifts.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" onClick={clearFilters}>
                Reset
              </Button>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Production
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.totalProduction.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Units produced in selected period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Machines
              </CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.activeMachines}
              </div>
              <p className="text-xs text-muted-foreground">
                Machines with production logs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Operators
              </CardTitle>
              <Users2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.activeOperators}
              </div>
              <p className="text-xs text-muted-foreground">
                Operators with active shifts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Plan Compliance</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpiData.productionVsPlan.toFixed(1)}%
              </div>
              <Progress
                value={kpiData.productionVsPlan}
                className="mt-2 h-2"
                aria-label={`${kpiData.productionVsPlan.toFixed(1)}% of plan`}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>SKU Production Analysis</CardTitle>
              <CardDescription>
                Top 10 performing SKUs by production volume.
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart
                  data={skuProduction.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#888888" fontSize={12} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#888888"
                    fontSize={12}
                    tick={{ width: 100 }}
                    width={100}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderRadius: 'var(--radius)',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <RechartsBar
                    dataKey="production"
                    name="Production Volume"
                    radius={[0, 4, 4, 0]}
                    background={{ fill: 'hsl(var(--muted))' }}
                  >
                    {skuProduction.slice(0, 10).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SKU_COLORS[index % SKU_COLORS.length]}
                      />
                    ))}
                  </RechartsBar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Top Performer
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {topOperator ? (
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Users2 className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      {topOperator.name}
                    </h3>
                    <p className="mt-2 text-3xl font-bold text-primary">
                      {topOperator.production.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Total units produced
                    </p>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No operator data available.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-base">
                  Operator Rankings
                </CardTitle>
                <CardDescription className="text-xs">
                  Top 5 by production volume.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[320px] overflow-y-auto">
                    {operatorProduction.slice(0, 5).map((op, index) => (
                      <div
                        key={op.name}
                        className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span
                          className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                            index === 0 && 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
                            index === 1 && 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300',
                            index === 2 && 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
                            index > 2 && 'bg-muted text-muted-foreground'
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">
                            {op.name}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {op.production.toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

    