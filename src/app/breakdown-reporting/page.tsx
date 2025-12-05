
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wrench, Download, Clock, BarChart3, CalendarIcon } from "lucide-react";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import * as actions from '../actions';
import type { Machine, ShiftInfo } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function BreakdownReportingPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [shifts, setShifts] = useState<ShiftInfo[]>([]);
  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<ShiftInfo | undefined>();

  const [formData, setFormData] = useState({
    machine: "",
    startTime: "",
    endTime: "",
    reason: "",
  });

  // Fetch Initial Data
  useEffect(() => {
    actions.getMachines().then((data) => setMachines(data));
    actions.getShifts().then((data) => {
      setShifts(data);
      setSelectedShift(data[0]);
    });
  }, []);

  // Calculate downtime automatically
  const calculateDowntime = () => {
    if (!formData.startTime || !formData.endTime) return "";

    const start = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${formData.startTime}`);
    const end = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${formData.endTime}`);
    let diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) {
        // Handle overnight shifts
        const nextDayEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        diffMs = nextDayEnd.getTime() - start.getTime();
    }

    if (diffMs < 0) return "Invalid Time";

    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${remainingMins}m`;
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();

    const downtimeText = calculateDowntime();

    const newEntry = {
      id: breakdowns.length + 1,
      ...formData,
      date: format(selectedDate, 'yyyy-MM-dd'),
      shift: selectedShift?.name,
      downtime: downtimeText,
      timestamp: new Date(),
    };

    setBreakdowns([...breakdowns, newEntry]);

    setFormData({
      machine: "",
      startTime: "",
      endTime: "",
      reason: "",
    });
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(breakdowns);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Breakdowns");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer]), "breakdown_report.xlsx");
  };

  // Analytics
  const totalDowntimeMinutes = breakdowns.reduce((sum, b) => {
    if (!b.downtime) return sum;
    const match = b.downtime.match(/(\d+)h\s*(\d+)m/);
    if (match) return sum + parseInt(match[1]) * 60 + parseInt(match[2]);
    const minsOnly = b.downtime.match(/(\d+)m/);
    return minsOnly ? sum + parseInt(minsOnly[1]) : sum;
  }, 0);

  const machineWise = breakdowns.reduce((acc: any, b) => {
    acc[b.machine] = (acc[b.machine] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-100 to-purple-200 p-6">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4 items-center">
            <Wrench className="w-12 h-12 text-purple-600" />
            <div>
              <h1 className="text-4xl font-bold">Breakdown Management</h1>
              <p className="text-gray-600">Smart logging • Auto-time calculation • Analytics</p>
            </div>
          </div>

          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
        </div>

        {/* Analytics */}
        <Card className="shadow-lg border-2 border-purple-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <BarChart3 /> Breakdown Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="p-4 bg-white rounded-xl shadow">
              <h3 className="text-lg font-semibold">Total Breakdowns</h3>
              <p className="text-3xl font-bold text-red-600">{breakdowns.length}</p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow">
              <h3 className="text-lg font-semibold">Total Downtime</h3>
              <p className="text-3xl font-bold text-blue-700">
                {Math.floor(totalDowntimeMinutes / 60)}h {totalDowntimeMinutes % 60}m
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow">
              <h3 className="text-lg font-semibold">Most Affected Machine</h3>
              <p className="text-2xl font-bold text-purple-700">
                {Object.keys(machineWise).length === 0
                  ? "N/A"
                  : Object.entries(machineWise).sort((a: any, b: any) => b[1] - a[1])[0][0]}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="shadow-xl border border-indigo-300">
          <CardHeader>
              <CardTitle className="text-indigo-800">Log New Breakdown</CardTitle>
              <div className="flex items-center gap-4 pt-2">
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              variant={"outline"}
                              className={cn(
                                  "w-[280px] justify-start text-left font-normal",
                                  !selectedDate && "text-muted-foreground"
                              )}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                          <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => setSelectedDate(date || new Date())}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
                  <Select
                      value={selectedShift?.name || ''}
                      onValueChange={(name) => {
                          const shift = shifts.find(s => s.name === name);
                          setSelectedShift(shift);
                      }}
                  >
                      <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                          {shifts.map(s => (
                              <SelectItem key={s.name} value={s.name}>
                                  {s.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Machine */}
              <div>
                <label>Machine</label>
                <Select
                  value={formData.machine}
                  onValueChange={(v) => setFormData({ ...formData, machine: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Time */}
              <div>
                <label>Start Time</label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* End Time */}
              <div>
                <label>End Time</label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* Reason */}
              <div className="md:col-span-2">
                <label>Reason</label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* Auto downtime summary */}
              <div className="md:col-span-2 flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-700" />
                  <p className="font-semibold text-blue-700">
                    Auto Downtime: {calculateDowntime() || "—"}
                  </p>
                </div>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                  Log Breakdown
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Recent Breakdowns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="bg-white">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Downtime</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {breakdowns.map((b) => (
                  <TableRow key={b.id}>
                     <TableCell>{b.date}</TableCell>
                    <TableCell>{b.shift}</TableCell>
                    <TableCell>
                      <Badge className="bg-purple-600 text-white">{b.machine}</Badge>
                    </TableCell>
                    <TableCell>{b.startTime}</TableCell>
                    <TableCell>{b.endTime}</TableCell>
                    <TableCell>
                      <Badge className="bg-red-600 text-white">{b.downtime}</Badge>
                    </TableCell>
                    <TableCell>{b.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>

            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
