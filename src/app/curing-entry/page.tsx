
'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { saveCuringLogEntry } from '../actions';
import type { CuringLogEntry, SkuPlan } from '@/lib/types';
import * as actions from '../actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CuringEntryPage() {
  const [pressNo, setPressNo] = useState('');
  const [cavity1Sku, setCavity1Sku] = useState('');
  const [cavity1Qty, setCavity1Qty] = useState('');
  const [cavity2Sku, setCavity2Sku] = useState('');
  const [cavity2Qty, setCavity2Qty] = useState('');

  const [allSkus, setAllSkus] = useState<SkuPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  // Refs for focusing inputs
  const pressNoRef = useRef<HTMLInputElement>(null);
  const cavity1SkuRef = useRef<HTMLButtonElement>(null); // For SelectTrigger
  const cavity1QtyRef = useRef<HTMLInputElement>(null);
  const cavity2SkuRef = useRef<HTMLButtonElement>(null); // For SelectTrigger
  const cavity2QtyRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const plan = await actions.getProductionPlan();
      const skus = plan.flatMap(p => p.skus);
      const uniqueSkus = Array.from(new Map(skus.map(s => [s.sku, s])).values());
      setAllSkus(uniqueSkus);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load SKUs',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const clearForm = useCallback(() => {
    setPressNo('');
    setCavity1Sku('');
    setCavity1Qty('');
    setCavity2Sku('');
    setCavity2Qty('');
    pressNoRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const entry: CuringLogEntry = {
      press_no: parseInt(pressNo, 10),
      cavity1_sku: cavity1Sku,
      cavity1_qty: parseInt(cavity1Qty, 10) || 0,
      cavity2_sku: cavity2Sku,
      cavity2_qty: parseInt(cavity2Qty, 10) || 0,
    };

    if (!entry.press_no) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Press No. is required.',
      });
      return;
    }

    try {
      const result = await saveCuringLogEntry(entry);
      if (result.success) {
        toast({
          title: '✅ Record saved successfully',
        });
        clearForm();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save failed',
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'An error occurred',
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLButtonElement>, nextRef: React.RefObject<HTMLInputElement | HTMLButtonElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8">
          <h1 className="text-3xl font-bold text-center mb-8">Production Entry</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="press-no" className="text-lg">Press No.</Label>
              <Input
                id="press-no"
                ref={pressNoRef}
                type="number"
                value={pressNo}
                onChange={(e) => setPressNo(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, cavity1SkuRef)}
                placeholder="1-42"
                className="text-lg p-6"
                min="1"
                max="42"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cavity1-sku" className="text-lg">Cavity 1 SKU</Label>
              <Select value={cavity1Sku} onValueChange={setCavity1Sku}>
                  <SelectTrigger ref={cavity1SkuRef} onKeyDown={(e) => handleKeyDown(e, cavity1QtyRef)} id="cavity1-sku" className="text-lg h-16">
                      <SelectValue placeholder="Select SKU" />
                  </SelectTrigger>
                  <SelectContent>
                      {allSkus.map(s => <SelectItem key={s.sapCode} value={s.sku}>{s.sku}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cavity1-qty" className="text-lg">Cavity 1 Quantity</Label>
              <Input
                id="cavity1-qty"
                ref={cavity1QtyRef}
                type="number"
                value={cavity1Qty}
                onChange={(e) => setCavity1Qty(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, cavity2SkuRef)}
                className="text-lg p-6"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cavity2-sku" className="text-lg">Cavity 2 SKU</Label>
              <Select value={cavity2Sku} onValueChange={setCavity2Sku}>
                  <SelectTrigger ref={cavity2SkuRef} onKeyDown={(e) => handleKeyDown(e, cavity2QtyRef)} id="cavity2-sku" className="text-lg h-16">
                      <SelectValue placeholder="Select SKU" />
                  </SelectTrigger>
                  <SelectContent>
                      {allSkus.map(s => <SelectItem key={s.sapCode} value={s.sku}>{s.sku}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cavity2-qty" className="text-lg">Cavity 2 Quantity</Label>
              <Input
                id="cavity2-qty"
                ref={cavity2QtyRef}
                type="number"
                value={cavity2Qty}
                onChange={(e) => setCavity2Qty(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, submitButtonRef)}
                className="text-lg p-6"
                placeholder="0"
              />
            </div>

            <Button
              ref={submitButtonRef}
              type="submit"
              className="w-full text-xl p-8 bg-green-600 hover:bg-green-700"
            >
              SUBMIT
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
