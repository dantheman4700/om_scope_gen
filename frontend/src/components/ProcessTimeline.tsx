import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TimelineStep {
  title: string;
  description: string;
  deadline?: string;
  isHighlight?: boolean;
}

const steps: TimelineStep[] = [
  {
    title: "NDA Execution",
    description: "Sign NDA to access confidential information and data room"
  },
  {
    title: "Due Diligence",
    description: "Review data room, technical documentation, and asset inventory"
  },
  {
    title: "Letter of Intent (LOI)",
    description: "Submit LOI with proposed terms and purchase price",
    deadline: "Friday, August 15, 2025",
    isHighlight: true
  },
  {
    title: "Buyer Selection",
    description: "Assignee evaluates offers and selects preferred buyer"
  },
  {
    title: "Transaction Close",
    description: "Execute Asset Purchase Agreement and complete transaction"
  }
];

export const ProcessTimeline = () => {
  return (
    <div className="space-y-6">
      {steps.map((step, index) => (
        <div key={index} className="relative flex gap-4">
          {/* Timeline Line */}
          {index < steps.length - 1 && (
            <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
          )}
          
          {/* Step Icon */}
          <div className="relative flex-shrink-0">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              step.isHighlight 
                ? 'bg-accent text-accent-foreground' 
                : 'bg-primary/10 text-primary'
            }`}>
              {step.isHighlight ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </div>
          </div>

          {/* Step Content */}
          <Card className={`flex-1 ${step.isHighlight ? 'border-2 border-accent' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">
                      {index + 1}. {step.title}
                    </h4>
                    {step.isHighlight && (
                      <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent">
                        Deadline
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  {step.deadline && (
                    <p className="text-sm font-semibold text-accent-foreground mt-2">
                      📅 {step.deadline}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};
