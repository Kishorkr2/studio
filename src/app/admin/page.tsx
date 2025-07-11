
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { initialOperators, shifts as initialShifts, initialProductionPlan, initialMachines } from '@/lib/data';
import * as DataService from '@/lib/data-service';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [marketRequirements, setMarketRequirements] = useState<MarketRequirement[]>([]);
  
  const [editingPlan, setEditingPlan] = useState<ProductionPlanItem | null>(null);
  const [newSku, setNewSku] = useState('');
  const [password, setPassword] = useState('');
  
  const [editingReq, setEditingReq] = useState<MarketRequirement | null>(null);
  const [editingReqIndex, setEditingReqIndex] = useState<number | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const unsubOperators = DataService.subscribeToCollection<Operator>('operators', setOperators, initialOperators);
    const unsubShifts = DataService.subscribeToCollection<ShiftInfo>('shifts', setManagedShifts, initialShifts);
    const unsubMachines = DataService.subscribeToCollection<Machine>('machines', setMachines, initialMachines);
    const unsubPlan = DataService.subscribeToCollection<ProductionPlanItem>('productionPlan', setProductionPlan, initialProductionPlan);
    const unsubMarketReq = DataService.subscribeToCollection<MarketRequirement>('marketRequirements', setMarketRequirements);
    
    setLoading(false);

    return () => {
      unsubOperators();
      unsubShifts();
      unsubMachines();
      unsubPlan();
      unsubMarketReq();
    };
  }, []);

  const handleAddOperator = async () => {
    const newOperator = { name: 'New Operator', skillRating: 3, isAbsent: false };
    await DataService.addOperator(newOperator);
    toast({ title: "Operator Added" });
  };

  const handleDeleteOperator = async (id: string) => {
    await DataService.deleteOperator(id);
    toast({
        title: "Operator Removed",
        description: `Operator with ID ${id} has been removed.`,
    });
  };
  
  const handleShiftChange = (index: number, field: keyof ShiftInfo, value: string) => {
    setManagedShifts(currentShifts => 
        currentShifts.map((shift, i) => 
            i === index ? { ...shift, [field]: value } : shift
        )
    );
  };

  const handleSaveShifts = async () => {
    await DataService.updateShifts(managedShifts);
    toast({
      title: 'Shifts Updated',
      description: `All shift times have been saved successfully.`,
    });
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonFromSheet = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsedData: MarketRequirement[] = jsonFromSheet.map(row => ({
            machine: String(row.Machine || '').trim(),
            sapCode: String(row['SAP Code'] || '').trim(),
            sku: String(row.SKU || '').trim(),
            demand: Number(row.Demand || 0),
          }));

          if (parsedData.length > 0 && parsedData[0].machine && parsedData[0].sku) {
             await DataService.setMarketRequirements(parsedData);
             
             const machineNameToIdMap = new Map(machines.map(m => [m.name.trim().toLowerCase(), m.id]));
             const newProductionPlanItems = new Map<string, string[]>();

             for (const req of parsedData) {
                 const machineId = machineNameToIdMap.get(req.machine.toLowerCase());
                 if (machineId) {
                     if (!newProductionPlanItems.has(machineId)) {
                         newProductionPlanItems.set(machineId, []);
                     }
                     const skus = newProductionPlanItems.get(machineId)!;
                     if (req.sku && !skus.includes(req.sku)) {
                         skus.push(req.sku);
                     }
                 }
             }

             const newProductionPlan: ProductionPlanItem[] = Array.from(newProductionPlanItems.entries()).map(([machineId, skus]) => ({
                 machineId,
                 skus,
             }));

             if (newProductionPlan.length === 0 && parsedData.length > 0) {
                 throw new Error("No machine names in the file matched the machines in the system. Please check for typos or extra spaces.");
             }

             await DataService.updateProductionPlan(newProductionPlan);

             toast({
                title: 'File Processed & Plan Synced',
                description: `Loaded ${parsedData.length} requirements. The previous market demand and production plan have been replaced.`,
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

  const handleClearRequirements = async () => {
    await DataService.clearMarketRequirements();
    toast({
        title: "Market Requirements Cleared",
        description: "All uploaded market requirement data has been removed.",
    });
  };

  const handleSavePlanItem = async (item: ProductionPlanItem) => {
    if (!item.machineId || item.skus.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Machine must be selected and at least one SKU must be added.' });
      return;
    }
    
    let newPlan;
    const existing = productionPlan.find(p => p.machineId === item.machineId);
    if (existing) {
      newPlan = productionPlan.map(p => p.machineId === item.machineId ? item : p);
    } else {
      newPlan = [...productionPlan, item];
    }
    await DataService.updateProductionPlan(newPlan);

    toast({ title: 'Plan Saved', description: `Production plan for ${machines.find(m => m.id === item.machineId)?.name} has been updated.`});
    setEditingPlan(null);
  };

  const handleDeletePlanItem = async (machineId: string) => {
    const newPlan = productionPlan.filter(p => p.machineId !== machineId);
    await DataService.updateProductionPlan(newPlan);
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

  const handleClearDataConfirm = async () => {
    await DataService.clearAllProductionData();
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

  const handleSaveMachines = async () => {
      await DataService.updateMachines(machines);
      toast({
          title: 'Machines Updated',
          description: 'All machine names and statuses have been saved successfully.',
      });
  };

  const handleAddMachine = async () => {
      const newIdNumber = machines.length > 0 ? Math.max(...machines.map(m => parseInt(m.id.replace('TBM-', '')) || 0)) + 1 : 1;
      const newId = `TBM-${String(newIdNumber).padStart(2, '0')}`;
      const newMachine = { id: newId, name: `New Machine ${newIdNumber}`, isAvailable: true };
      const newMachines = [...machines, newMachine];
      await DataService.updateMachines(newMachines);
  };

  const handleDeleteMachine = async (id: string) => {
      if (productionPlan.some(p => p.machineId === id)) {
          toast({
              variant: 'destructive',
              title: 'Cannot Delete Machine',
              description: 'This machine is part of an active production plan. Please remove it from the plan first.'
          });
          return;
      }
      const newMachines = machines.filter(m => m.id !== id);
      await DataService.updateMachines(newMachines);
      toast({
          title: 'Machine Removed',
          description: `Machine ${id} has been removed.`,
      });
  };

  const startEditingRequirement = (req: MarketRequirement, index: number) => {
    setEditingReqIndex(index);
    setEditingReq({ ...req });
  };

  const cancelEditingRequirement = () => {
    setEditingReqIndex(null);
    setEditingReq(null);
  };

  const saveEditingRequirement = async () => {
    if (editingReq && editingReqIndex !== null) {
        const newReqs = marketRequirements.map((item, index) => 
            index === editingReqIndex ? editingReq : item
        );
        await DataService.setMarketRequirements(newReqs);
        toast({
            title: "Requirement Saved",
            description: "Your changes have been saved."
        });
    }
    cancelEditingRequirement();
  };

  const handleEditingReqChange = (field: keyof MarketRequirement, value: string | number) => {
    if (editingReq) {
        setEditingReq({ ...editingReq, [field]: value });
    }
  };

  const handleDeleteRequirement = async (indexToDelete: number) => {
    const newReqs = marketRequirements.filter((_, index) => index !== indexToDelete);
    await DataService.setMarketRequirements(newReqs);
    toast({
        title: "Requirement Deleted",
        description: "The market requirement has been removed."
    });
  };

  const handlePlanUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonFromSheet = XLSX.utils.sheet_to_json(worksheet) as any[];

          const parsedPlan: ProductionPlanItem[] = jsonFromSheet.map(row => {
            const skusString = String(row.SKUs || '');
            const skus = skusString.split(',').map(s => s.trim()).filter(Boolean);
            return {
              machineId: String(row.MachineID || '').trim(),
              skus,
            };
          });

          if (parsedPlan.length > 0 && parsedPlan[0].machineId && parsedPlan[0].skus.length > 0) {
            await DataService.updateProductionPlan(parsedPlan);
            toast({
              title: 'Production Plan Uploaded',
              description: `Successfully uploaded and replaced the production plan with ${parsedPlan.length} machine assignments.`,
            });
          } else {
            throw new Error("Invalid file format. Please check headers: MachineID, SKUs");
          }
        } catch (error) {
          console.error("Error parsing plan file: ", error);
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
  
  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <div className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="operators">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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

        <TabsContent value="plan" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Production Plan</CardTitle>
              <CardDescription>Upload an Excel file to set the production plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Drop your plan file here or click to upload</h3>
                <p className="mt-1 text-sm text-muted-foreground">Supports: .xls, .xlsx</p>
                <Input id="plan-upload" type="file" className="sr-only" onChange={handlePlanUpload} accept=".xls,.xlsx" />
                <Button asChild className="mt-4">
                  <Label htmlFor="plan-upload"><FileSpreadsheet className="mr-2 h-4 w-4" />Select File</Label>
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="text-md font-semibold">File Format Template</h4>
                <p className="text-sm text-muted-foreground">
                  Your Excel file should contain two columns: <strong>MachineID</strong> and <strong>SKUs</strong> (comma-separated).
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MachineID</TableHead>
                        <TableHead>SKUs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">TBM-01</TableCell>
                        <TableCell className="font-mono">P-215-65R17</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">TBM-02</TableCell>
                        <TableCell className="font-mono">P-215-65R17,P-225-60R17</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Manual Production Plan</CardTitle>
              <CardDescription>Assign SKUs to machines for production manually.</CardDescription>
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
              <CardDescription>Upload Excel files containing market requirement data. This will also auto-generate a production plan.</CardDescription>
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
                        <Trash className="mr-2 h-4 w-4"/> Clear All Data
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
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marketRequirements.length > 0 ? (
                                    marketRequirements.map((req, index) => (
                                        editingReqIndex === index && editingReq ? (
                                          <TableRow key={index}>
                                            <TableCell><Input value={editingReq.machine} onChange={(e) => handleEditingReqChange('machine', e.target.value)} /></TableCell>
                                            <TableCell><Input value={editingReq.sapCode} onChange={(e) => handleEditingReqChange('sapCode', e.target.value)} /></TableCell>
                                            <TableCell><Input value={editingReq.sku} onChange={(e) => handleEditingReqChange('sku', e.target.value)} /></TableCell>
                                            <TableCell className="text-right">
                                              <Input type="number" value={editingReq.demand} onChange={(e) => handleEditingReqChange('demand', Number(e.target.value))} className="w-24 ml-auto text-right" />
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                              <Button size="sm" onClick={saveEditingRequirement}><Save className="h-4 w-4 mr-1" /> Save</Button>
                                              <Button size="sm" variant="ghost" onClick={cancelEditingRequirement}>Cancel</Button>
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          <TableRow key={index}>
                                              <TableCell>{req.machine}</TableCell>
                                              <TableCell>{req.sapCode}</TableCell>
                                              <TableCell>{req.sku}</TableCell>
                                              <TableCell className="text-right">{req.demand}</TableCell>
                                              <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => startEditingRequirement(req, index)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRequirement(index)}><Trash className="h-4 w-4" /></Button>
                                              </TableCell>
                                          </TableRow>
                                        )
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
                        This action cannot be undone. This will permanently delete all production log data from the cloud. 
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
