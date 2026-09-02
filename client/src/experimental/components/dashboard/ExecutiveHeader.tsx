import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Scale,
  Bot,
  FileSignature,
  Gavel,
  Plus,
  Clock,
  Sparkles,
  Award,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ExecutiveHeaderProps {
  onOpenAddHearing?: () => void;
}

export const ExecutiveHeader: React.FC<ExecutiveHeaderProps> = ({
  onOpenAddHearing,
}) => {
  const { user } = useAuth();
  const [courtStatus, setCourtStatus] = useState<{
    status: "in_session" | "recess" | "chambers" | "closed";
    label: string;
    sublabel: string;
    color: "emerald" | "amber" | "blue" | "slate";
  }>({
    status: "in_session",
    label: "Court in Session",
    sublabel: "Principal Seat & Division Benches Active",
    color: "emerald",
  });

  useEffect(() => {
    const updateCourtStatus = () => {
      try {
        const now = new Date();
        const pktDate = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Karachi" })
        );
        const hours = pktDate.getHours();
        const minutes = pktDate.getMinutes();
        const timeVal = hours + minutes / 60;
        const day = pktDate.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

        // Weekend
        if (day === 0 || day === 6) {
          setCourtStatus({
            status: "chambers",
            label: "Weekend Chamber Hours",
            sublabel: "Courts Closed · Chambers Research Active",
            color: "blue",
          });
          return;
        }

        // Friday schedule (early recess for Friday prayers)
        if (day === 5) {
          if (timeVal >= 8.5 && timeVal < 12.5) {
            setCourtStatus({
              status: "in_session",
              label: "Friday Morning Bench in Session",
              sublabel: "08:30 AM – 12:30 PM PKT",
              color: "emerald",
            });
          } else if (timeVal >= 12.5 && timeVal < 14.5) {
            setCourtStatus({
              status: "recess",
              label: "Friday Judicial Recess",
              sublabel: "Juma Prayer Recess · Resumes Chamber 2:30 PM",
              color: "amber",
            });
          } else if (timeVal >= 14.5 && timeVal < 19.5) {
            setCourtStatus({
              status: "chambers",
              label: "Evening Chamber Consultations",
              sublabel: "Chamber Drafting & Client Conferences",
              color: "blue",
            });
          } else {
            setCourtStatus({
              status: "closed",
              label: "Chambers Offline",
              sublabel: "Automated Cause List Monitoring Active",
              color: "slate",
            });
          }
          return;
        }

        // Mon - Thu schedule
        if (timeVal >= 8.5 && timeVal < 11.5) {
          setCourtStatus({
            status: "in_session",
            label: "Morning Division Bench in Session",
            sublabel: "Motion Cases & Urgent Cause List · 08:30 – 11:30 AM",
            color: "emerald",
          });
        } else if (timeVal >= 11.5 && timeVal < 12.0) {
          setCourtStatus({
            status: "recess",
            label: "Bench Midday Tea Recess",
            sublabel: "Resuming Regular Cause List at 12:00 PM PKT",
            color: "amber",
          });
        } else if (timeVal >= 12.0 && timeVal < 15.5) {
          setCourtStatus({
            status: "in_session",
            label: "Regular Hearing Bench in Session",
            sublabel: "Regular Cases & Arguments · 12:00 – 03:30 PM",
            color: "emerald",
          });
        } else if (timeVal >= 15.5 && timeVal < 20.0) {
          setCourtStatus({
            status: "chambers",
            label: "Evening Chamber Practice Hours",
            sublabel: "Client Conferences, Strategy & Drafting",
            color: "blue",
          });
        } else {
          setCourtStatus({
            status: "closed",
            label: "Courts & Chambers Adjourned",
            sublabel: "Next Judicial Day Commences 08:30 AM PKT",
            color: "slate",
          });
        }
      } catch {
        // fallback
      }
    };

    updateCourtStatus();
    const interval = setInterval(updateCourtStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const counselName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.email ? user.email.split("@")[0] : "Counsel");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="rounded-xl border border-[#E5E4E2] bg-[#FFFFFF] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Greeting */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1A1A1A]">
            {greeting}, {counselName}
          </h1>
          <p className="text-xs sm:text-sm text-[#666666]">
            Litigation docket, precedent intelligence, and chambers compliance.
          </p>
        </div>

        {/* Right: Quick Action Launch Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/preview/chat"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#000000] text-white font-medium text-xs transition-all shadow-xs"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Consult AI</span>
          </Link>

          <Link
            href="/preview/drafting"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#EBEBEB] text-[#1A1A1A] font-medium text-xs border border-[#E5E4E2] transition-colors"
          >
            <FileSignature className="w-3.5 h-3.5 text-[#1A1A1A]" />
            <span>Draft</span>
          </Link>

          {onOpenAddHearing && (
            <button
              type="button"
              onClick={onOpenAddHearing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#EBEBEB] text-[#1A1A1A] font-medium text-xs border border-[#E5E4E2] transition-colors"
              title="Add Hearing"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Hearing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
