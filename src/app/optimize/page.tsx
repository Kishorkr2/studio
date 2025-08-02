
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
import {Switch} from '@/components/ui/switch';
import {Slider} from '@/components/ui/slider';
import {
  PlusCircle,
  Sparkles,
  Trash,
  User,
  Wrench,
} from 'lucide-react';
import type {Operator, Machine, ShiftInfo} from '@/lib/types';
import {optimizeOperatorAssignment} from './actions';
import type {OptimizeOperatorAssignmentOutput} from '@/ai/flows/optimize-operator-assignment';
import {useToast} from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import * as actions from '../actions';
import { Loader } from '@/components/ui/loader';

export default function OptimizePage() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftInfo[]>([]);
  const [shift, setShift] = useState<ShiftInfo | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizeOperatorAssignmentOutput | null>(
    null
  );
  const {toast} = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, machs, allShiftsData] = await Promise.all([
        actions.getOperators(),
        actions.getMachines(),
        actions.getShifts(),
      ]);
      setOperators(ops);
      setMachines(machs);
      setAllShifts(allShiftsData);
      if (allShiftsData.length > 0 && !shift) {
        setShift(allShiftsData[0]);
      }
    } catch (error) {
      console.error('Failed to load data', error);
      toast({variant: 'destructive', title: 'Error loading data'});
    } finally {
      setLoading(false);
    }
  }, [shift, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOptimize = async () => {
    if (!shift) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a shift before optimizing.',
      });
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const input = {
        operators: operators.map(op => ({
          operatorId: op.cardNo,
          skillRating: op.skillRating,
        })),
        machines: machines.map(m => ({
          machineId: m.id,
          isAvailable: m.isAvailable,
        })),
        shiftTimes: {startTime: shift.startTime, endTime: shift.endTime},
        absenteeism: operators.map(op => ({
          operatorId: op.cardNo,
          isAbsent: op.isAbsent,
        })),
      };
      const response = await optimizeOperatorAssignment(input);
      setResult(response);
    } catch (error) {
      console.error('Optimization failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate assignments. Please try again.',
      });
    }
    setIsLoading(false);
  };

  const handleOperatorChange = (
    cardNo: string,
    field: keyof Operator,
    value: any
  ) => {
    const updatedOperators = operators.map(op =>
      op.cardNo === cardNo ? {...op, [field]: value} : op
    );
    setOperators(updatedOperators);
  };

  const handleSaveOperatorChange = async (cardNo: string) => {
    const operator = operators.find(op => op.cardNo === cardNo);
    if (operator) {
      await actions.updateOperator(cardNo, operator);
    }
  };

  const handleMachineChange = async (id: string, isAvailable: boolean) => {
    const updatedMachines = machines.map(m =>
      m.id === id ? {...m, isAvailable} : m
    );
    setMachines(updatedMachines);
    await actions.updateMachines(updatedMachines);
  };

  const handleShiftChange = (name: string) => {
    const selectedShift = allShifts.find(s => s.name === name);
    if (selectedShift) {
      setShift(selectedShift);
    }
  };

  const addOperator = async () => {
    const newOperator = {
      cardNo: `OP-${Date.now()}`,
      name: 'New Hire',
      builderNo: `B-${Math.floor(Math.random() * 100)}`,
      skillRating: 1,
      isAbsent: false,
    };
    await actions.addOperator(newOperator);
    setOperators(prev => [...prev, newOperator]);
  };

  const removeOperator = async (cardNo: string) => {
    await actions.deleteOperator(cardNo);
    setOperators(prev => prev.filter(op => op.cardNo !== cardNo));
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shift &amp; Machines</CardTitle>
            <CardDescription>
              Configure shift times and machine availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={shift?.name} onValueChange={handleShiftChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {allShifts.map(s => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Machine Status</Label>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {machines.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-md border"
                  >
                    <span className="text-sm font-medium">{m.name}</span>
                    <Switch
                      checked={m.isAvailable}
                      onCheckedChange={checked =>
                        handleMachineChange(m.id, checked)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operators</CardTitle>
            <CardDescription>
              Manage operator skills and attendance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {operators.map(op => (
              <div key={op.cardNo} className="p-3 rounded-md border space-y-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={op.name}
                    onChange={e =>
                      handleOperatorChange(op.cardNo, 'name', e.target.value)
                    }
                    onBlur={() => handleSaveOperatorChange(op.cardNo)}
                    className="text-sm font-semibold border-none p-0 h-auto focus-visible:ring-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeOperator(op.cardNo)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Label>Builder No:</Label>
                  <Input
                    value={op.builderNo}
                    onChange={e =>
                      handleOperatorChange(
                        op.cardNo,
                        'builderNo',
                        e.target.value
                      )
                    }
                    onBlur={() => handleSaveOperatorChange(op.cardNo)}
                    className="text-sm border-none p-0 h-auto focus-visible:ring-0"
                  />
                </div>
                <div>
                  <Label>Skill: {op.skillRating}</Label>
                  <Slider
                    value={[op.skillRating]}
                    onValueChange={([val]) =>
                      handleOperatorChange(op.cardNo, 'skillRating', val)
                    }
                    onValueCommit={() => handleSaveOperatorChange(op.cardNo)}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Absent</Label>
                  <Switch
                    checked={op.isAbsent}
                    onCheckedChange={checked => {
                      handleOperatorChange(op.cardNo, 'isAbsent', checked);
                      // Save immediately on toggle
                      handleSaveOperatorChange(op.cardNo);
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={addOperator}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Operator
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card className="min-h-full flex flex-col">
          <CardHeader>
            <CardTitle>AI-Powered Assignment</CardTitle>
            <CardDescription>
              Generate optimal operator assignments based on current data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center">
            {!result && !isLoading && (
              <div className="text-center text-muted-foreground">
                <Sparkles className="mx-auto h-12 w-12" />
                <p className="mt-4">
                  Click "Optimize Assignments" to get started.
                </p>
              </div>
            )}
            {isLoading && (
              <div className="text-center text-muted-foreground">
                <Loader className="mx-auto h-12 w-12" />
                <p className="mt-4">Optimizing... Please wait.</p>
              </div>
            )}
            {result && (
              <div className="w-full space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.summary}
                  </p>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operator</TableHead>
                        <TableHead>Assigned Machine</TableHead>
                        <TableHead>Reasoning</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.assignments.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {operators.find(
                                  op => op.cardNo === a.operatorId
                                )?.name || a.operatorId}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {machines.find(m => m.id === a.machineId)
                                  ?.name || a.machineId}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              size="lg"
              onClick={handleOptimize}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Optimize Assignments
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
