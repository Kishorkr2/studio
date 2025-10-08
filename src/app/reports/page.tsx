'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search } from 'lucide-react';
import * as actions from '../actions';
import type { ReportDataRow } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@/components/ui/loader';

export default function ReportsPage() {
  const [allEntries, setAllEntries] = React.useState<ReportDataRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const logs = await actions.getProductionLogs();
        setAllEntries(logs);
      } catch (error) {
        console.error('Failed to load report data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load report data.',
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast]);

  const filteredSavedEntries = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return allEntries;
    return allEntries.filter(
      (e) =>
        e.machineName.toLowerCase().includes(term) ||
        e.operatorName?.toLowerCase().includes(term) ||
        e.sku.toLowerCase().includes(term) ||
        e.quantity.toString().toLowerCase().includes(term)
    );
  }, [searchTerm, allEntries]);

  const totalSavedQuantity = React.useMemo(() => {
    return filteredSavedEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  }, [filteredSavedEntries]);

  const tbmNumbers = React.useMemo(() => {
    const machineNames = filteredSavedEntries.map((e) => e.machineName);
    return [...new Set(machineNames)];
  }, [filteredSavedEntries]);


  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Modern Report Section */}
      <Card className="shadow-xl border-l-4 border-purple-500 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950/50 dark:via-pink-950/50 dark:to-background">
        <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-center space-y-3 md:space-y-0 p-6">
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-extrabold text-purple-700 dark:text-purple-300 tracking-wide">
              📊 Production Report
            </h2>
            <span className="bg-purple-200 text-purple-800 text-xs font-bold px-3 py-1 rounded-full shadow">
              {filteredSavedEntries.length} Records
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-purple-300 dark:bg-background/50 dark:border-purple-700 focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <Button
              variant="outline"
              className="border-purple-400 text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/50"
              onClick={() => setSearchTerm("")}
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 shadow-lg">
              <h3 className="text-sm font-semibold opacity-90">Total Entries</h3>
              <p className="text-2xl font-bold mt-1">{filteredSavedEntries.length.toLocaleString()}</p>
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

          {/* Animated Table */}
          <div className="overflow-hidden rounded-xl border border-purple-200 dark:border-purple-800 shadow-md">
            <div className="max-h-[55vh] overflow-y-auto">
                <Table>
                <TableHeader className="bg-purple-100 dark:bg-purple-950/50 sticky top-0">
                    <TableRow>
                    <TableHead className="font-semibold text-purple-700 dark:text-purple-300">TBM No</TableHead>
                    <TableHead className="font-semibold text-purple-700 dark:text-purple-300">Operator</TableHead>
                    <TableHead className="font-semibold text-purple-700 dark:text-purple-300">SKU</TableHead>
                    <TableHead className="text-right font-semibold text-purple-700 dark:text-purple-300">Quantity</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {filteredSavedEntries.length > 0 ? (
                    filteredSavedEntries.map((entry, index) => (
                        <TableRow
                        key={`${entry.date}-${entry.shift}-${entry.round}-${entry.machineId}-${entry.sapCode}-${index}`}
                        className={`transition hover:bg-purple-100/50 dark:hover:bg-purple-900/50 ${
                            index % 2 === 0
                            ? "bg-purple-50/50 dark:bg-transparent"
                            : "bg-white dark:bg-white/5"
                        }`}
                        >
                        <TableCell className="font-medium">{entry.machineName}</TableCell>
                        <TableCell>{entry.operatorName}</TableCell>
                        <TableCell>{entry.sku}</TableCell>
                        <TableCell className="text-right font-bold text-purple-600 dark:text-purple-400">
                            {entry.quantity}
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-gray-500 italic">
                        No matching records found.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
