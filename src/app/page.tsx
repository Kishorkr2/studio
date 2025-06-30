"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BellRing, CheckCircle, Truck } from 'lucide-react';
import type { MachineProductionData } from '@/lib/types';
import { initialProductionData } from '@/lib/data';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { toast } = useToast();
  const [productionData, setProductionData] = useState<MachineProductionData[]>(initialProductionData);
  const [lastSubmission, setLastSubmission] = useState<Date | null>(null);

  useEffect(() => {
    const notificationInterval = setInterval(() => {
      if (lastSubmission === null || (new Date().getTime() - lastSubmission.getTime()) > 3600000) { // 1 hour
        toast({
          title: 'Production Data Reminder',
          description: 'Please submit the hourly production data.',
          action: <BellRing className="text-accent" />,
        });
      }
    }, 3600000); // Check every hour

    return () => clearInterval(notificationInterval);
  }, [toast, lastSubmission]);
  
  const handleInputChange = (machineId: string, field: 'sku' | 'quantity', value: string) => {
    setProductionData(prevData =>
      prevData.map(machine =>
        machine.machineId === machineId
          ? {
              ...machine,
              [field]: field === 'quantity' ? parseInt(value, 10) || 0 : value,
            }
          : machine
      )
    );
  };
  
  const handleSubmitAll = () => {
    console.log('Submitting data:', productionData);
    setLastSubmission(new Date());
    toast({
      title: 'Success!',
      description: 'All production data has been submitted.',
      action: <CheckCircle className="text-green-500" />,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Panel</h1>
          <p className="text-muted-foreground">Hourly data entry for Tyre Building Machines (TBMs)</p>
        </div>
        <Button onClick={handleSubmitAll}>Submit All Data</Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productionData.map(({ machineId, name, status, sku, quantity }) => (
            <Card key={machineId} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{name}</span>
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full',
                      status === 'Online' ? 'bg-green-500' : 'bg-red-500'
                    )}
                    title={`Status: ${status}`}
                  ></div>
                </CardTitle>
                <CardDescription>ID: {machineId}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`sku-${machineId}`}>SKU</Label>
                  <Input
                    id={`sku-${machineId}`}
                    placeholder="e.g., P-215-65R17"
                    value={sku}
                    onChange={(e) => handleInputChange(machineId, 'sku', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`quantity-${machineId}`}>Quantity</Label>
                  <Input
                    id={`quantity-${machineId}`}
                    type="number"
                    placeholder="e.g., 50"
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => handleInputChange(machineId, 'quantity', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
