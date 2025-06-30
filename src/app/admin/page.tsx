"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Operator, Shift } from '@/lib/types';
import { initialOperators, initialShift } from '@/lib/data';
import { Edit, PlusCircle, Trash, UploadCloud, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

export default function AdminPage() {
  const [operators, setOperators] = useState<Operator[]>(initialOperators);
  const [shift, setShift] = useState<Shift>(initialShift);
  const { toast } = useToast();

  const handleAddOperator = () => {
    const newId = `OP-${String(operators.length + 1).padStart(3, '0')}`;
    setOperators([...operators, { id: newId, name: 'New Operator', skillRating: 3, isAbsent: false }]);
  };

  const handleSaveShifts = () => {
    toast({
      title: 'Shifts Updated',
      description: `Shift times set to ${shift.startTime} - ${shift.endTime}.`,
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <Tabs defaultValue="operators">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="operators">Operator Management</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
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
              <CardTitle>Shifts</CardTitle>
              <CardDescription>Set the default shift timings for production planning.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input id="start-time" type="time" value={shift.startTime} onChange={(e) => setShift({...shift, startTime: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input id="end-time" type="time" value={shift.endTime} onChange={(e) => setShift({...shift, endTime: e.target.value})} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveShifts}>Save Shifts</Button>
            </CardFooter>
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
