"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Download, Filter } from "lucide-react"
import { addDays, format } from "date-fns"
import { DateRange } from "react-day-picker"

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
import { useToast } from "@/hooks/use-toast"

const mockReportData = [
  { date: "2024-07-28", shift: "A", operator: "John Doe", tbm: "TBM-01", sku: "P-215-65R17", quantity: 150 },
  { date: "2024-07-28", shift: "A", operator: "Jane Smith", tbm: "TBM-02", sku: "P-215-65R17", quantity: 145 },
  { date: "2024-07-28", shift: "B", operator: "Peter Jones", tbm: "TBM-01", sku: "LT-245-75R16", quantity: 120 },
  { date: "2024-07-29", shift: "A", operator: "John Doe", tbm: "TBM-01", sku: "P-215-65R17", quantity: 155 },
  { date: "2024-07-29", shift: "B", operator: "Mary Williams", tbm: "TBM-03", sku: "P-235-60R18", quantity: 160 },
];

export default function ReportsPage() {
    const { toast } = useToast();
    const [date, setDate] = React.useState&lt;DateRange | undefined&gt;({
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
      <h1 className="text-3xl font-bold tracking-tight">Advanced Reporting</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter the production data to generate your report.</CardDescription>
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
                        <SelectItem value="a">Shift A</SelectItem>
                        <SelectItem value="b">Shift B</SelectItem>
                        <SelectItem value="c">Shift C</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>Operator</Label>
                    <Select>
                    <SelectTrigger><SelectValue placeholder="All Operators" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Operators</SelectItem>
                        <SelectItem value="john">John Doe</SelectItem>
                        <SelectItem value="jane">Jane Smith</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>TBM</Label>
                    <Select>
                    <SelectTrigger><SelectValue placeholder="All TBMs" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All TBMs</SelectItem>
                        <SelectItem value="tbm1">TBM-01</SelectItem>
                        <SelectItem value="tbm2">TBM-02</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
                <Button variant="outline"><Filter className="mr-2 h-4 w-4"/>Apply Filters</Button>
                <Button onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export to Excel</Button>
            </div>
        </CardContent>
      </Card>
      
      <Card>
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
    </div>
  )
}

function Label({ children, ...props }: React.ComponentProps&lt;"label"&gt;) {
    return (
        &lt;label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" {...props}&gt;
            {children}
        &lt;/label&gt;
    )
}

function DateRangePicker({
  className,
  date,
  setDate,
}: React.HTMLAttributes&lt;HTMLDivElement&gt; &amp; { date: DateRange | undefined, setDate: (date: DateRange | undefined) =&gt; void }) {
  return (
    &lt;div className={cn("grid gap-2", className)}&gt;
      &lt;Popover&gt;
        &lt;PopoverTrigger asChild&gt;
          &lt;Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date &amp;&amp; "text-muted-foreground"
            )}
          &gt;
            &lt;CalendarIcon className="mr-2 h-4 w-4" /&gt;
            {date?.from ? (
              date.to ? (
                &lt;&gt;
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                &lt;/&gt;
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              &lt;span&gt;Pick a date&lt;/span&gt;
            )}
          &lt;/Button&gt;
        &lt;/PopoverTrigger&gt;
        &lt;PopoverContent className="w-auto p-0" align="start"&gt;
          &lt;Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          /&gt;
        &lt;/PopoverContent&gt;
      &lt;/Popover&gt;
    &lt;/div&gt;
  )
}
