
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Operator, ProductionPlanItem, Machine, ShiftInfo, MarketRequirement } from '@/lib/types';
import { initialOperators, shifts as initialShifts, initialProductionPlan, initialMachines } from '@/lib/data';
import { Edit, PlusCircle, Trash, UploadCloud, FileSpreadsheet, X, ShieldAlert } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import * as XLSX from 'xlsx';

const LOCAL_STORAGE_KEYS = {
  OPERATORS: 'tyretrack-operators',
  SHIFTS: 'tyretrack-shifts',
  PRODUCTION_PLAN: 'tyretrack-production-plan',
  MACHINES: 'tyretrack-machines',
  MARKET_REQUIREMENTS: 'tyretrack-market-requirements',
};

export default function AdminPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  
  const [editingPlan, setEditingPlan] = useState<ProductionPlanItem | null>(null);
  const [newSku, setNewSku] = useState('');
  const [password, setPassword] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    const loadData = () => {
      const loadedOperators = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.OPERATORS) || 'null') || initialOperators;
      setOperators(loadedOperators);

      const loadedShifts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SHIFTS) || 'null') || initialShifts;
      setManagedShifts(loadedShifts);
      
      const loadedPlan = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTION_PLAN) || 'null') || initialProductionPlan;
      setProductionPlan(loadedPlan);

      const loadedMachines = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.MACHINES) || 'null') || initialMachines;
      setMachines(loadedMachines);

      const loadedRequirements = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.MARKET_REQUIREMENTS) || 'null') || [];
      setMarketRequirements(loadedRequirements);
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (operators.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.OPERATORS, JSON.stringify(operators));
    }
  }, [operators]);

  useEffect(() => {
    if (managedShifts.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SHIFTS, JSON.stringify(managedShifts));
    }
  }, [managedShifts]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTION_PLAN, JSON.stringify(productionPlan));
  }, [productionPlan]);

  useEffect(() => {
    if (machines.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.MACHINES, JSON.stringify(machines));
    }
  }, [machines]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.MARKET_REQUIREMENTS, JSON.stringify(marketRequirements));
  }, [marketRequirements]);

  const handleAddOperator = () => {
    const newId = `OP-${String(operators.length + 1).padStart(3, '0')}`;
    setOperators([...operators, { id: newId, name: 'New Operator', skillRating: 3, isAbsent: false }]);
  };

  const handleDeleteOperator = (id: string) => {
    setOperators(ops => ops.filter(op => op.id !== id));
    toast({
        title: "Operator Removed",
        description: `Operator with ID ${id} has been removed.`,
    })
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
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonFromSheet = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsedData: MarketRequirement[] = jsonFromSheet.map(row => ({
            machine: String(row.Machine || ''),
            sapCode: String(row['SAP Code'] || ''),
            sku: String(row.SKU || ''),
            demand: Number(row.Demand || 0),
          }));

          if (parsedData.length > 0 && parsedData[0].sku && parsedData[0].demand) {
             setMarketRequirements(parsedData);
             toast({
                title: 'File Processed Successfully',
                description: `Loaded ${parsedData.length} market requirement records.`,
             });
          } else {
             throw new Error("Invalid file format. Please check headers: Machine, SAP Code, SKU, Demand");
          }
        } catch (error) {
           console.error("Error parsing file: ", error);
           toast({
             variant: 'destructive',
             title: 'File Upload Error',
             description: error instanceof Error ? error.message : 'Could not parse the uploaded file. Please ensure it follows the template.',
           });
        }
      };
      reader.onerror = () => {
        toast({
            variant: 'destructive',
            title: 'File Read Error',
            description: 'There was an error reading the file.',
        });
      };
      reader.readAsArrayBuffer(file);
    }
    if(event.target) {
      event.target.value = '';
    }
  };

  const handleClearRequirements = () => {
    setMarketRequirements([]);
    toast({
        title: "Market Requirements Cleared",
        description: "All uploaded market requirement data has been removed.",
    });
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

    toast({ title: 'Plan Saved', description: `Production plan for ${machines.find(m => m.id === item.machineId)?.name} has been updated.`});
    setEditingPlan(null);
  };

  const handleDeletePlanItem = (machineId: string) => {
    setProductionPlan(prev => prev.filter(p => p.machineId !== machineId));
    toast({ title: 'Plan Item Removed', description: `Plan for ${machines.find(m => m.id === machineId)?.name} has been removed.`});
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
    toast({
      title: 'Success!',
      description: 'All production data has been cleared.',
    });
    setPassword('');
  };

  const handleMachineNameChange = (id: string, newName: string) => {
    setMachines(currentMachines =>
        currentMachines.map(m => (m.id === id ? { ...m, name: newName } : m))
    );
  };

  const handleMachineAvailabilityChange = (id: string, isAvailable: boolean) => {
      setMachines(currentMachines =>
          currentMachines.map(m => (m.id === id ? { ...m, isAvailable } : m))
      );
  };

  const handleSaveMachines = () => {
      toast({
          title: 'Machines Updated',
          description: 'All machine names and statuses have been saved successfully.',
      });
  };

  const handleAddMachine = () => {
      const newId = `TBM-${String(machines.length + 1).padStart(2, '0')}`;
      setMachines([...machines, { id: newId, name: `New Machine ${machines.length + 1}`, isAvailable: true }]);
  };

  const handleDeleteMachine = (id: string) => {
      if (productionPlan.some(p => p.machineId === id)) {
          toast({
              variant: 'destructive',
              title: 'Cannot Delete Machine',
              description: 'This machine is part of an active production plan. Please remove it from the plan first.'
          });
          return;
      }
      setMachines(currentMachines => currentMachines.filter(m => m.id !== id));
      toast({
          title: 'Machine Removed',
          description: `Machine ${id} has been removed.`,
      });
  };


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="operators">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="operators">Operator Management</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
          <TabsTrigger value="plan">Production Plan</TabsTrigger>
          <TabsTrigger value="machines">Machine Management</TabsTrigger>
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
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteOperator(op.id)}><Trash className="h-4 w-4" /></Button>
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

        <TabsContent value="machines">
          <Card>
            <CardHeader>
              <CardTitle>Machine Management</CardTitle>
              <CardDescription>View and edit your machine inventory.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines.map((machine) => (
                    <TableRow key={machine.id}>
                      <TableCell>{machine.id}</TableCell>
                      <TableCell>
                        <Input
                          value={machine.name}
                          onChange={(e) => handleMachineNameChange(machine.id, e.target.value)}
                          className="max-w-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={machine.isAvailable}
                          onCheckedChange={(checked) => handleMachineAvailabilityChange(machine.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => handleDeleteMachine(machine.id)}>
                            <Trash className="h-4 w-4" />
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button onClick={handleAddMachine}><PlusCircle className="mr-2 h-4 w-4"/>Add Machine</Button>
              <Button onClick={handleSaveMachines}>Save Changes</Button>
            </CardFooter>
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
              
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">File Format Template</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Your Excel file should contain four columns in this order: <strong>Machine</strong>, <strong>SAP Code</strong>, <strong>SKU</strong>, and <strong>Demand</strong>. The first row must be the header.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>SAP Code</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Demand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">TBM 1</TableCell>
                        <TableCell className="font-mono">S4P-87321</TableCell>
                        <TableCell className="font-mono">P-215-65R17</TableCell>
                        <TableCell className="font-mono">5000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">TBM 3</TableCell>
                        <TableCell className="font-mono">S4P-87322</TableCell>
                        <TableCell className="font-mono">LT-245-75R16</TableCell>
                        <TableCell className="font-mono">3500</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">TBM 4</TableCell>
                        <TableCell className="font-mono">S4P-87323</TableCell>
                        <TableCell className="font-mono">P-235-60R18</TableCell>
                        <TableCell className="font-mono">4200</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Current Market Requirements</CardTitle>
                    <CardDescription>
                      {marketRequirements.length > 0
                        ? `Displaying ${marketRequirements.length} records.`
                        : "No data uploaded yet."}
                    </CardDescription>
                  </div>
                  {marketRequirements.length > 0 && (
                     <Button variant="outline" onClick={handleClearRequirements}>
                        <Trash className="mr-2 h-4 w-4"/> Clear Data
                     </Button>
                  )}
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted/50">
                                <TableRow>
                                    <TableHead>Machine</TableHead>
                                    <TableHead>SAP Code</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Demand</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marketRequirements.length > 0 ? (
                                    marketRequirements.map((req, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{req.machine}</TableCell>
                                            <TableCell>{req.sapCode}</TableCell>
                                            <TableCell>{req.sku}</TableCell>
                                            <TableCell className="text-right">{req.demand}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Upload a file to see market requirements.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
              </Card>

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

    