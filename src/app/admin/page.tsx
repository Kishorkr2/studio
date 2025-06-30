
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Operator, ProductionPlanItem, Machine, ShiftInfo } from '@/lib/types';
import { initialOperators, shifts as initialShifts, initialProductionPlan, initialMachines } from '@/lib/data';
import { Edit, PlusCircle, Trash, UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>(initialShifts);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(initialProductionPlan);
  const [allMachines] = useState<Machine[]>(initialMachines);
  
  const [editingPlan, setEditingPlan] = useState<ProductionPlanItem | null>(null);

  const { toast } = useToast();

  const handleAddOperator = () => {
    const newId = `OP-${String(operators.length + 1).padStart(3, '0')}`;
    setOperators([...operators, { id: newId, name: 'New Operator', skillRating: 3, isAbsent: false }]);
  };
  
  const handleShiftChange = (index: number, field: keyof ShiftInfo, value: string) => {
    setManagedShifts(currentShifts => 
        currentShifts.map((shift, i) => 
            i === index ? { ...shift, [field]: value } : shift
        )
    );
  };

  const handleSaveShifts = () => {
    toast({
      title: 'Shifts Updated',
      description: `All shift times have been saved successfully.`,
    });
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast({
        title: 'File Uploaded',
        description: `${file.name} is ready for processing.`,
      });
    }
  };

  const handleSavePlanItem = (item: ProductionPlanItem) => {
    if (!item.machineId || !item.sku) {
      toast({ variant: 'destructive', title: 'Error', description: 'Machine and SKU cannot be empty.' });
      return;
    }
    
    setProductionPlan(prev => {
      const existing = prev.find(p => p.machineId === item.machineId);
      if (existing) {
        return prev.map(p => p.machineId === item.machineId ? item : p);
      }
      return [...prev, item];
    });

    toast({ title: 'Plan Saved', description: `Production plan for ${item.machineId} has been updated.`});
    setEditingPlan(null);
  };

  const handleDeletePlanItem = (machineId: string) => {
    setProductionPlan(prev => prev.filter(p => p.machineId !== machineId));
    toast({ title: 'Plan Item Removed', description: `Plan for ${machineId} has been removed.`});
  };

  const startEditing = (item: ProductionPlanItem) => {
    setEditingPlan({...item});
  };
  
  const startAdding = () => {
    setEditingPlan({ machineId: '', sku: '' });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="operators">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operators">Operator Management</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
          <TabsTrigger value="plan">Production Plan</TabsTrigger>
          <TabsTrigger value="upload">Data Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <CardTitle>Operators</CardTitle>
              <CardDescription>Manage your list of approved operators.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Skill Rating</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operators.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>{op.id}</TableCell>
                      <TableCell className="font-medium">{op.name}</TableCell>
                      <TableCell>{op.skillRating}/5</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon"><Trash className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <Button onClick={handleAddOperator}><PlusCircle className="mr-2 h-4 w-4" /> Add Operator</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>Shift Management</CardTitle>
              <CardDescription>Set the timings for the day and night shifts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {managedShifts.map((s, index) => (
                <div key={s.name} className="p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">{s.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`start-time-${index}`}>Start Time</Label>
                      <Input
                        id={`start-time-${index}`}
                        type="time"
                        value={s.startTime}
                        onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end-time-${index}`}>End Time</Label>
                      <Input
                        id={`end-time-${index}`}
                        type="time"
                        value={s.endTime}
                        onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveShifts}>Save All Shifts</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle>Production Plan</CardTitle>
              <CardDescription>Assign SKUs to machines for production.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {editingPlan ? (
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-semibold text-lg">{productionPlan.some(p => p.machineId === editingPlan.machineId) ? 'Edit Plan' : 'Add Plan'}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="machine-select">Machine</Label>
                        <Select
                          value={editingPlan.machineId}
                          onValueChange={(value) => setEditingPlan({...editingPlan, machineId: value})}
                          disabled={productionPlan.some(p => p.machineId === editingPlan.machineId)}
                        >
                          <SelectTrigger id="machine-select">
                            <SelectValue placeholder="Select a machine" />
                          </SelectTrigger>
                          <SelectContent>
                             {allMachines.filter(m => !productionPlan.some(p => p.machineId === m.id) || m.id === editingPlan.machineId).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sku-input">SKU</Label>
                        <Input id="sku-input" value={editingPlan.sku} onChange={(e) => setEditingPlan({...editingPlan, sku: e.target.value})} placeholder="Enter SKU"/>
                      </div>
                      <div className="flex gap-2">
                         <Button onClick={() => handleSavePlanItem(editingPlan)}>Save</Button>
                         <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancel</Button>
                      </div>
                   </div>
                </div>
              ) : (
                <Button onClick={startAdding}><PlusCircle className="mr-2 h-4 w-4"/>Add Plan Item</Button>
              )}
              
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Machine ID</TableHead>
                      <TableHead>Machine Name</TableHead>
                      <TableHead>Assigned SKU</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionPlan.map((item) => (
                      <TableRow key={item.machineId}>
                        <TableCell>{item.machineId}</TableCell>
                        <TableCell>{allMachines.find(m => m.id === item.machineId)?.name}</TableCell>
                        <TableCell className="font-medium">{item.sku}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => startEditing(item)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePlanItem(item.machineId)}><Trash className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Market Requirements</CardTitle>
              <CardDescription>Upload Excel files containing market requirement data.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Drop your file here or click to upload</h3>
                <p className="mt-1 text-sm text-muted-foreground">Supports: .xls, .xlsx</p>
                <Input id="file-upload" type="file" className="sr-only" onChange={handleFileUpload} accept=".xls,.xlsx" />
                <Button asChild className="mt-4">
                  <Label htmlFor="file-upload"><FileSpreadsheet className="mr-2 h-4 w-4" />Select File</Label>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
