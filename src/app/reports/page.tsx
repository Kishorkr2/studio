
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Search, FileDown, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import * as actions from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { ReportDataRow } from "@/lib/types";
import { Loader } from "@/components/ui/loader";

export default function GTReportDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ReportDataRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedLogs = await actions.getProductionLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load reports",
        description: "Could not fetch production data from the database.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const filteredSavedEntries = useMemo(() => {
    return logs.filter((e) => {
      const term = searchTerm.toLowerCase();
      return (
        e.machineName?.toLowerCase().includes(term) ||
        e.operatorName?.toLowerCase().includes(term) ||
        e.sku?.toLowerCase().includes(term) ||
        e.quantity.toString().includes(term)
      );
    });
  }, [logs, searchTerm]);

  const totalSavedQuantity = useMemo(() => {
    return filteredSavedEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  }, [filteredSavedEntries]);

  const tbmNumbers = useMemo(() => {
    return [...new Set(logs.map(l => l.machineName).filter(Boolean))];
  }, [logs]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredSavedEntries.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No data to export',
      });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredSavedEntries.map(e => ({
      'TBM No': e.machineName,
      'Operator': e.operatorName,
      'SKU': e.sku,
      'Quantity': e.quantity,
      'Date': e.date,
      'Shift': e.shift,
      'Hour': e.round,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RTPMS Report");
    XLSX.writeFile(wb, "RTPMS_Report.xlsx");
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-xl border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 via-pink-50 to-white">
        <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-extrabold text-purple-700 tracking-wide">
              📊 Production Report
            </h2>
            <span className="bg-purple-200 text-purple-800 text-xs font-bold px-3 py-1 rounded-full shadow">
              {filteredSavedEntries.length} Records
            </span>
          </div>

          <div className="flex items-center gap-3">
             <Button
                onClick={handleExportExcel}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <FileDown className="mr-2 h-4 w-4" /> Export Excel
              </Button>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-white border-purple-300 focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <Button
              variant="outline"
              className="border-purple-400 text-purple-700 hover:bg-purple-100"
              onClick={() => setSearchTerm("")}
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-semibold opacity-90">Total Entries</h3>
              <p className="text-2xl font-bold mt-1">{filteredSavedEntries.length}</p>
            </div>

            <div className="bg-gradient-to-r from-green-400 to-teal-500 text-white rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-semibold opacity-90">Total Quantity</h3>
              <p className="text-2xl font-bold mt-1">{totalSavedQuantity.toLocaleString()}</p>
            </div>

            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-semibold opacity-90">Active Machines</h3>
              <p className="text-2xl font-bold mt-1">{tbmNumbers.length}</p>
            </div>
          </div>
          
           <Card>
              <CardHeader>
                <CardTitle className="text-lg text-purple-700">SKU Wise Production</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                      Object.values(
                        filteredSavedEntries.reduce((acc, curr) => {
                          if (!curr.sku) return acc;
                          if (!acc[curr.sku]) acc[curr.sku] = { sku: curr.sku, quantity: 0 };
                          acc[curr.sku].quantity += curr.quantity;
                          return acc;
                        }, {} as Record<string, { sku: string; quantity: number }>)
                      )
                  }>
                    <XAxis dataKey="sku" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="rgba(139, 92, 246, 0.8)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          <div className="overflow-hidden rounded-xl border border-purple-200 shadow-md">
            <Table>
              <TableHeader className="bg-purple-100">
                <TableRow>
                  <TableHead className="font-semibold text-purple-700">TBM No</TableHead>
                  <TableHead className="font-semibold text-purple-700">Operator</TableHead>
                  <TableHead className="font-semibold text-purple-700">SKU</TableHead>
                  <TableHead className="text-right font-semibold text-purple-700">Quantity</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredSavedEntries.length > 0 ? (
                  filteredSavedEntries.map((entry, index) => (
                    <TableRow
                      key={`${entry.date}-${entry.round}-${entry.machineId}-${entry.sapCode}-${index}`}
                      className={`transition hover:scale-[1.01] hover:bg-gradient-to-r ${
                        index % 2 === 0
                          ? "from-purple-50 to-pink-50"
                          : "from-white to-purple-50"
                      }`}
                    >
                      <TableCell className="font-medium">{entry.machineName}</TableCell>
                      <TableCell>{entry.operatorName}</TableCell>
                      <TableCell>{entry.sku}</TableCell>
                      <TableCell className="text-right font-bold text-purple-600">
                        {entry.quantity}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-gray-500 italic">
                      No matching records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
