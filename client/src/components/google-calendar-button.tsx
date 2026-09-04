import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Calendar, Download, ExternalLink } from "lucide-react";
import {
  CourtHearingCalendarEvent,
  buildGoogleCalendarUrl,
  buildIcsCalendarFile,
} from "@shared/calendar-builder";
import { useToast } from "@/hooks/use-toast";

interface GoogleCalendarButtonProps {
  event: CourtHearingCalendarEvent;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function GoogleCalendarButton({
  event,
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
}: GoogleCalendarButtonProps) {
  const { toast } = useToast();

  const handleOpenGoogleCalendar = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = buildGoogleCalendarUrl(event);
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "Opening Google Calendar",
        description: `Pre-filled hearing for ${event.caseNumber || event.title}`,
      });
    } catch (err: any) {
      toast({
        title: "Calendar Error",
        description: err?.message || "Could not open Google Calendar",
        variant: "destructive",
      });
    }
  };

  const handleDownloadIcs = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const icsContent = buildIcsCalendarFile(event);
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      const safeFilename = (event.caseNumber || event.title)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-");
      link.setAttribute("download", `${safeFilename}-${event.date}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);

      toast({
        title: "iCal File Downloaded",
        description: "Ready to import into Apple Calendar or Outlook.",
      });
    } catch (err: any) {
      toast({
        title: "Export Error",
        description: err?.message || "Could not export iCal file",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-1.5 text-xs font-medium ${className}`}
          title="Add to Google Calendar or export iCal"
          onClick={(e) => e.stopPropagation()}
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          {showLabel && <span>Add to Calendar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={handleOpenGoogleCalendar}
          className="cursor-pointer gap-2 text-xs py-2"
        >
          <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Google Calendar</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDownloadIcs}
          className="cursor-pointer gap-2 text-xs py-2"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Download .ICS (Apple/Outlook)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
