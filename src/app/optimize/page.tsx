"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Loader2, PlusCircle, Sparkles, Trash, User, Wrench } from 'lucide-react';
import type { Operator, Machine, ShiftInfo } from '@/lib/types';
import { initialOperators, initialMachines, shifts } from '@/lib/data';
import { optimizeOperatorAssignment } from './actions';
import type { OptimizeOperatorAssignmentOutput } from '@/ai/flows/optimize-operator-assignment';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OptimizePage() {
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [shift, setShift] = useState<ShiftInfo>(shifts[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptimizeOperatorAssignmentOutput | null>(null);
  const { toast } = useToast();

  const handleOptimize = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const input = {
        operators: operators.map(op => ({ operatorId: op.id, skillRating: op.skillRating })),
        machines: machines.map(m => ({ machineId: m.id, isAvailable: m.isAvailable })),
        shiftTimes: shift,
        absenteeism: operators.map(op => ({ operatorId: op.id, isAbsent: op.isAbsent })),
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

  const handleOperatorChange = (id: string, field: keyof Operator, value: any) => {
    setOperators(ops => ops.map(op => (op.id === id ? { ...op, [field]: value } : op)));
  };

  const handleMachineChange = (id: string, field: keyof Machine, value: any) => {
    setMachines(macs => macs.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };
  
  const handleShiftChange = (name: string) => {
    const selectedShift = shifts.find((s) => s.name === name);
    if (selectedShift) {
      setShift(selectedShift);
    }
  };

  const addOperator = () => {
    const newId = `OP-${String(Date.now()).slice(-4)}`;
    setOperators([...operators, {id: newId, name: 'New Hire', skillRating: 1, isAbsent: false}]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shift &amp; Machines</CardTitle>
            <CardDescription>Configure shift times and machine availability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={shift.name} onValueChange={handleShiftChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
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
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-md border">
                        <span className="text-sm font-medium">{m.name}</span>
                        <Switch checked={m.isAvailable} onCheckedChange={(checked) => handleMachineChange(m.id, 'isAvailable', checked)} />
                    </div>
                ))}
                </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Operators</CardTitle>
                <CardDescription>Manage operator skills and attendance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {operators.map(op => (
                    <div key={op.id} className="p-3 rounded-md border space-y-3">
                        <div className="flex items-center justify-between">
                            <Input value={op.name} onChange={e => handleOperatorChange(op.id, 'name', e.target.value)} className="text-sm font-semibold border-none p-0 h-auto focus-visible:ring-0"/>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOperators(ops => ops.filter(o => o.id !== op.id))}><Trash className="h-4 w-4"/></Button>
                        </div>
                        <div>
                            <Label>Skill: {op.skillRating}</Label>
                            <Slider value={[op.skillRating]} onValueChange={([val]) => handleOperatorChange(op.id, 'skillRating', val)} min={1} max={5} step={1} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Absent</Label>
                            <Switch checked={op.isAbsent} onCheckedChange={(checked) => handleOperatorChange(op.id, 'isAbsent', checked)} />
                        </div>
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button variant="outline" onClick={addOperator}><PlusCircle className="w-4 h-4 mr-2"/>Add Operator</Button>
            </CardFooter>
        </Card>

      </div>
      <div className="lg:col-span-2">
        <Card className="min-h-full flex flex-col">
          <CardHeader>
            <CardTitle>AI-Powered Assignment</CardTitle>
            <CardDescription>Generate optimal operator assignments based on current data.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center">
            {!result && !isLoading && (
              <div className="text-center text-muted-foreground">
                <Sparkles className="mx-auto h-12 w-12" />
                <p className="mt-4">Click "Optimize Assignments" to get started.</p>
              </div>
            )}
            {isLoading && (
              <div className="text-center text-muted-foreground">
                <Loader2 className="mx-auto h-12 w-12 animate-spin" />
                <p className="mt-4">Optimizing... Please wait.</p>
              </div>
            )}
            {result && (
              <div className="w-full space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Summary</h3>
                  <p className="text-sm text-muted-foreground">{result.summary}</p>
                </div>
                <div className="border rounded-lg">
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
                            <TableCell><div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/><span>{operators.find(op => op.id === a.operatorId)?.name || a.operatorId}</span></div></TableCell>
                            <TableCell><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground"/><span>{a.machineId}</span></div></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{a.reason}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button size="lg" onClick={handleOptimize} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
