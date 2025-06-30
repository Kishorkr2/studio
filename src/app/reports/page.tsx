"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Calendar as CalendarIcon, Download, Filter, Percent, Clock, Wrench, Check } from "lucide-react"
import { addDays, format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { initialOperators, initialMachines } from "@/lib/data"

const mockReportData = [
  { date: "2024-07-28", shift: "A", operator: "John Doe", tbm: "TBM-01", sku: "P-215-65R17", quantity: 150 },
  { date: "2024-07-28", shift: "A", operator: "Jane Smith", tbm: "TBM-02", sku: "P-215-65R17", quantity: 145 },
  { date: "2024-07-28", shift: "B", operator: "Peter Jones", tbm: "TBM-01", sku: "LT-245-75R16", quantity: 120 },
  { date: "2024-07-29", shift: "A", operator: "John Doe", tbm: "TBM-01", sku: "P-215-65R17", quantity: 155 },
  { date: "2024-07-29", shift: "B", operator: "Mary Williams", tbm: "TBM-03", sku: "P-235-60R18", quantity: 160 },
];

const mockOeeData = {
  overall: 75.8,
  availability: 92.5,
  performance: 85.3,
  quality: 96.1,
};

const oeeChartData = [
  { name: 'Availability', value: mockOeeData.availability, fill: "var(--color-availability)" },
  { name: 'Performance', value: mockOeeData.performance, fill: "var(--color-performance)" },
  { name: 'Quality', value: mockOeeData.quality, fill: "var(--color-quality)" },
]

const oeeChartConfig = {
  value: { label: "Value" },
  availability: { label: "Availability", color: "hsl(var(--primary))" },
  performance: { label: "Performance", color: "hsl(var(--accent))" },
  quality: { label: "Quality", color: "hsl(var(--secondary))" },
} satisfies ChartConfig

const mockBreakdownData = [
  { date: "2024-07-29", machine: "TBM-05", duration: "45 mins", reason: "Mechanical Failure: Belt snapped" },
  { date: "2024-07-29", machine: "TBM-12", duration: "1 hr 15 mins", reason: "Tooling Changeover" },
  { date: "2024-07-28", machine: "TBM-01", duration: "25 mins", reason: "Electrical Issue: Sensor malfunction" },
  { date: "2024-07-28", machine: "TBM-21", duration: "30 mins", reason: "No Material" },
];


export default function ReportsPage() {
    const { toast } = useToast();
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -7),
        to: new Date(),
    })

    const handleExport = () => {
        toast({
            title: "Exporting Report",
            description: "Your report is being generated and will be downloaded shortly.",
        })
    }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Advanced Reporting & Analytics</h1>
        <p className="text-muted-foreground">Analyze production data, OEE, and machine breakdowns.</p>
      </div>
      
      <Tabs defaultValue="production">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="production">Production Report</TabsTrigger>
            <TabsTrigger value="oee">OEE Analysis</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown Log</TabsTrigger>
          </TabsList>
          <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export to Excel</Button>
        </div>

        <TabsContent value="production">
          <Card>
            <CardHeader>
              <CardTitle>Production Report Filters</CardTitle>
              <CardDescription>Filter the production data to generate your detailed report.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-2">
                        <Label>Date range</Label>
                        <DateRangePicker date={date} setDate={setDate} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Shift</Label>
                        <Select>
                        <SelectTrigger><SelectValue placeholder="All Shifts" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Shifts</SelectItem>
                            <SelectItem value="day">Day Shift</SelectItem>
                            <SelectItem value="night">Night Shift</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Operator</Label>
                        <Select>
                        <SelectTrigger><SelectValue placeholder="All Operators" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Operators</SelectItem>
                            {initialOperators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>TBM</Label>
                        <Select>
                        <SelectTrigger><SelectValue placeholder="All TBMs" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All TBMs</SelectItem>
                            {initialMachines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button><Filter className="mr-2 h-4 w-4"/>Apply Filters</Button>
                </div>
            </CardContent>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Production Summary</CardTitle>
              <CardDescription>Detailed report based on your filter selection.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>TBM</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReportData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.shift}</TableCell>
                      <TableCell className="font-medium">{row.operator}</TableCell>
                      <TableCell>{row.tbm}</TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oee">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall OEE</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockOeeData.overall}%</div>
                <p className="text-xs text-muted-foreground">World-class OEE is 85% or higher</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Availability</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockOeeData.availability}%</div>
                <p className="text-xs text-muted-foreground">Measures downtime losses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockOeeData.performance}%</div>
                <p className="text-xs text-muted-foreground">Measures speed losses</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality</CardTitle>
                <Check className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockOeeData.quality}%</div>
                <p className="text-xs text-muted-foreground">Measures quality losses</p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>OEE Component Breakdown</CardTitle>
              <CardDescription>Visualize the three factors contributing to OEE.</CardDescription>
            </CardHeader>
            <CardContent>
               <ChartContainer config={oeeChartConfig} className="min-h-[200px] w-full">
                <BarChart accessibilityLayer data={oeeChartData} layout="vertical" margin={{ left: 10 }}>
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <XAxis dataKey="value" type="number" hide />
                  <CartesianGrid horizontal={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="line" />}
                  />
                  <Bar dataKey="value" radius={5}>
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Machine Breakdown Log</CardTitle>
              <CardDescription>A log of all machine downtime events.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockBreakdownData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="font-medium">{row.machine}</TableCell>
                      <TableCell>{row.duration}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DateRangePicker({
  className,
  date,
  setDate,
}: React.HTMLAttributes<HTMLDivElement> & { date: DateRange | undefined, setDate: (date: DateRange | undefined) => void }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
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
  )
}
