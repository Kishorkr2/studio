
'use client';

import * as React from 'react';
import {Bar, BarChart, CartesianGrid, XAxis, YAxis} from 'recharts';
import {
  Calendar as CalendarIcon,
  Download,
  Filter,
  Percent,
  Clock,
  Wrench,
  Check,
} from 'lucide-react';
import {addDays, format, parseISO} from 'date-fns';
import type {DateRange} from 'react-day-picker';
import * as XLSX from 'xlsx';

import {cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useToast} from '@/hooks/use-toast';
import {Label} from '@/components/ui/label';
import type {
  Machine,
  Operator,
  ShiftInfo,
  MachineProductionData,
} from '@/lib/types';
import * as actions from '../actions';

interface ReportDataRow {
  date: string;
  shift: string;
  round: string;
  operatorId?: string;
  operatorName?: string;
  machineId: string;
  machineName: string;
  sku: string;
  quantity: number;
  remark?: string;
  trolleyNo?: string;
}

const mockOeeData = {
  overall: 75.8,
  availability: 92.5,
  performance: 85.3,
  quality: 96.1,
};

const oeeChartData = [
  {
    name: 'Availability',
    value: mockOeeData.availability,
    fill: 'var(--color-availability)',
  },
  {
    name: 'Performance',
    value: mockOeeData.performance,
    fill: 'var(--color-performance)',
  },
  {name: 'Quality', value: mockOeeData.quality, fill: 'var(--color-quality)'},
];

const oeeChartConfig = {
  value: {label: 'Value'},
  availability: {label: 'Availability', color: 'hsl(var(--primary))'},
  performance: {label: 'Performance', color: 'hsl(var(--accent))'},
  quality: {label: 'Quality', color: 'hsl(var(--secondary-foreground))'},
} satisfies ChartConfig;

