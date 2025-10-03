
'use client';

import {useState, useEffect, useMemo, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {useToast} from '@/hooks/use-toast';
import type {
  ProductionPlanItem,
  TreadStock,
  Machine,
  SkuPlan,
} from '@/lib/types';
import {
  Save,
  SlidersHorizontal,
  ClipboardList,
  Factory,
  Scale,
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Skeleton} from '@/components/ui/skeleton';
import * as actions from '../actions';

interface EnrichedSkuPlan extends SkuPlan {
  machineId: string;
  machineName: string;
}

export default function TreadExtrusionPage() {
  const {toast} = useToast();

  const [loading, setLoading] = useState(true);
  const [productionPlan, setProductionPlan] = useState<ProductionPlanItem[]>(
    []
  );
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [openingStockData, setOpeningStockData] = useState<TreadStock[]>([]);
  const [tyreProductionData, setTyreProductionData] = useState<
    Record<string, number>
  >({});
  const [totalProductionBySapCode, setTotalProductionBySapCode] = useState<
    Record<string, number>
  >({});

  const [columnVisibility, setColumnVisibility] = useState({
    tbmNo: true,
    sapCode: true,
    quantity: true,
    openingStock: true,
    production: true,
    tyreProduction: true,
    currentTreadStock: true,
    treadBalanceToProduce: true,
  });

  const [sapCodeFilter, setSapCodeFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plan, machines, stock, dailyLogs, historyLogs] = await Promise.all([
        actions.getProductionPlan(),
        actions.getMachines('TBM'),
        actions.getTreadOpeningStock(),
        actions.getDailyTreadProductionLog(),
        actions.getProductionLogs(),
      ]);

      setProductionPlan(plan);
      setAllMachines(machines);
      setOpeningStockData(stock);

      const dailyTotals: Record<string, number> = {};
      for (const dateKey in dailyLogs) {
        for (const shiftName in dailyLogs[dateKey]) {
          for (const sapCode in dailyLogs[dateKey][shiftName]) {
            dailyTotals[sapCode] =
              (dailyTotals[sapCode] || 0) +
              (dailyLogs[dateKey][shiftName][sapCode].quantity || 0);
          }
        }
      }
      setTotalProductionBySapCode(dailyTotals);

      const tyreProd: Record<string, number> = {};
      (historyLogs as any[])
        .filter(log => log.machineName && log.machineName.startsWith('CP'))
        .forEach(entry => {
          if (entry.sapCode && entry.quantity > 0) {
            tyreProd[entry.sapCode] =
              (tyreProd[entry.sapCode] || 0) + (entry.quantity || 0);
          }
        });
      setTyreProductionData(tyreProd);
    } catch (error) {
      console.error('Failed to load data', error);
      toast({variant: 'destructive', title: 'Error loading data'});
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allSkusFromPlan = useMemo((): EnrichedSkuPlan[] => {
    const machineMap = new Map(allMachines.map(m => [m.id, m.name]));
    return productionPlan.flatMap(item =>
      item.skus.map(skuPlan => ({
        ...skuPlan,
        machineId: item.machineId,
        machineName: machineMap.get(item.machineId) || item.machineId,
      }))
    );
  }, [productionPlan, allMachines]);

  const handleOpeningStockChange = useCallback(
    (sapCode: string, value: string) => {
      const numericValue = parseInt(value, 10) || 0;
      setOpeningStockData(currentData => {
        const existingIndex = currentData.findIndex(
          item => item.sapCode === sapCode
        );
        if (existingIndex > -1) {
          return currentData.map((item, index) =>
            index === existingIndex
              ? {...item, openingStock: numericValue}
              : item
          );
        }
        const planSku = allSkusFromPlan.find(s => s.sapCode === sapCode);
        return [
          ...currentData,
          {
            sku: planSku?.sku || '',
            sapCode: sapCode,
            openingStock: numericValue,
            production: 0,
            currentTreadStock: 0,
          },
        ];
      });
    },
    [allSkusFromPlan]
  );

  const handleSaveOpeningStock = useCallback(async () => {
    await actions.saveTreadOpeningStock(openingStockData);
    toast({
      title: 'Success!',
      description: 'Opening stock data has been saved.',
      action: <Save className="text-green-500" />,
    });
  }, [openingStockData, toast]);

  const filteredSkus = useMemo(() => {
    return allSkusFromPlan.filter(
      req =>
        (req.sapCode?.toLowerCase() || '').includes(
          sapCodeFilter.toLowerCase()
        ) && (req.sku?.toLowerCase() || '').includes(skuFilter.toLowerCase())
    );
  }, [allSkusFromPlan, sapCodeFilter, skuFilter]);

  const combinedData = useMemo(() => {
    return filteredSkus.map(req => {
      const openingStockInfo = openingStockData.find(
        t => t.sapCode === req.sapCode
      ) || {openingStock: 0};
      const totalProduction = totalProductionBySapCode[req.sapCode] || 0;
      const tyreProduction = tyreProductionData[req.sapCode] || 0;
      const currentTreadStock =
        openingStockInfo.openingStock + totalProduction - tyreProduction;
      const treadBalanceToProduce = Math.max(
        0,
        (req.quantity || 0) - currentTreadStock
      );
      return {
        ...req,
        openingStock: openingStockInfo.openingStock,
        production: totalProduction,
        tyreProduction,
        currentTreadStock,
        treadBalanceToProduce,
      };
    });
  }, [
    filteredSkus,
    openingStockData,
    tyreProductionData,
    totalProductionBySapCode,
  ]);

  const visibleColumnsCount =
    1 + Object.values(columnVisibility).filter(Boolean).length;

  const summary = useMemo(() => {
    const totalRequirement = allSkusFromPlan.reduce(
      (acc, item) => acc + (item.quantity || 0),
      0
    );
    // Use a Set to avoid double-counting production for a SAP code that might appear multiple times
    const uniqueSapCodes = [...new Set(allSkusFromPlan.map(s => s.sapCode))];
    const totalProduction = uniqueSapCodes.reduce(
      (acc, sapCode) => acc + (totalProductionBySapCode[sapCode] || 0),
      0
    );
    const totalCurrentStock = uniqueSapCodes.reduce(
      (acc, sapCode) => {
          const openingStockInfo = openingStockData.find(t => t.sapCode === sapCode) || { openingStock: 0 };
          const production = totalProductionBySapCode[sapCode] || 0;
          const consumption = tyreProductionData[sapCode] || 0;
          return acc + (openingStockInfo.openingStock + production - consumption);
      },
      0
    );
    return {totalRequirement, totalProduction, totalCurrentStock};
  }, [allSkusFromPlan, openingStockData, totalProductionBySapCode, tyreProductionData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Tread Extrusion Planning
        </h1>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Tread Extrusion Planning
      </h1>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Production Plan
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalRequirement.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total units in the production plan.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Tread Production
            </CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalProduction.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total tread units produced to date.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tread Stock</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalCurrentStock.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Current available tread in stock.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Tread Stock &amp; Planning</CardTitle>
            <CardDescription>
              Manage tread inventory and plan production to meet the production
              plan.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.tbmNo}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, tbmNo: !!value}))
                  }
                >
                  TBM No
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.sapCode}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, sapCode: !!value}))
                  }
                >
                  SAP Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.quantity}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({...prev, quantity: !!value}))
                  }
                >
                  Plan Quantity
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.openingStock}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({
                      ...prev,
                      openingStock: !!value,
                    }))
                  }
                >
                  Opening Stock
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.production}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({
                      ...prev,
                      production: !!value,
                    }))
                  }
                >
                  Total Production
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.tyreProduction}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({
                      ...prev,
                      tyreProduction: !!value,
                    }))
                  }
                >
                  Tyre Production
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.currentTreadStock}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({
                      ...prev,
                      currentTreadStock: !!value,
                    }))
                  }
                >
                  Current Tread Stock
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.treadBalanceToProduce}
                  onCheckedChange={value =>
                    setColumnVisibility(prev => ({
                      ...prev,
                      treadBalanceToProduce: !!value,
                    }))
                  }
                >
                  Tread Balance to Produce
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleSaveOpeningStock}>
              <Save className="mr-2 h-4 w-4" /> Save Opening Stock
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 my-4">
            <Input
              placeholder="Filter by SAP Code..."
              value={sapCodeFilter}
              onChange={e => setSapCodeFilter(e.target.value)}
              className="max-w-sm"
            />
            <Input
              placeholder="Filter by SKU..."
              value={skuFilter}
              onChange={e => setSkuFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.tbmNo && <TableHead>TBM No</TableHead>}
                  {columnVisibility.sapCode && <TableHead>SAP Code</TableHead>}
                  <TableHead>SKU</TableHead>
                  {columnVisibility.quantity && (
                    <TableHead className="text-right">Plan Quantity</TableHead>
                  )}
                  {columnVisibility.openingStock && (
                    <TableHead className="text-right">Opening Stock</TableHead>
                  )}
                  {columnVisibility.production && (
                    <TableHead className="text-right">
                      Total Production
                    </TableHead>
                  )}
                  {columnVisibility.tyreProduction && (
                    <TableHead className="text-right">
                      Tyre Production
                    </TableHead>
                  )}
                  {columnVisibility.currentTreadStock && (
                    <TableHead className="text-right">
                      Current Tread Stock
                    </TableHead>
                  )}
                  {columnVisibility.treadBalanceToProduce && (
                    <TableHead className="text-right">
                      Tread Balance to Produce
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedData.length > 0 ? (
                  combinedData.map((item, index) => (
                    <TableRow key={`${item.sapCode}-${index}`}>
                      {columnVisibility.tbmNo && (
                        <TableCell>{item.machineName}</TableCell>
                      )}
                      {columnVisibility.sapCode && (
                        <TableCell>{item.sapCode}</TableCell>
                      )}
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      {columnVisibility.quantity && (
                        <TableCell className="text-right">
                          {item.quantity.toLocaleString()}
                        </TableCell>
                      )}
                      {columnVisibility.openingStock && (
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            className="w-28 ml-auto text-right"
                            placeholder="0"
                            value={
                              openingStockData.find(
                                s => s.sapCode === item.sapCode
                              )?.openingStock || ''
                            }
                            onChange={e =>
                              handleOpeningStockChange(
                                item.sapCode,
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                      )}
                      {columnVisibility.production && (
                        <TableCell className="text-right">
                          {item.production.toLocaleString()}
                        </TableCell>
                      )}
                      {columnVisibility.tyreProduction && (
                        <TableCell className="text-right">
                          {item.tyreProduction.toLocaleString()}
                        </TableCell>
                      )}
                      {columnVisibility.currentTreadStock && (
                        <TableCell className="text-right font-bold">
                          {item.currentTreadStock.toLocaleString()}
                        </TableCell>
                      )}
                      {columnVisibility.treadBalanceToProduce && (
                        <TableCell
                          className={cn(
                            'text-right font-bold',
                            item.treadBalanceToProduce > 0
                              ? 'text-destructive'
                              : 'text-green-600'
                          )}
                        >
                          {item.treadBalanceToProduce.toLocaleString()}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumnsCount}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No data matches your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
