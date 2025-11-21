import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface DomainSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const DomainSelector = ({ value, onChange }: DomainSelectorProps) => {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Domain Configuration</h4>
      <RadioGroup value={value} onValueChange={onChange}>
        <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="platform" id="platform" className="mt-1" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="platform" className="font-medium cursor-pointer">
              Platform Domain (Recommended)
            </Label>
            <p className="text-sm text-muted-foreground">
              Send from: @sherwoodpartners.com - ready to use immediately
            </p>
            <Badge variant="outline" className="mt-2 border-green-500 text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified & Ready
            </Badge>
          </div>
        </div>

        <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="client" id="client" className="mt-1" />
          <div className="flex-1 space-y-1">
            <Label htmlFor="client" className="font-medium cursor-pointer">
              Client Domain (Advanced)
            </Label>
            <p className="text-sm text-muted-foreground">
              Send from your company domain for better deliverability
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Requires DNS configuration
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
};
