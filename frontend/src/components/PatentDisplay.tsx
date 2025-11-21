import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Download, FileText, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PatentDisplayProps {
  patentCount?: number | null;
  patents?: string[] | null;
  patentFileUrl?: string | null;
  isAnonymized?: boolean;
  hasAccess?: boolean;
  visibilityLevel?: string;
}

interface ParsedPatent {
  fullNumber: string;
  country: string;
  countryName: string;
  number: string;
  kindCode: string;
  type: 'Application' | 'Granted' | 'Design' | 'Unknown';
  family?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CN': 'China',
  'WO': 'International (PCT)',
  'EP': 'European Patent',
  'JP': 'Japan',
  'KR': 'South Korea',
  'DE': 'Germany',
  'FR': 'France',
  'CA': 'Canada',
};

export const PatentDisplay = ({
  patentCount,
  patents,
  patentFileUrl,
  isAnonymized = false,
  hasAccess = true,
  visibilityLevel = 'public'
}: PatentDisplayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { toast } = useToast();
  
  const parsePatent = (patentNumber: string): ParsedPatent => {
    const trimmed = patentNumber.trim();
    const countryMatch = trimmed.match(/^([A-Z]{2})/);
    const country = countryMatch ? countryMatch[1] : 'XX';
    const countryName = COUNTRY_NAMES[country] || country;
    
    // Extract kind code (last part after numbers)
    const kindMatch = trimmed.match(/([A-Z]\d?)$/);
    const kindCode = kindMatch ? kindMatch[1] : '';
    
    // Determine patent type based on kind code
    let type: 'Application' | 'Granted' | 'Design' | 'Unknown' = 'Unknown';
    if (kindCode.startsWith('A')) {
      type = 'Application';
    } else if (kindCode.startsWith('B') || kindCode.startsWith('C')) {
      type = 'Granted';
    } else if (kindCode.startsWith('S') || kindCode.startsWith('D')) {
      type = 'Design';
    }
    
    // Extract base number for family grouping
    const numberMatch = trimmed.match(/[A-Z]{2}(\d+)/);
    const baseNumber = numberMatch ? numberMatch[1].substring(0, 6) : trimmed;
    
    return {
      fullNumber: trimmed,
      country,
      countryName,
      number: trimmed.replace(/^[A-Z]{2}/, ''),
      kindCode,
      type,
      family: `${country}-${baseNumber}`
    };
  };
  
  const parsedPatents = useMemo(() => {
    if (!patents) return [];
    return patents.map(p => parsePatent(p));
  }, [patents]);
  
  const groupedPatents = useMemo(() => {
    const groups: Record<string, ParsedPatent[]> = {};
    parsedPatents.forEach(patent => {
      if (!groups[patent.country]) {
        groups[patent.country] = [];
      }
      groups[patent.country].push(patent);
    });
    return groups;
  }, [parsedPatents]);
  
  const displayedGroups = useMemo(() => {
    const entries = Object.entries(groupedPatents);
    return showAll ? entries : entries.slice(0, 3);
  }, [groupedPatents, showAll]);
  
  const handlePatentClick = async (patent: string) => {
    const url = `https://patents.google.com/patent/${patent.trim()}/en`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Patent URL copied to clipboard. Paste it in your browser to view.",
      });
    } catch (err) {
      toast({
        title: "Opening patent...",
        description: "If the page doesn't open, try copying the link manually.",
        variant: "destructive",
      });
      window.open(url, '_blank');
    }
  };
  
  const displayCount = patentCount || patents?.length || 0;
  const hasPatentList = patents && patents.length > 0;
  const initialDisplayLimit = 10;
  const displayedPatents = showAll ? patents : patents?.slice(0, initialDisplayLimit);

  // If no patents, don't render anything
  if (!displayCount && !patentFileUrl) return null;

  // Check if details should be hidden
  const hideDetails = isAnonymized || (visibilityLevel === 'private' && !hasAccess);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm text-foreground">Patents</h4>
          {displayCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {displayCount} patent{displayCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {patentFileUrl && !isAnonymized && (visibilityLevel === 'public' || hasAccess) && (
          <a 
            href={patentFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <Button size="sm" variant="outline">
              <Download className="h-3 w-3 mr-1" />
              Download Full List
            </Button>
          </a>
        )}
      </div>

      {hideDetails ? (
        <p className="text-sm text-muted-foreground">
          {displayCount > 0 ? `${displayCount} patent${displayCount !== 1 ? 's' : ''} available` : 'Patent information available'}
          {isAnonymized && ' (details hidden for anonymized listing)'}
          {visibilityLevel === 'private' && !hasAccess && ' (sign NDA to view details)'}
        </p>
      ) : (
        <>
          {!hasPatentList && displayCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {displayCount} patent{displayCount !== 1 ? 's' : ''} - Download file for full list
            </p>
          )}

          {hasPatentList && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto font-normal text-sm text-primary hover:text-primary/80 hover:bg-transparent"
                >
                  {isOpen ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide patent portfolio
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      View patent portfolio
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3">
                <div className="bg-muted/30 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Globe className="h-3 w-3" />
                    <span>Grouped by Jurisdiction ({Object.keys(groupedPatents).length} countries)</span>
                  </div>
                  
                  {displayedGroups.map(([country, countryPatents]) => (
                    <div key={country} className="space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <Badge variant="outline" className="text-xs">
                          {country}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {countryPatents[0].countryName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {countryPatents.length} patent{countryPatents.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-1.5">
                        {countryPatents.map((patent, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePatentClick(patent.fullNumber)}
                            className="flex items-center gap-3 text-sm bg-background/50 hover:bg-background/80 px-3 py-2 rounded transition-colors cursor-pointer border-none text-left w-full group"
                          >
                            <span className="text-muted-foreground text-xs flex-shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-mono text-primary group-hover:underline flex-shrink-0">
                              {patent.fullNumber}
                            </span>
                            <div className="flex items-center gap-2 ml-auto">
                              <Badge 
                                variant={patent.type === 'Granted' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {patent.type}
                              </Badge>
                              {patent.kindCode && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {patent.kindCode}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {Object.keys(groupedPatents).length > 3 && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll(!showAll)}
                        className="w-full"
                      >
                        {showAll ? (
                          <>Show less</>
                        ) : (
                          <>Show {Object.keys(groupedPatents).length - 3} more countries</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {!displayCount && !hasPatentList && patentFileUrl && (
            <p className="text-sm text-muted-foreground">
              Download file for patent details
            </p>
          )}
        </>
      )}
    </div>
  );
};