export default function ReportsPage() {
  const {toast} = useToast();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date(),
  });

  const [selectedShift, setSelectedShift] = React.useState<string>('all');
  const [selectedOperator, setSelectedOperator] =
    React.useState<string>('all');
  const [selectedMachine, setSelectedMachine] = React.useState<string>('all');

  const [allOperators, setAllOperators] = React.useState<Operator[]>([]);
  const [allMachines, setAllMachines] = React.useState<Machine[]>([]);
  const [allShifts, setAllShifts] = React.useState<ShiftInfo[]>([]);

  const [allReportData, setAllReportData] = React.useState<ReportDataRow[]>([]);
  const [filteredReportData, setFilteredReportData] = React.useState<
    ReportDataRow[]
  >([]);
  const [breakdownData, setBreakdownData] = React.useState<ReportDataRow[]>([]);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [ops, machs, shifts, logs] = await Promise.all([
          actions.getOperators(),
          actions.getMachines(),
          actions.getShifts(),
          actions.getProductionLogs(),
        ]);
        setAllOperators(ops);
        setAllMachines(machs);
        setAllShifts(shifts);
        setAllReportData(logs as ReportDataRow[]);
        setBreakdownData(
          (logs as ReportDataRow[]).filter(item => item.remark && item.remark.trim() !== '')
        );
      } catch (error) {
        console.error('Failed to load report data', error);
        toast({variant: 'destructive', title: 'Error loading data'});
      }
    };
    loadData();
  }, [toast]);

  const handleApplyFilters = React.useCallback(() => {
    let data = [...allReportData];

    if (date?.from && date?.to) {
      const from = new Date(date.from);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date.to);
      to.setHours(23, 59, 59, 999);
      data = data.filter(item => {
        try {
          const itemDate = parseISO(item.date);
          return itemDate >= from && itemDate <= to;
        } catch (e) {
          return false;
        }
      });
    }

    if (selectedShift !== 'all') {
      data = data.filter(item => item.shift === selectedShift);
    }
    if (selectedOperator !== 'all') {
      data = data.filter(item => item.operatorId === selectedOperator);
    }
    if (selectedMachine !== 'all') {
      data = data.filter(item => item.machineId === selectedMachine);
    }

    // Filter out items with zero or no quantity
    data = data.filter(item => item.quantity > 0);
    
    setFilteredReportData(data);
    toast({
      title: 'Filters Applied',
      description: `Displaying ${data.length} records.`,
    });
  }, [
    allReportData,
    date,
    selectedShift,
    selectedOperator,
    selectedMachine,
    toast,
  ]);

  React.useEffect(() => {
    handleApplyFilters();
  }, [allReportData, handleApplyFilters]);

  const handleExport = () => {
    if (filteredReportData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'Please apply filters to generate a report first.',
      });
      return;
    }

    const exportData = filteredReportData.map(row => ({
      Date: format(parseISO(row.date), 'yyyy-MM-dd'),
      Shift: row.shift,
      Operator: row.operatorName,
      'TBM No': row.machineName,
      SKU: row.sku,
      'Trolley No': row.trolleyNo || '-',
      Quantity: row.quantity,
      Remark: row.remark || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ProductionReport');
    worksheet['!cols'] = [
      {wch: 12}, // Date
      {wch: 15}, // Shift
      {wch: 20}, // Operator
      {wch: 12}, // TBM No
      {wch: 20}, // SKU
      {wch: 15}, // Trolley No
      {wch: 10}, // Quantity
      {wch: 30}, // Remark
    ];
    XLSX.writeFile(workbook, 'TyreTrack_Production_Report.xlsx');
    toast({
      title: 'Report Exported',
      description: 'Your report has been downloaded successfully.',
    });
  };

  const totalProduction = React.useMemo(() => {
    return filteredReportData.reduce(
      (acc, item) => acc + (item.quantity || 0),
      0
    );
  }, [filteredReportData]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Advanced Reporting & Analytics
        </h1>
        <p className="text-muted-foreground">
          Analyze production data, OEE, and machine breakdowns.
        </p>
      </div>

      <Tabs defaultValue="production">
        <div className="flex flex-col sm:flex-row justify-between items-center flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="production">Production Report</TabsTrigger>
            <TabsTrigger value="oee">OEE Analysis</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown Log</TabsTrigger>
          </TabsList>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Production Report Filters</CardTitle>
              <CardDescription>
                Filter the production data to generate your detailed report.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Date range</Label>
                  <DateRangePicker date={date} setDate={setDate} />
                </div>
                <div className="grid gap-2">
                  <Label>Shift</Label>
                  <Select
                    value={selectedShift}
                    onValueChange={setSelectedShift}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Shifts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shifts</SelectItem>
                      {allShifts.map(s => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Operator</Label>
                  <Select
                    value={selectedOperator}
                    onValueChange={setSelectedOperator}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Operators" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Operators</SelectItem>
                      {allOperators.map(op => (
                        <SelectItem key={op.cardNo} value={op.cardNo}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>TBM No</Label>
                  <Select
                    value={selectedMachine}
                    onValueChange={setSelectedMachine}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All TBMs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All TBMs</SelectItem>
                      {allMachines.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleApplyFilters}>
                  <Filter className="mr-2 h-4 w-4" />
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Production Summary</CardTitle>
              <CardDescription>
                Detailed report based on your filter selection. Total:{' '}
                {totalProduction.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg max-h-[60vh] overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>TBM No</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Trolley No</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReportData.length > 0 ? (
                      filteredReportData.map((row, index) => (
                        <TableRow
                          key={`${row.date}-${row.shift}-${row.machineId}-${row.round}-${index}`}
                        >
                          <TableCell>
                            {format(parseISO(row.date), 'yyyy-MM-dd')}
                          </TableCell>
                          <TableCell>{row.shift}</TableCell>
                          <TableCell className="font-medium">
                            {row.operatorName}
                          </TableCell>
                          <TableCell>{row.machineName}</TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.trolleyNo || '-'}</TableCell>
                          <TableCell className="text-right">
                            {row.quantity}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center h-24 text-muted-foreground"
                        >
                          No data available for the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oee">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall OEE
                </CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockOeeData.overall}%</div>
                <p className="text-xs text-muted-foreground">
                  World-class OEE is 85% or higher
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Availability
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockOeeData.availability}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Measures downtime losses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Performance
                </CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockOeeData.performance}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Measures speed losses
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality</CardTitle>
                <Check className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mockOeeData.quality}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Measures quality losses
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">OEE Component Breakdown</CardTitle>
              <CardDescription>
                This is a visual demonstration. Accurate OEE calculation
                requires additional data points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={oeeChartConfig}
                className="min-h-[200px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={oeeChartData}
                  layout="vertical"
                  margin={{left: 10}}
                >
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tick={{fill: 'hsl(var(--muted-foreground))'}}
                    className="text-muted-foreground"
                  />
                  <XAxis dataKey="value" type="number" hide />
                  <CartesianGrid horizontal={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Bar dataKey="value" radius={5}></Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Machine Breakdown Log</CardTitle>
              <CardDescription>
                A log of all machine downtime events based on entered remarks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg max-h-[60vh] overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>TBM No</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Round</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdownData.length > 0 ? (
                      breakdownData.map((row, index) => (
                        <TableRow
                          key={`${row.date}-${row.machineName}-${index}`}
                        >
                          <TableCell>
                            {format(parseISO(row.date), 'yyyy-MM-dd')}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.machineName}
                          </TableCell>
                          <TableCell>{row.shift}</TableCell>
                          <TableCell>{row.round}</TableCell>
                          <TableCell>{row.remark}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center h-24 text-muted-foreground"
                        >
                          No breakdowns with remarks logged in the selected
                          period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DateRangePicker({
  className,
  date,
  setDate,
}: React.HTMLAttributes<HTMLDivElement> & {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
