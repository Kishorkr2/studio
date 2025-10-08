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
  Search,
  PlusCircle,
} from "lucide-react";

// Mock dropdown data
const tbmNumbers = ["TBM-01", "TBM-02", "TBM-03"];
const operators = ["Operator A", "Operator B", "Operator C"];
const skus = ["SKU-123", "SKU-456", "SKU-789"];

// Mock saved data
const savedEntriesData = [
  { id: 1, tbmNo: "TBM-01", operator: "Operator A", sku: "SKU-123", quantity: 100 },
  { id: 2, tbmNo: "TBM-02", operator: "Operator B", sku: "SKU-456", quantity: 150 },
];

type NewEntry = {
  id: number;
  tbmNo: string;
  operator: string;
  sku: string;
  quantity: string;
};

export default function GTProductionEntryPage() {
  const [newEntries, setNewEntries] = useState<NewEntry[]>([
    { id: 1, tbmNo: "", operator: "", sku: "", quantity: "" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [showEntries, setShowEntries] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  const handleEntryChange = (
    id: number,
    field: keyof Omit<NewEntry, "id">,
    value: string
  ) => {
    setNewEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleAddEntry = () => {
    setNewEntries([
      ...newEntries,
      { id: Date.now(), tbmNo: "", operator: "", sku: "", quantity: "" },
    ]);
  };

  const handleDeleteEntry = (id: number) => {
    setNewEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSaveAllEntries = () => {
    console.log("Saving new entries:", newEntries);
    alert("Entries saved! (Check console)");
    setNewEntries([{ id: 1, tbmNo: "", operator: "", sku: "", quantity: "" }]);
  };

  const totalSavedQuantity = savedEntriesData.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );

  const filteredSavedEntries = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return savedEntriesData.filter(
      (e) =>
        e.tbmNo.toLowerCase().includes(term) ||
        e.operator.toLowerCase().includes(term) ||
        e.sku.toLowerCase().includes(term) ||
        e.quantity.toString().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 via-pink-600 to-blue-600 text-white rounded-2xl p-6 shadow-lg flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Factory className="w-10 h-10 text-white drop-shadow-lg" />
          <h1 className="text-3xl font-extrabold tracking-wide">
            GT Production Entry
          </h1>
        </div>
        <div className="flex space-x-3">
          <div className="bg-white/20 px-3 py-1 rounded-xl text-sm font-semibold">
            Total Tyres: {totalSavedQuantity}
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-xl text-sm font-semibold">
            Active TBM: {tbmNumbers.length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-md border-l-4 border-blue-400 bg-gradient-to-r from-white to-blue-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowFilters(!showFilters)}
        >
          <CardTitle className="text-blue-700 font-bold flex items-center space-x-2">
            <span>Filters</span>
            {showFilters ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>
        {showFilters && (
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-sm text-gray-600">Date</label>
              <DatePicker />
            </div>
            <div>
              <label className="font-semibold text-sm text-gray-600">Shift</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-semibold text-sm text-gray-600">Hour</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select Hour" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={`${i + 1}`}>
                      {`${i + 1}:00`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* New Entries */}
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
                    onValueChange={(value) =>
                      handleEntryChange(entry.id, "tbmNo", value)
                    }
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
                    onValueChange={(value) =>
                      handleEntryChange(entry.id, "operator", value)
                    }
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
                    onValueChange={(value) =>
                      handleEntryChange(entry.id, "sku", value)
                    }
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
                    className="w-[90px] text-center"
                    value={entry.quantity}
                    onChange={(e) =>
                      handleEntryChange(entry.id, "quantity", e.target.value)
                    }
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveAllEntries} className="mt-6 bg-green-600 hover:bg-green-700">
              SAVE ALL ENTRIES
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Saved Entries */}
      <Card className="shadow-md border-l-4 border-purple-400 bg-gradient-to-r from-white to-purple-50">
        <CardHeader
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setShowSaved(!showSaved)}
        >
          <CardTitle className="text-purple-700 font-bold flex items-center space-x-2">
            <span>Saved Entries ({filteredSavedEntries.length})</span>
            {showSaved ? <ChevronUp /> : <ChevronDown />}
          </CardTitle>
        </CardHeader>
        {showSaved && (
          <CardContent>
            <div className="flex items-center mb-3 space-x-2">
              <Search className="text-gray-500" />
              <Input
                placeholder="Search by TBM / Operator / SKU / Qty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TBM No</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSavedEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="hover:bg-purple-100 transition"
                  >
                    <TableCell>{entry.tbmNo}</TableCell>
                    <TableCell>{entry.operator}</TableCell>
                    <TableCell>{entry.sku}</TableCell>
                    <TableCell className="text-right font-semibold text-purple-700">
                      {entry.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* Floating Add Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full p-5 shadow-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:scale-105 transition-transform"
        onClick={handleAddEntry}
      >
        <PlusCircle className="mr-2" /> Add Entry
      </Button>
    </div>
  );
}
