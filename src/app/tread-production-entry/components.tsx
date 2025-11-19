'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Calendar } from '../../../components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import {
  CalendarIcon,
  Copy,
  Trash2,
  Save,
  Edit,
  XCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { format } from 'date-fns';
import type { ShiftInfo } from '../../../lib/types';

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple';
}

export function SummaryCard({ title, value, icon, color }: SummaryCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  return (
    <Card className={cn('shadow-sm hover:shadow-md transition-shadow', colorClasses[color])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-800">{value}</div>
      </CardContent>
    </Card>
  );
}

interface ControlsProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: (isOpen: boolean) => void;
  selectedShift: ShiftInfo | undefined;
  setSelectedShift: (shift: ShiftInfo | undefined) => void;
  allShifts: ShiftInfo[];
  isEditing: boolean;
  handleCopyFromPreviousDay: () => void;
  handleClearAll: () => void;
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  handleEditToggle: () => void;
  handleSave: () => void;
  hasUnsavedChanges: boolean;
  sapCodeFilter: string;
  setSapCodeFilter: (filter: string) => void;
  skuFilter: string;
  setSkuFilter: (filter: string) => void;
}

export function Controls({
  selectedDate,
  setSelectedDate,
  isDatePickerOpen,
  setIsDatePickerOpen,
  selectedShift,
  setSelectedShift,
  allShifts,
  isEditing,
  handleCopyFromPreviousDay,
  handleClearAll,
  autoSaveEnabled,
  setAutoSaveEnabled,
  handleEditToggle,
  handleSave,
  hasUnsavedChanges,
  sapCodeFilter,
  setSapCodeFilter,
  skuFilter,
  setSkuFilter,
}: ControlsProps) {
  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !selectedDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date: Date | undefined) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select
              value={selectedShift?.name}
              onValueChange={(name: string) =>
                setSelectedShift(allShifts.find((s) => s.name === name))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {allShifts.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Input
              placeholder="🔍 Filter by SAP Code..."
              value={sapCodeFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSapCodeFilter(e.target.value)}
            />
            <Input
              placeholder="🔍 Filter by SKU..."
              value={skuFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSkuFilter(e.target.value)}
            />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-save"
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
            <Label htmlFor="auto-save">Auto-save</Label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromPreviousDay}
              disabled={!isEditing}
              title="Copy from previous day"
            >
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={!isEditing}
              title="Clear all entries"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear
            </Button>
            <Button
              variant={isEditing ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleEditToggle}
            >
              {isEditing ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
              disabled={!isEditing || !hasUnsavedChanges}
            >
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

export function QuantityInput({ value, onChange, disabled }: QuantityInputProps) {
  const handleChange = (increment: number) => {
    const newValue = value + increment;
    if (newValue >= 0) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        className="w-24 text-right"
        placeholder="0"
        disabled={disabled}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(parseInt(e.target.value, 10) || 0)}
      />
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => handleChange(1)}
          disabled={disabled}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => handleChange(-1)}
          disabled={disabled}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
