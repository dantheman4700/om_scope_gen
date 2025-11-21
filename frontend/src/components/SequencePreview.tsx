import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

interface SequenceStep {
  day: number;
  subject: string;
  description: string;
}

interface SequencePreviewProps {
  steps: SequenceStep[];
}

export const SequencePreview = ({ steps }: SequencePreviewProps) => {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm">Sequence Preview</h4>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <Card key={idx}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Day {step.day}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{step.subject}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
