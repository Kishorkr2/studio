'use client';

import {useState, useEffect, useCallback} from 'react';
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
} from '@/lib/types';
import {
  Edit,
  PlusCircle,
  Trash,
  UploadCloud,
  FileSpreadsheet,
  ShieldAlert,
  Save,
  DatabaseZap,
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
import {
  initialOperators,
  shifts as initialShifts,
  initialProductionPlan,
  initialMachines,
} from '@/lib/data';
import * as DataService from '@/lib/data-service';
import {clearFirestoreCache} from '@/lib/firebase';
import {Slider} from '@/components/ui/slider';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [managedShifts, setManagedShifts] = useState<ShiftInfo[]>([]);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(
    []
  );
  const [machines, setMachines] = useState<Machine[]>([]);

  const [newPlanMachineId, setNewPlanMachineId] = useState('');
  const [newPlanSku, setNewPlanSku] = useState('');
  const [newPlanSapCode, setNewPlanSapCode] = useState('');
  const [newPlanQuantity, setNewPlanQuantity] = useState(0);

  const [password, setPassword] = useState('');

  const {toast} = useToast();

  useEffect(() => {
    const unsubOperators = DataService.subscribeToCollection<Operator>(
      'operators',
      setOperators,
      initialOperators
    );
    const unsubShifts = DataService.subscribeToCollection<ShiftInfo>(
      'shifts',
      setManagedShifts,
      initialShifts
    );
    const unsubMachines = DataService.subscribeToCollection<Machine>(
      'machines',
      setMachines,
      initialMachines
    );
    const unsubPlan = DataService.subscribeToCollection<ProductionPlanItem>(
      'productionPlan',
      setProductionPlan,
      initialProductionPlan
    );

    setLoading(false);

    return () => {
      unsubOperators();
      unsubShifts();
      unsubMachines();
      unsubPlan();
    };
  }, []);

  const handleAddOperator = async () => {
    const newOperator = {
      cardNo: `OP-${Math.floor(Math.random() * 1000)}`,
      name: 'New Operator',
      builderNo: `B-${Math.floor(Math.random() * 100)}`,
      skillRating: 3,
      isAbsent: false,
    };
    await DataService.addOperator(newOperator);
    toast({title: 'Operator Added'});
  };

  const handleOperatorChange = async (
    originalCardNo: string,
    field: keyof Operator,
    value: any
  ) => {
    const operatorToUpdate = operators.find(op => op.cardNo === originalCardNo);
    if (!operatorToUpdate) return;

    const updatedOperators = operators.map(op =>
      op.cardNo === originalCardNo ? {...op, [field]: value} : op
    );
    setOperators(updatedOperators);

    try {
      if (field === 'cardNo') {
        const newCardNo = value;
        const newOperatorData = {...operatorToUpdate, cardNo: newCardNo};

        if (newCardNo && newCardNo !== originalCardNo) {
          await DataService.renameOperator(
            originalCardNo,
            newCardNo,
            newOperatorData
          );
          toast({
            title: 'Operator Card No Updated',
            description: `Card No changed from ${originalCardNo} to ${newCardNo}.`,
          });
        }
      } else {
        await DataService.updateOperator(originalCardNo, {[field]: value});
      }
    } catch (error) {
      console.error('Failed to update operator:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description:
          'Could not save operator changes. Please check for duplicate Card Nos.',
      });
      // Revert optimistic update on failure
      setOperators(operators);
    }
  };

  const handleDeleteOperator = async (cardNo: string) => {
    await DataService.deleteOperator(cardNo);
    toast({
      title: 'Operator Removed',
      description: `Operator with Card No ${cardNo} has been removed.`,
    });
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
    await DataService.updateShifts(managedShifts);
    toast({
      title: 'Shifts Updated',
      description: `All shift times have been saved successfully.`,
    });
  };

  const handleAddPlanItem = async () => {
    if (!newPlanMachineId || !newPlanSku || !newPlanSapCode) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'TBM, SKU, and SAP Code are required.',
      });
      return;
    }

    const newSkuPlan: SkuPlan = {
      sku: newPlanSku,
      sapCode: newPlanSapCode,
      quantity: newPlanQuantity,
    };

    const existingPlanItem = productionPlan.find(
      p => p.machineId === newPlanMachineId
    );
    let newPlan;

    if (existingPlanItem) {
      newPlan = productionPlan.map(p =>
        p.machineId === newPlanMachineId
          ? {...p, skus: [...p.skus, newSkuPlan]}
          : p
      );
    } else {
      newPlan = [
        ...productionPlan,
        {machineId: newPlanMachineId, skus: [newSkuPlan]},
      ];
    }

    await DataService.updateProductionPlan(newPlan);

    toast({
      title: 'Plan Item Added',
      description: `SKU ${newPlanSku} added to ${
        machines.find(m => m.id === newPlanMachineId)?.name
      }.`,
    });

    // Reset form
    setNewPlanMachineId('');
    setNewPlanSku('');
    setNewPlanSapCode('');
    setNewPlanQuantity(0);
  };

  const handleDeletePlanSku = async (machineId: string, skuIndex: number) => {
    const planItem = productionPlan.find(p => p.machineId === machineId);
    if (!planItem) return;

    const newSkus = planItem.skus.filter((_, index) => index !== skuIndex);

    let newPlan;
    if (newSkus.length > 0) {
      newPlan = productionPlan.map(p =>
        p.machineId === machineId ? {...p, skus: newSkus} : p
      );
    } else {
      // If no SKUs left, remove the entire plan item for that machine
      newPlan = productionPlan.filter(p => p.machineId !== machineId);
    }

    await DataService.updateProductionPlan(newPlan);
    toast({
      title: 'SKU Removed',
      description: `SKU has been removed from the plan.`,
    });
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
      currentMachines.map(m => (m.id === id ? {...m, name: newName} : m))
    );
  };

  const handleMachineAvailabilityChange = (id: string, isAvailable: boolean) => {
    setMachines(currentMachines =>
      currentMachines.map(m => (m.id === id ? {...m, isAvailable} : m))
    );
  };

  const handleSaveMachines = async () => {
    await DataService.updateMachines(machines);
    toast({
      title: 'TBMs Updated',
      description: 'All TBM numbers and statuses have been saved successfully.',
    });
  };

  const handleAddMachine = async () => {
    const newIdNumber =
      machines.length > 0
        ? Math.max(...machines.map(m => parseInt(m.id.replace('TBM-', '')) || 0)) + 1
        : 1;
    const newId = `TBM-${String(newIdNumber).padStart(2, '0')}`;
    const newMachine = {id: newId, name: `TBM ${newIdNumber}`, isAvailable: true};
    const newMachines = [...machines, newMachine];
    await DataService.updateMachines(newMachines);
  };

  const handleDeleteMachine = async (id: string) => {
    if (productionPlan.some(p => p.machineId === id)) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete TBM',
        description:
          'This TBM is part of an active production plan. Please remove it from the plan first.',
      });
      return;
    }
    const newMachines = machines.filter(m => m.id !== id);
    await DataService.updateMachines(newMachines);
    toast({
      title: 'TBM Removed',
      description: `TBM No ${id} has been removed.`,
    });
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

            if (jsonFromSheet.length === 0) {
              throw new Error('File is empty.');
            }

            const header = Object.keys(jsonFromSheet[0]).map(h =>
              h.trim().toLowerCase()
            );
            const requiredHeaders = ['tbm no', 'sap code', 'sku', 'quantity'];
            const hasAllHeaders = requiredHeaders.every(rh => header.includes(rh));

            if (!hasAllHeaders) {
              throw new Error(
                `File headers must contain: ${requiredHeaders.join(', ')}.`
              );
            }

            const planMap = new Map<string, SkuPlan[]>();
            const machineNameToIdMap = new Map(
              machines.map(m => [
                m.name.trim().toLowerCase().replace(/[\s-]+/g, ''),
                m.id,
              ])
            );

            for (const row of jsonFromSheet) {
              const cleanedRow = Object.fromEntries(
                Object.entries(row).map(([key, value]) => [
                  key.trim().toLowerCase(),
                  value,
                ])
              );

              const tbmNoRaw = String(cleanedRow['tbm no'] || '').trim();
              const normalizedTbmNo = tbmNoRaw.toLowerCase().replace(/[\s-]+/g, '');
              const machineId = machineNameToIdMap.get(normalizedTbmNo);

              if (machineId) {
                const sapCode = String(cleanedRow['sap code'] || '').trim();
                const sku = String(cleanedRow['sku'] || '').trim();
                const quantity = Number(cleanedRow['quantity'] || 0);

                if (sku && sapCode) {
                  if (!planMap.has(machineId)) {
                    planMap.set(machineId, []);
                  }
                  planMap.get(machineId)!.push({sku, sapCode, quantity});
                }
              }
            }

            if (planMap.size === 0) {
              throw new Error(
                'Invalid file format or TBM No did not match. Please check headers: TBM No, SAP Code, SKU, Quantity'
              );
            }

            const parsedPlan: ProductionPlanItem[] = Array.from(
              planMap.entries()
            ).map(([machineId, skus]) => ({
              machineId,
              skus,
            }));

            await DataService.updateProductionPlan(parsedPlan);
            toast({
              title: 'Production Plan Uploaded',
              description: `Successfully uploaded and replaced the production plan with ${parsedPlan.length} TBM assignments.`,
            });
          } catch (error) {
            console.error('Error parsing plan file: ', error);
            toast({
              variant: 'destructive',
              title: 'File Upload Error',
              description:
                error instanceof Error
                  ? error.message
                  : 'Could not parse the uploaded file. Please ensure it follows the template.',
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
      if (event.target) {
        event.target.value = '';
      }
    },
    [machines, toast]
  );

  const handleClearCache = async () => {
    try {
      toast({
        title: 'Clearing Local Cache...',
        description: 'The application will reload shortly. Please wait.',
      });
      await clearFirestoreCache();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Failed to clear local cache:', error);
      toast({
        variant: 'destructive',
        title: 'Error Clearing Cache',
        description:
          'Could not clear the local cache. Please try closing all tabs of this app and reopening.',
      });
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
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="operators">Operator Management</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
          <TabsTrigger value="plan">Production Plan</TabsTrigger>
          <TabsTrigger value="machines">TBM Management</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="operators">
          <Card>
            <CardHeader>
              <CardTitle>Operators</CardTitle>
              <CardDescription>
                Manage your list of approved operators.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                        <Input
                          value={op.cardNo || ''}
                          onBlur={e =>
                            handleOperatorChange(op.cardNo, 'cardNo', e.target.value)
                          }
                          onChange={e =>
                            setOperators(ops =>
                              ops.map(o =>
                                o.cardNo === op.cardNo
                                  ? {...o, cardNo: e.target.value}
                                  : o
                              )
                            )
                          }
                          className="font-mono text-xs max-w-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={op.name || ''}
                          onBlur={e =>
                            handleOperatorChange(op.cardNo, 'name', e.target.value)
                          }
                          onChange={e =>
                            setOperators(ops =>
                              ops.map(o =>
                                o.cardNo === op.cardNo ? {...o, name: e.target.value} : o
                              )
                            )
                          }
                          className="max-w-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={op.builderNo || ''}
                          onBlur={e =>
                            handleOperatorChange(
                              op.cardNo,
                              'builderNo',
                              e.target.value
                            )
                          }
                          onChange={e =>
                            setOperators(ops =>
                              ops.map(o =>
                                o.cardNo === op.cardNo
                                  ? {...o, builderNo: e.target.value}
                                  : o
                              )
                            )
                          }
                          className="max-w-xs"
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
                Upload an Excel file to set the production plan.
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
                  Your Excel file should contain four columns:{' '}
                  <strong>TBM No</strong>, <strong>SAP Code</strong>,{' '}
                  <strong>SKU</strong>, and <strong>Quantity</strong>.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TBM No</TableHead>
                        <TableHead>SAP Code</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono">TBM 1</TableCell>
                        <TableCell className="font-mono">S4P-87321</TableCell>
                        <TableCell className="font-mono">P-215-65R17</TableCell>
                        <TableCell className="font-mono">100</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono">TBM 2</TableCell>
                        <TableCell className="font-mono">S4P-87322</TableCell>
                        <TableCell className="font-mono">P-225-60R17</TableCell>
                        <TableCell className="font-mono">150</TableCell>
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
              <CardDescription>
                Assign SKUs to TBMs for production manually.
              </CardDescription>
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
                        {machines.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label htmlFor="manual-sku">SKU</Label>
                    <Input
                      id="manual-sku"
                      value={newPlanSku}
                      onChange={e => setNewPlanSku(e.target.value)}
                      placeholder="Enter SKU"
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
                    Add to Plan
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TBM No</TableHead>
                      <TableHead>Assigned SKUs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionPlan.map(item => (
                      <TableRow key={item.machineId}>
                        <TableCell>
                          {machines.find(m => m.id === item.machineId)?.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2 items-start">
                            {item.skus.map((skuPlan, index) => (
                              <div
                                key={`${item.machineId}-${skuPlan.sku}-${index}`}
                                className="flex items-center gap-2 w-full"
                              >
                                <Badge
                                  variant="secondary"
                                  className="flex-grow justify-start text-left"
                                >
                                  {skuPlan.sku} (SAP: {skuPlan.sapCode}, Qty:{' '}
                                  {skuPlan.quantity})
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    handleDeletePlanSku(item.machineId, index)
                                  }
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* The edit/delete can be done per SKU now */}
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
              <CardTitle>TBM Management</CardTitle>
              <CardDescription>View and edit your TBM inventory.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TBM No</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines.map(machine => (
                    <TableRow key={machine.id}>
                      <TableCell>
                        <Input
                          value={machine.name}
                          onChange={e =>
                            handleMachineNameChange(machine.id, e.target.value)
                          }
                          className="max-w-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={machine.isAvailable}
                          onCheckedChange={checked =>
                            handleMachineAvailabilityChange(machine.id, checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMachine(machine.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button onClick={handleAddMachine}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add TBM
              </Button>
              <Button onClick={handleSaveMachines}>Save Changes</Button>
            </CardFooter>
          </Card>
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
                      Clear All Production Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all
                        production log data from the cloud. Please type{' '}
                        <strong>admin123</strong> to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-2">
                      <Label htmlFor="clear-data-password" className="sr-only">
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
                    data, clearing the local cache can often resolve the issue. This
                    action is safe and will not delete any data stored in the
                    cloud.
                  </p>
                </div>
                <Button variant="outline" onClick={handleClearCache}>
                  <DatabaseZap className="mr-2 h-4 w-4" /> Clear Local Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
