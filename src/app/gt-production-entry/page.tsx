"use client";

import { useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker"; // Assuming this component exists
import { Trash2, Factory } from "lucide-react";

// Mock data for dropdowns
const tbmNumbers = ["TBM-01", "TBM-02", "TBM-03"];
const operators = ["Operator A", "Operator B", "Operator C"];
const skus = ["SKU-123", "SKU-456", "SKU-789"];

// Mock data for saved entries
const savedEntriesData = [
  {
    id: 1,
    tbmNo: "TBM-01",
    operator: "Operator A",
    sku: "SKU-123",
    quantity: 100,
  },
  {
    id: 2,
    tbmNo: "TBM-02",
    operator: "Operator B",
    sku: "SKU-456",
    quantity: 150,
  },
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

  const handleEntryChange = (
    id: number,
    field: keyof Omit<NewEntry, "id">,
    value: string
  ) => {
    setNewEntries(
      newEntries.map((entry) =>
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
    setNewEntries(newEntries.filter((entry) => entry.id !== id));
  };

  const handleSaveAllEntries = () => {
    // For now, we'll just log the entries to the console.
    // In a real application, this would send the data to a server.
    console.log("Saving new entries:", newEntries);
    alert("Entries saved! Check the console for the data.");
    // Optionally, clear the new entries form after saving
    setNewEntries([{ id: 1, tbmNo: "", operator: "", sku: "", quantity: "" }]);
  };

  const totalSavedQuantity = savedEntriesData.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center space-x-4">
        <Factory className="w-8 h-8" />
        <h1 className="text-2xl font-bold">GT Production Entry</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div>
            <label>Date</label>
            <DatePicker />
          </div>
          <div>
            <label>Shift</label>
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
            <label>Hour</label>
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {newEntries.map((entry, index) => (
              <div key={entry.id} className="flex items-center space-x-2">
                <Select
                  value={entry.tbmNo}
                  onValueChange={(value) =>
                    handleEntryChange(entry.id, "tbmNo", value)
                  }
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  placeholder="Quantity"
                  className="w-24"
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
          <Button onClick={handleAddEntry} className="mt-4">
            ADD ENTRY
          </Button>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSaveAllEntries}>
          SAVE ALL ENTRIES
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Saved Entries ({savedEntriesData.length} records)</CardTitle>
          <div className="text-sm font-bold bg-secondary text-secondary-foreground px-2 py-1 rounded">
            Total Qty: {totalSavedQuantity}
          </div>
        </CardHeader>
        <CardContent>
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
              {savedEntriesData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.tbmNo}</TableCell>
                  <TableCell>{entry.operator}</TableCell>
                  <TableCell>{entry.sku}</TableCell>
                  <TableCell className="text-right">{entry.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
