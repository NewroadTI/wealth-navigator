import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export const DateField = ({ id, label, value, onChange }: DateFieldProps) => (
  <div>
    <Label htmlFor={id} className="text-sm">
      {label}
    </Label>
    <div className="relative mt-1">
      <Input
        id={id}
        type="date"
        placeholder="No setup"
        className={`focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border focus:ring-0 focus:border-border focus:outline-none focus-visible:outline-none ${
          value ? '' : 'text-muted-foreground'
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'dark' }}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={() => onChange('')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);
