
'use client';

import {useState, useEffect, useCallback, useMemo} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  Operator,
  ProductionPlanItem,
  Machine,
  ShiftInfo,
  SkuPlan,
  User,
} from '@/lib/types';
import {
  PlusCircle,
  Trash,
  UploadCloud,
  FileSpreadsheet,
  ShieldAlert,
  Save,
  DatabaseZap,
  CheckCircle,
} from 'lucide-react';
import {useToast} from '@/hooks/use-toast';
import {Badge} from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import {Switch} from '@/components/ui/switch';
import {Skeleton} from '@/components/ui/skeleton';
import {Slider} from '@/components/ui/slider';
import * as actions from '../actions';
import { Loader } from '@/components/ui/loader';

interface EditableSkuPlan extends SkuPlan {
  originalMachineId: string;
  originalSapCode: string;
  machineId: string;
}

function UserManagement({users, onApprove, onDelete}: {users: User[], onApprove: (id: number) => void, onDelete: (id: number) => void}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Approve or remove registered users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.mobile}</TableCell>
                  <TableCell>
                    {user.isApproved ? (
                       <Badge variant="secondary" className="text-green-600">Approved</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {!user.isApproved && (
                      <Button size="sm" variant="outline" onClick={() => onApprove(user.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    )}
                     <Button variant="ghost" size="icon" onClick={() => onDelete(user.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function MachineManagement({
  title,
  description,
  machines,
  productionPlan,
  onMachineChange,
  onAddMachine,
  onDeleteMachine,
  onSaveChanges,
  machineType
}: {
  title: string;
  description: string;
  machines: Machine[];
  productionPlan: ProductionPlanItem[];
  onMachineChange: (id: string, field: keyof Machine, value: any) => void;
  onAddMachine: () => void;
  onDeleteMachine: (id: string) => void;
  onSaveChanges: () => void;
  machineType: 'TBM' | 'CuringPress';
}) {
   return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine No</TableHead>
                <TableHead>Available</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines
                .filter(m => m.type === machineType)
                .map(machine => (
                <TableRow key={machine.id}>
                  <TableCell>
                    <Input
                      defaultValue={machine.name}
                      onBlur={e => onMachineChange(machine.id, 'name', e.target.value)}
                      className="w-36"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={machine.isAvailable}
                      onCheckedChange={checked => onMachineChange(machine.id, 'isAvailable', checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteMachine(machine.id)}
                      disabled={productionPlan.some(p => p.machineId === machine.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between flex-wrap gap-2">
        <Button onClick={onAddMachine}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add {machineType === 'TBM' ? 'TBM' : 'Curing Press'}
        </Button>
        <Button onClick={onSaveChanges}>
          Save All Changes
        </Button>
      </CardFooter>
    </Card>
  );
}


export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(
    []
  );
  const [editablePlan, setEditablePlan] = useState<EditableSkuPlan[]>([]);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [newPlanMachineId, setNewPlanMachineId] = useState('');
  const [newPlanSku, setNewPlanSku] = useState('');
  const [newPlanSapCode, setNewPlanSapCode] = useState('');
  const [newPlanQuantity, setNewPlanQuantity] = useState(0);

  const [password, setPassword] = useState('');
  const [isRenaming, setIsRenaming] = useState<string | null>(null);

  const [uploadedPlan, setUploadedPlan] = useState<
    ProductionPlanItem[] | null
  >(null);

  const {toast} = useToast();

  const flattenProductionPlan = (plan: ProductionPlanItem[]): EditableSkuPlan[] => {
    return plan.flatMap(item =>
      item.skus.map(sku => ({
        ...sku,
        originalMachineId: item.machineId,
        originalSapCode: sku.sapCode,
        machineId: item.machineId,
      }))
    );
  };
  
  const structureProductionPlan = (flatPlan: EditableSkuPlan[]): ProductionPlanItem[] => {
    const planMap = new Map<string, SkuPlan[]>();

    for (const item of flatPlan) {
      const { machineId, sku, sapCode, quantity } = item;
      const skus = planMap.get(machineId) || [];
      skus.push({ sku, sapCode, quantity });
      planMap.set(machineId, skus);
    }

    return Array.from(planMap.entries()).map(([machineId, skus]) => ({ machineId, skus }));
  };

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, shifts, machs, plan, usersData] = await Promise.all([
        actions.getOperators(),
        actions.getShifts(),
        actions.getMachines(),
        actions.getProductionPlan(),
        actions.getUsers(),
      ]);
      setOperators(ops);
      setManagedShifts(shifts);
      setMachines(machs);
      setProductionPlan(plan);
      setEditablePlan(flattenProductionPlan(plan));
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load data from the server.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  const totalPlanQuantity = useMemo(() => {
    return editablePlan.reduce((total, item) => total + item.quantity, 0);
  }, [editablePlan]);

  const handleClearProductionPlan = async () => {
    try {
      await actions.clearProductionPlan();
      setProductionPlan([]);
      setEditablePlan([]);
      toast({
        title: 'Production Plan Cleared',
        description: 'The entire production plan has been deleted.',
      });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clear the production plan.',
      });
    }
  };


  const handleAddOperator = async () => {
    const newOperator = {
      cardNo: `OP-${Date.now()}`,
      name: 'New Operator',
      builderNo: `B-${Math.floor(Math.random() * 100)}`,
      skillRating: 3,
      isAbsent: false,
    };
    await actions.addOperator(newOperator);
    setOperators(prev => [...prev, newOperator]);
    toast({title: 'Operator Added'});
  };

  const handleOperatorChange = async (
    originalCardNo: string,
    field: keyof Operator,
    value: any
  ) => {
    const originalOperators = operators;
    setOperators(currentOps =>
      currentOps.map(op =>
        op.cardNo === originalCardNo ? {...op, [field]: value} : op
      )
    );
    try {
      await actions.updateOperator(originalCardNo, {[field]: value});
    } catch (error) {
      setOperators(originalOperators);
      toast({variant: 'destructive', title: 'Update failed'});
    }
  };

  const handleRenameOperator = async (
    originalCardNo: string,
    newCardNo: string
  ) => {
    if (!newCardNo || originalCardNo === newCardNo) {
      return;
    }

    const operatorToUpdate = operators.find(op => op.cardNo === originalCardNo);
    if (!operatorToUpdate) return;

    setIsRenaming(originalCardNo);
    try {
      const newOperatorData = {...operatorToUpdate, cardNo: newCardNo};
      await actions.renameOperator(originalCardNo, newCardNo, newOperatorData);
      await loadInitialData();
      toast({title: 'Operator Card No Updated'});
    } catch (error) {
      console.error('Failed to rename operator:', error);
      toast({
        variant: 'destructive',
        title: 'Rename Failed',
        description:
          error instanceof Error
            ? error.message
            : `Card No "${newCardNo}" might already exist.`,
      });
    } finally {
      setIsRenaming(null);
    }
  };


  const handleDeleteOperator = async (cardNo: string) => {
    await actions.deleteOperator(cardNo);
    setOperators(prev => prev.filter(op => op.cardNo !== cardNo));
    toast({title: 'Operator Removed'});
  };

  const handleShiftChange = (
    index: number,
    field: keyof ShiftInfo,
    value: string
  ) => {
    setManagedShifts(currentShifts =>
      currentShifts.map((shift, i) =>
        i === index ? {...shift, [field]: value} : shift
      )
    );
  };

  const handleSaveShifts = async () => {
    await actions.updateShifts(managedShifts);
    toast({title: 'Shifts Updated'});
  };
  
  const handleEditablePlanChange = (index: number, field: keyof EditableSkuPlan, value: string | number) => {
    setEditablePlan(currentPlan => 
      currentPlan.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };
  
  const handleSavePlan = async () => {
    const structuredPlan = structureProductionPlan(editablePlan);
    await actions.updateProductionPlan(structuredPlan);
    setProductionPlan(structuredPlan);
    toast({title: 'Production Plan Updated'});
  };

  const handleDeletePlanSku = (indexToDelete: number) => {
      const newEditablePlan = editablePlan.filter((_, index) => index !== indexToDelete);
      setEditablePlan(newEditablePlan);
      toast({title: 'SKU Removed. Click "Save Plan" to confirm.'});
  };

  const handleAddPlanItem = useCallback(() => {
    if (!newPlanMachineId || !newPlanSku || !newPlanSapCode) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'TBM, SKU, and SAP Code are required.',
      });
      return;
    }

    const newEditableItem: EditableSkuPlan = {
      sku: newPlanSku,
      sapCode: newPlanSapCode,
      quantity: newPlanQuantity,
      originalMachineId: newPlanMachineId,
      originalSapCode: newPlanSapCode,
      machineId: newPlanMachineId
    };
    
    setEditablePlan(prev => [...prev, newEditableItem]);
    
    toast({title: 'Plan Item Added. Click "Save Plan" to confirm.'});
    setNewPlanMachineId('');
    setNewPlanSku('');
    setNewPlanSapCode('');
    setNewPlanQuantity(0);
  }, [newPlanMachineId, newPlanSku, newPlanSapCode, newPlanQuantity, toast]);

  const handleClearDataConfirm = async () => {
    await actions.clearAllProductionData();
    await loadInitialData();
    toast({
      title: 'Success!',
      description: 'All production logs and tread stock have been cleared.',
    });
    setPassword('');
  };

  const handleMachineChange = (id: string, field: keyof Machine, value: any) => {
    setMachines(currentMachines =>
      currentMachines.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };
  
  const handleSaveAllMachineChanges = async () => {
    await actions.updateMachines(machines);
    toast({title: 'All Machine Changes Saved'});
  };
  
  const handleAddMachine = async (type: 'TBM' | 'CuringPress') => {
    const prefix = type === 'TBM' ? 'TBM' : 'CP';
    const newIdNumber =
      machines.filter(m => m.type === type).length > 0
        ? Math.max(
            ...machines
              .filter(m => m.type === type)
              .map(m => parseInt(m.id.replace(`${prefix}-`, '')) || 0)
          ) + 1
        : 1;
    const newId = `${prefix}-${String(newIdNumber).padStart(2, '0')}`;
    const newMachine = {
      id: newId,
      name: `${type === 'TBM' ? 'TBM' : 'Curing Press'} ${newIdNumber}`,
      isAvailable: true,
      type: type,
    };
    await actions.addMachine(newMachine);
    setMachines(prev => [...prev, newMachine]);
  };
  
  const handleDeleteMachine = async (id: string) => {
    if (productionPlan.some(p => p.machineId === id)) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete Machine',
        description: 'This machine is part of an active production plan.',
      });
      return;
    }
    await actions.deleteMachine(id);
    setMachines(prev => prev.filter(m => m.id !== id));
    toast({title: 'Machine Removed'});
  };

  const handlePlanUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async e => {
          try {
            const {read, utils} = await import('xlsx');
            const data = e.target?.result;
            const workbook = read(data, {type: 'array'});
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonFromSheet: any[] = utils.sheet_to_json(worksheet);

            const header =
              jsonFromSheet.length > 0
                ? Object.keys(jsonFromSheet[0]).map(h => h.trim().toLowerCase())
                : [];
            const requiredHeaders = ['tbm no', 'sap code', 'sku', 'quantity'];
            if (!requiredHeaders.every(rh => header.includes(rh))) {
              throw new Error(
                `File headers must contain: ${requiredHeaders.join(', ')}.`
              );
            }

            const planMap = new Map<string, SkuPlan[]>();
            const machineNameToIdMap = new Map(
              machines
                .filter(m => m.type === 'TBM')
                .map(m => {
                  const match = m.name.match(/\d+/);
                  return [match ? match[0] : null, m.id];
                })
            );

            for (const row of jsonFromSheet) {
              const tbmNoRaw = String(row['TBM No'] || '').trim();
              const tbmNumber = tbmNoRaw.match(/\d+/)?.[0];
              const machineId = tbmNumber
                ? machineNameToIdMap.get(tbmNumber)
                : null;

              if (machineId) {
                const sapCode = String(row['SAP Code'] || '').trim();
                const sku = String(row['SKU'] || '').trim();
                const quantity = Number(row['Quantity'] || 0);

                if (sku && sapCode && quantity > 0) {
                  const currentSkus = planMap.get(machineId) || [];
                  currentSkus.push({sku, sapCode, quantity});
                  planMap.set(machineId, currentSkus);
                }
              }
            }

            if (planMap.size === 0) {
              throw new Error('No valid plan data found in the file.');
            }

            const parsedPlan: ProductionPlanItem[] = Array.from(
              planMap.entries()
            ).map(([machineId, skus]) => ({
              machineId,
              skus,
            }));

            setUploadedPlan(parsedPlan);
            toast({
              title: 'Plan Preview Ready',
              description: 'Review the uploaded plan and click save.',
            });
          } catch (error) {
            console.error('Error parsing plan file:', error);
            toast({
              variant: 'destructive',
              title: 'File Upload Error',
              description:
                error instanceof Error ? error.message : 'An unknown error occurred.',
            });
          }
        };
        reader.readAsArrayBuffer(file);
      }
      if (event.target) event.target.value = '';
    },
    [machines, toast]
  );

  const handleSaveUploadedPlan = async () => {
    if (!uploadedPlan) return;
    await actions.updateProductionPlan(uploadedPlan);
    setProductionPlan(uploadedPlan);
    setEditablePlan(flattenProductionPlan(uploadedPlan));
    setUploadedPlan(null);
    toast({
      title: 'Production Plan Saved',
      description: 'The new plan has been successfully saved.',
    });
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      window.location.reload();
    }
  };

  const handleApproveUser = async (userId: number) => {
    try {
      await actions.approveUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? {...u, isApproved: true} : u));
      toast({title: "User Approved"});
    } catch (error) {
      toast({variant: 'destructive', title: "Approval Failed"});
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await actions.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({title: "User Deleted"});
    } catch (error) {
      toast({variant: 'destructive', title: "Deletion Failed"});
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 lg:grid-cols-7 h-auto">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="operators">Operators</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="plan">Production Plan</TabsTrigger>
          <TabsTrigger value="tbm">TBMs</TabsTrigger>
          <TabsTrigger value="curing">Curing Presses</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement users={users} onApprove={handleApproveUser} onDelete={handleDeleteUser} />
        </TabsContent>

        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <CardTitle>Operators</CardTitle>
              <CardDescription>
                Manage your list of approved operators.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Builder No</TableHead>
                      <TableHead>Skill Rating</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operators.map(op => (
                      <TableRow key={op.cardNo}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isRenaming === op.cardNo ? (
                              <Loader className="h-4 w-4" />
                            ) : null}
                            <Input
                              defaultValue={op.cardNo}
                              disabled={isRenaming === op.cardNo}
                              onBlur={e =>
                                handleRenameOperator(op.cardNo, e.target.value)
                              }
                              className="font-mono text-xs w-28"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={op.name}
                            onBlur={e =>
                              handleOperatorChange(op.cardNo, 'name', e.target.value)
                            }
                            className="w-36"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={op.builderNo}
                            onBlur={e =>
                              handleOperatorChange(
                                op.cardNo,
                                'builderNo',
                                e.target.value
                              )
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[op.skillRating]}
                              onValueChange={([val]) =>
                                handleOperatorChange(op.cardNo, 'skillRating', val)
                              }
                              min={1}
                              max={5}
                              step={1}
                              className="w-24"
                            />
                            <Badge
                              variant="secondary"
                              className="w-8 h-6 flex items-center justify-center"
                            >
                              {op.skillRating}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteOperator(op.cardNo)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleAddOperator}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Operator
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="shifts">
          <Card>
            <CardHeader>
              <CardTitle>Shift Management</CardTitle>
              <CardDescription>
                Set the timings for the day and night shifts.
              </CardDescription>
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
                        onChange={e =>
                          handleShiftChange(index, 'startTime', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`end-time-${index}`}>End Time</Label>
                      <Input
                        id={`end-time-${index}`}
                        type="time"
                        value={s.endTime}
                        onChange={e =>
                          handleShiftChange(index, 'endTime', e.target.value)
                        }
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
              <CardDescription>
                Upload an Excel file to set the production plan. This will
                replace the existing plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  Drop your plan file here or click to upload
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supports: .xls, .xlsx
                </p>
                <Input
                  id="plan-upload"
                  type="file"
                  className="sr-only"
                  onChange={handlePlanUpload}
                  accept=".xls,.xlsx"
                />
                <Button asChild className="mt-4">
                  <Label htmlFor="plan-upload">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Select File
                  </Label>
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="text-md font-semibold">File Format Template</h4>
                <p className="text-sm text-muted-foreground">
                  Your Excel file should contain four columns with these exact
                  headers: <strong>TBM No</strong>, <strong>SAP Code</strong>,{' '}
                  <strong>SKU</strong>, and <strong>Quantity</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          {uploadedPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Plan Preview</CardTitle>
                <CardDescription>
                  Review the data parsed from your file before saving.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TBM No</TableHead>
                        <TableHead>Assigned SKUs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadedPlan.map(item => (
                        <TableRow key={item.machineId}>
                          <TableCell>
                            {machines.find(m => m.id === item.machineId)?.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {item.skus.map((sku, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-left justify-start"
                                >
                                  {sku.sku} (SAP: {sku.sapCode}, Qty: {sku.quantity})
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" onClick={() => setUploadedPlan(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveUploadedPlan}>
                  <Save className="mr-2 h-4 w-4" /> Save Uploaded Plan
                </Button>
              </CardFooter>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle>Manual Production Plan</CardTitle>
                <CardDescription>
                  Total Planned Quantity: <span className="font-bold text-foreground">{totalPlanQuantity.toLocaleString()}</span>
                </CardDescription>
              </div>
               <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete Plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the entire production plan. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearProductionPlan}>
                        Confirm & Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">Add New Plan Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="manual-machine-select">TBM No</Label>
                    <Select
                      value={newPlanMachineId}
                      onValueChange={setNewPlanMachineId}
                    >
                      <SelectTrigger id="manual-machine-select">
                        <SelectValue placeholder="Select a TBM" />
                      </SelectTrigger>
                      <SelectContent>
                        {machines
                          .filter(m => m.type === 'TBM')
                          .map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-sku">SKU</Label>
                    <Input
                      id="manual-sku"
                      value={newPlanSku}
                      onChange={e => setNewPlanSku(e.target.value)}
                      placeholder="Enter SKU"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-sap-code">SAP Code</Label>
                    <Input
                      id="manual-sap-code"
                      value={newPlanSapCode}
                      onChange={e => setNewPlanSapCode(e.target.value)}
                      placeholder="SAP Code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-quantity">Quantity</Label>
                    <Input
                      id="manual-quantity"
                      type="number"
                      value={newPlanQuantity === 0 ? '' : newPlanQuantity}
                      onChange={e => setNewPlanQuantity(Number(e.target.value))}
                      placeholder="Quantity"
                    />
                  </div>
                  <Button onClick={handleAddPlanItem}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">TBM No</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-[150px]">SAP Code</TableHead>
                      <TableHead className="w-[120px]">Quantity</TableHead>
                      <TableHead className="text-right w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editablePlan.map((item, index) => (
                      <TableRow key={`${item.originalMachineId}-${item.originalSapCode}-${index}`}>
                        <TableCell>
                          <Select
                            value={item.machineId}
                            onValueChange={(value) => handleEditablePlanChange(index, 'machineId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select TBM" />
                            </SelectTrigger>
                            <SelectContent>
                              {machines
                                .filter(m => m.type === 'TBM')
                                .map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                           <Input
                              value={item.sku}
                              onChange={(e) => handleEditablePlanChange(index, 'sku', e.target.value)}
                              placeholder="SKU"
                            />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.sapCode}
                            onChange={(e) => handleEditablePlanChange(index, 'sapCode', e.target.value)}
                            placeholder="SAP Code"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleEditablePlanChange(index, 'quantity', Number(e.target.value))}
                            placeholder="Quantity"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePlanSku(index)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
             <CardFooter className="justify-end">
              <Button onClick={handleSavePlan}>
                <Save className="mr-2 h-4 w-4" /> Save Plan
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="tbm">
          <MachineManagement 
            title="TBM Management"
            description="View and edit your TBM inventory."
            machines={machines}
            productionPlan={productionPlan}
            onMachineChange={handleMachineChange}
            onAddMachine={() => handleAddMachine('TBM')}
            onDeleteMachine={handleDeleteMachine}
            onSaveChanges={handleSaveAllMachineChanges}
            machineType="TBM"
          />
        </TabsContent>

        <TabsContent value="curing">
          <MachineManagement 
            title="Curing Press Management"
            description="View and edit your curing press inventory."
            machines={machines}
            productionPlan={productionPlan}
            onMachineChange={handleMachineChange}
            onAddMachine={() => handleAddMachine('CuringPress')}
            onDeleteMachine={handleDeleteMachine}
            onSaveChanges={handleSaveAllMachineChanges}
            machineType="CuringPress"
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Manage advanced and dangerous application settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 space-y-4">
                <div>
                  <h4 className="font-semibold text-destructive">
                    Dangerous Actions
                  </h4>
                  <p className="text-sm text-destructive/80 mt-1">
                    These actions are irreversible. Please proceed with caution.
                  </p>
                </div>
                <AlertDialog onOpenChange={open => !open && setPassword('')}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Clear Production Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete all production log and tread stock data from the
                        cloud. It will NOT delete operators, TBMs, or the
                        production plan. Please type <strong>admin123</strong>{' '}
                        to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                      <Label
                        htmlFor="clear-data-password"
                        className="sr-only"
                      >
                        Password
                      </Label>
                      <Input
                        id="clear-data-password"
                        type="password"
                        placeholder="Enter password to confirm"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
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

              <div className="p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/10 mt-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-yellow-700 dark:text-yellow-300">
                    Troubleshooting
                  </h4>
                  <p className="text-sm text-yellow-700/80 dark:text-yellow-300/80 mt-1">
                    If the application is behaving unexpectedly or not loading
                    data, a page reload can often resolve the issue.
                    This action is safe and will not delete any data.
                  </p>
                </div>
                <Button variant="outline" onClick={handleClearCache}>
                  <DatabaseZap className="mr-2 h-4 w-4" /> Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
