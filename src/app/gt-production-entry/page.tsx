"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Trash2,
  Factory,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Clock,
  BarChart3,
} from "lucide-react";

// Mock dropdown data
const tbmNumbers = ["TBM-01", "TBM-02", "TBM-03", "TBM-04"];
const operators = ["Operator A", "Operator B", "Operator C"];
const skus = ["SKU-123", "SKU-456", "SKU-789"];

type NewEntry = {
  id: number;
  tbmNo: string;
  operator: string;
  sku: string;
  quantity: string;
  hour: string;
  shift: string;
};

export default function GTProductionEntry() {
  const [newEntries, setNewEntries] = useState<NewEntry[]>([
    { id: 1, tbmNo: "", operator: "", sku: "", quantity: "", hour: "", shift: "" },
  ]);
  const [showEntries, setShowEntries] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  // Mock saved entries
  const savedEntriesData = [
    { id: 1, tbmNo: "TBM-01", operator: "Operator A", sku: "SKU-123", quantity: 100, hour: "10", shift: "Day" },
    { id: 2, tbmNo: "TBM-02", operator: "Operator B", sku: "SKU-456", quantity: 150, hour: "11", shift: "Day" },
  ];

  const totalShiftProduction = savedEntriesData.reduce((sum, entry) => sum + entry.quantity, 0);
  const hourlyProduction = useMemo(() => {
    const grouped: { [hour: string]: number } = {};
    savedEntriesData.forEach((e) => {
      grouped[e.hour] = (grouped[e.hour] || 0) + e.quantity;
    });
    return grouped;
  }, []); // Removed savedEntriesData from dependency array to use mock data

  const handleEntryChange = (id: number, field: keyof Omit<NewEntry, "id">, value: string) => {
    setNewEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  const handleAddEntry = () => {
    setNewEntries([
      ...newEntries,
      { id: Date.now(), tbmNo: "", operator: "", sku: "", quantity: "", hour: "", shift: "" },
    ]);
  };

  const handleDeleteEntry = (id: number) => {
    setNewEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSaveAllEntries = () => {
    console.log("Saved entries:", newEntries);
    alert("Entries saved successfully!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-100 to-purple-100 p-6 space-y-6">
      {/* Header Dashboard */}
      <div className="bg-gradient-to-r from-blue-700 via-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center space-x-4">
          <Factory className="w-10 h-10 drop-shadow-md" />
          <h1 className="text-3xl font-extrabold tracking-wide drop-shadow-lg">
            GT Production Entry
          </h1>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <div className="bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Shift Prod: {totalShiftProduction}</span>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Active TBM: {tbmNumbers.length}</span>
          </div>
        </div>
      </div>

      {/* Production Entry Form */}
      <Card className="shadow-md border-l-4 border-green-400 bg-gradient-to-r from-white to-green-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowEntries(!showEntries)}
        >
          <CardTitle className="text-green-700 font-bold flex items-center space-x-2">
            <span>Production Entries</span>
            {showEntries ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>

        {showEntries && (
          <CardContent>
            <div className="space-y-4">
              {newEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition"
                >
                  <Select
                    value={entry.tbmNo}
                    onValueChange={(value) => handleEntryChange(entry.id, "tbmNo", value)}
                  >
                    <SelectTrigger className="w-[120px] bg-blue-50">
                      <SelectValue placeholder="TBM No" />
                    </SelectTrigger>
                    <SelectContent>
                      {tbmNumbers.map((tbm) => (
                        <SelectItem key={tbm} value={tbm}>
                          {tbm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.operator}
                    onValueChange={(value) => handleEntryChange(entry.id, "operator", value)}
                  >
                    <SelectTrigger className="w-[150px] bg-green-50">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.sku}
                    onValueChange={(value) => handleEntryChange(entry.id, "sku", value)}
                  >
                    <SelectTrigger className="w-[140px] bg-purple-50">
                      <SelectValue placeholder="SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map((sku) => (
                        <SelectItem key={sku} value={sku}>
                          {sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    placeholder="Qty"
                    className="w-[80px] text-center"
                    value={entry.quantity}
                    onChange={(e) => handleEntryChange(entry.id, "quantity", e.target.value)}
                  />

                  <Select
                    value={entry.shift}
                    onValueChange={(value) => handleEntryChange(entry.id, "shift", value)}
                  >
                    <SelectTrigger className="w-[100px] bg-yellow-50">
                      <SelectValue placeholder="Shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={entry.hour}
                    onValueChange={(value) => handleEntryChange(entry.id, "hour", value)}
                  >
                    <SelectTrigger className="w-[100px] bg-pink-50">
                      <SelectValue placeholder="Hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={`${i + 9}`}>
                          {`${i + 9}:00`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleSaveAllEntries} className="mt-6 bg-green-600 hover:bg-green-700">
              SAVE ENTRIES
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Hourly Production Summary */}
      <Card className="shadow-md border-l-4 border-blue-400 bg-gradient-to-r from-white to-blue-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowSaved(!showSaved)}
        >
          <CardTitle className="text-blue-700 font-bold flex items-center space-x-2">
            <span>Hourly Production Summary</span>
            {showSaved ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>

        {showSaved && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hour</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(hourlyProduction).map(([hour, qty]) => (
                  <TableRow key={hour} className="hover:bg-blue-100 transition">
                    <TableCell>{hour}:00</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">
                      {qty}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Floating Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full p-5 shadow-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:scale-105 transition-transform"
        onClick={handleAddEntry}
      >
        <PlusCircle className="mr-2" /> Add Entry
      </Button>
    </div>
  );
}
