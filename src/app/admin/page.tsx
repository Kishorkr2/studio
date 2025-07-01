
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
import { Edit, PlusCircle, Trash, UploadCloud, FileSpreadsheet, X, ShieldAlert, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>(initialShifts);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(initialProductionPlan);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  
  const [editingPlan, setEditingPlan] = useState<ProductionPlanItem | null>(null);
  const [newSku, setNewSku] = useState('');
  const [password, setPassword] = useState('');

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
    if (!item.machineId || item.skus.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Machine must be selected and at least one SKU must be added.' });
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
    setEditingPlan({...item, skus: [...item.skus]});
  };
  
  const startAdding = () => {
    setEditingPlan({ machineId: '', skus: [] });
  };
  
  const handleAddSkuToPlan = () => {
    if (newSku && editingPlan && !editingPlan.skus.includes(newSku)) {
        setEditingPlan({ ...editingPlan, skus: [...editingPlan.skus, newSku] });
        setNewSku('');
    }
  };

  const handleRemoveSkuFromPlan = (skuToRemove: string) => {
      if (editingPlan) {
          setEditingPlan({ ...editingPlan, skus: editingPlan.skus.filter(s => s !== skuToRemove) });
      }
  };

  const handleClearDataConfirm = () => {
    // This is only callable when password is correct due to `disabled` prop
    toast({
      title: 'Success!',
      description: 'All production data has been cleared.',
    });
    // In a real app, this would trigger an API call to the backend.
    setPassword(''); // Reset password after action
  };

  const handleMachineChange = (id: string, field: 'name', value: string) => {
    setMachines(current => current.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSaveMachines = () => {
      toast({
          title: 'Machines Updated',
          description: 'Machine names have been saved successfully.',
      });
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="operators">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="operators">Operator Management</TabsTrigger>
          <TabsTrigger value="machines">Machine Management</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
          <TabsTrigger value="plan">Production Plan</TabsTrigger>
          <TabsTrigger value="upload">Data Upload</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
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

        <TabsContent value="machines">
          <Card>
            <CardHeader>
              <CardTitle>Machine Management</CardTitle>
              <CardDescription>Edit the names of your TBMs.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Editable Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machines.map((machine) => (
                      <TableRow key={machine.id}>
                        <TableCell className="font-mono w-40">{machine.id}</TableCell>
                        <TableCell>
                          <Input 
                            value={machine.name}
                            onChange={(e) => handleMachineChange(machine.id, 'name', e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSaveMachines}><Save className="mr-2 h-4 w-4"/>Save Machine Changes</Button>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="machine-select">Machine</Label>
                      <Select
                        value={editingPlan.machineId}
                        onValueChange={(value) => setEditingPlan({...editingPlan, machineId: value})}
                        disabled={!!editingPlan.machineId && productionPlan.some(p => p.machineId === editingPlan.machineId)}
                      >
                        <SelectTrigger id="machine-select">
                          <SelectValue placeholder="Select a machine" />
                        </SelectTrigger>
                        <SelectContent>
                           {machines.filter(m => !productionPlan.some(p => p.machineId === m.id) || m.id === editingPlan.machineId).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned SKUs</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input value={newSku} onChange={e => setNewSku(e.target.value)} placeholder="Enter new SKU"/>
                          <Button onClick={handleAddSkuToPlan}><PlusCircle className="h-4 w-4 mr-2"/> Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[40px]">
                            {editingPlan.skus.length > 0 ? editingPlan.skus.map(sku => (
                                <Badge key={sku} variant="secondary" className="flex items-center gap-1">
                                    {sku}
                                    <button onClick={() => handleRemoveSkuFromPlan(sku)} className="rounded-full hover:bg-muted-foreground/20">
                                        <X className="h-3 w-3"/>
                                    </button>
                                </Badge>
                            )) : <p className="text-sm text-muted-foreground">No SKUs added yet.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                      <Button onClick={() => handleSavePlanItem(editingPlan)}>Save Plan</Button>
                      <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancel</Button>
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
                      <TableHead>Assigned SKUs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionPlan.map((item) => (
                      <TableRow key={item.machineId}>
                        <TableCell>{item.machineId}</TableCell>
                        <TableCell>{machines.find(m => m.id === item.machineId)?.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.skus.map(sku => <Badge key={sku} variant="secondary">{sku}</Badge>)}
                          </div>
                        </TableCell>
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
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Drop your file here or click to upload</h3>
                <p className="mt-1 text-sm text-muted-foreground">Supports: .xls, .xlsx</p>
                <Input id="file-upload" type="file" className="sr-only" onChange={handleFileUpload} accept=".xls,.xlsx" />
                <Button asChild className="mt-4">
                  <Label htmlFor="file-upload"><FileSpreadsheet className="mr-2 h-4 w-4" />Select File</Label>
                </Button>
              </div>
              <div>
                <h4 className="text-lg font-semibold">File Format Template</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Your Excel file should contain three columns: <strong>SKU</strong>, <strong>SAP Code</strong>, and <strong>Demand</strong>. The first row must be the header.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>SAP Code</TableHead>
                        <TableHead>Demand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">P-215-65R17</TableCell>
                        <TableCell className="font-mono">S4P-87321</TableCell>
                        <TableCell className="font-mono">5000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">LT-245-75R16</TableCell>
                        <TableCell className="font-mono">S4P-87322</TableCell>
                        <TableCell className="font-mono">3500</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">P-235-60R18</TableCell>
                        <TableCell className="font-mono">S4P-87323</TableCell>
                        <TableCell className="font-mono">4200</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Manage advanced and dangerous application settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
                <h4 className="font-semibold text-destructive">Dangerous Actions</h4>
                <p className="text-sm text-destructive/80 mt-1 mb-4">These actions are irreversible. Please proceed with caution.</p>
                <AlertDialog onOpenChange={(open) => { if (!open) setPassword('') }}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"><ShieldAlert className="mr-2 h-4 w-4"/>Clear All Production Data</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all production log data. 
                        Please type <strong>admin123</strong> to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="clear-data-password" className="sr-only">Password</Label>
                        <Input 
                            id="clear-data-password" 
                            type="password" 
                            placeholder="Enter password to confirm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleClearDataConfirm} 
                        disabled={password !== 'admin123'}
                      >
                        Confirm & Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
