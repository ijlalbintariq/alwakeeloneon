import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Building,
  User,
  Shield,
  FileText,
  Copy,
  Check,
  Edit2,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface CaseParty {
  id: number;
  caseId: number;
  role: "client" | "opponent" | "witness" | "guarantor" | "co-accused" | "other";
  name: string;
  fatherName?: string | null;
  cnic?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface PartiesManagerProps {
  caseId: number;
  parties: CaseParty[];
}

const ROLE_CONFIG: Record<
  string,
  { label: string; urdu: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  client: {
    label: "Petitioner / Plaintiff (Client)",
    urdu: "مدعی / سائل",
    badgeClass: "bg-emerald-50 text-[#105B38] border-emerald-200",
    icon: User,
  },
  opponent: {
    label: "Respondent / Opponent",
    urdu: "مدعا علیہ / مخالف فریق",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    icon: Shield,
  },
  witness: {
    label: "Witness / Deponent",
    urdu: "گواہ",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    icon: FileText,
  },
  guarantor: {
    label: "Guarantor / Surety",
    urdu: "ضامن / مچلکہ دہندہ",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    icon: Building,
  },
  "co-accused": {
    label: "Co-Accused",
    urdu: "شریک ملزم",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  other: {
    label: "Other Interested Party",
    urdu: "دیگر فریق",
    badgeClass: "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]",
    icon: Users,
  },
};

export const PartiesManager: React.FC<PartiesManagerProps> = ({
  caseId,
  parties,
}) => {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>("");
  const [role, setRole] = useState<string>("client");
  const [fatherName, setFatherName] = useState<string>("");
  const [cnic, setCnic] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const copyToClipboard = (text: string, fieldId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast({ title: `Copied ${label}`, description: text });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const addPartyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/case-files/${caseId}/clients`, {
        name: name.trim(),
        role,
        fatherName: fatherName.trim() || undefined,
        cnic: cnic.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Party contact added" });
      setShowAddForm(false);
      setName("");
      setFatherName("");
      setCnic("");
      setPhone("");
      setEmail("");
      setAddress("");
      setNotes("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add party",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deletePartyMutation = useMutation({
    mutationFn: async (clientId: number) => {
      return apiRequest("DELETE", `/api/case-files/${caseId}/clients/${clientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Party removed" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to remove party",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const filteredParties = parties.filter((p) => {
    if (roleFilter === "all") return true;
    return p.role === roleFilter;
  });

  return (
    <div className="space-y-5">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#FAFAF9] border border-[#E5E4E2]">
        <div>
          <h2 className="text-sm font-bold font-serif text-[#1A1A1A] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1A1A1A]" />
            <span>Parties, Opponents & Witness Roster</span>
          </h2>
          <p className="text-[11px] text-[#666666]">
            Pakistani Legal Contacts, NADRA CNIC, Contact Details & Role Management
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAddForm ? "Close Form" : "Add Party / Contact"}</span>
        </button>
      </div>

      {/* 2. Add Party Collapsible Form */}
      {showAddForm && (
        <div className="p-5 rounded-xl bg-white border border-[#1A1A1A]/20 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E4E2]">
            <h3 className="text-xs font-bold text-[#1A1A1A] flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Record New Party Contact</span>
            </h3>
            <span className="text-[10px] text-[#666666] font-mono">
              NADRA CNIC Format: 35201-1234567-1
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Party Name */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Party Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Tariq Mahmood"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* Party Role */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Procedural Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] outline-none focus:border-[#1A1A1A]/50"
              >
                <option value="client">Client (Petitioner / Plaintiff)</option>
                <option value="opponent">Opponent (Respondent / Defendant)</option>
                <option value="witness">Witness / Deponent</option>
                <option value="guarantor">Guarantor / Surety</option>
                <option value="co-accused">Co-Accused</option>
                <option value="other">Other Party</option>
              </select>
            </div>

            {/* Father / Husband Name */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Parentage (Walad / Zauja)
              </label>
              <input
                type="text"
                placeholder="e.g. Muhammad Aslam"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* CNIC / NTN */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                CNIC / Passport / NTN
              </label>
              <input
                type="text"
                placeholder="35201-1234567-1"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] font-mono placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Phone / WhatsApp
              </label>
              <input
                type="text"
                placeholder="+92 300 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] font-mono placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Email Address
              </label>
              <input
                type="email"
                placeholder="client@chambers.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Residential / Business Address
              </label>
              <input
                type="text"
                placeholder="e.g. House 42, Street 8, Sector F-7/2, Islamabad"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-[10px] font-mono uppercase text-[#666666] mb-1 block">
                Advocate Notes / Instructions
              </label>
              <input
                type="text"
                placeholder="e.g. Key witness for cross-examination"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#E5E4E2] rounded-lg px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#666666] outline-none focus:border-[#1A1A1A]/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E4E2]">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs text-[#666666] hover:text-[#2D2D2D]"
            >
              Cancel
            </button>
            <button
              onClick={() => addPartyMutation.mutate()}
              disabled={!name.trim() || addPartyMutation.isPending}
              className="px-5 py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {addPartyMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>Save Party Record</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Role Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: "all", label: "All Parties", count: parties.length },
          { id: "client", label: "Clients", count: parties.filter((p) => p.role === "client").length },
          { id: "opponent", label: "Opponents", count: parties.filter((p) => p.role === "opponent").length },
          { id: "witness", label: "Witnesses", count: parties.filter((p) => p.role === "witness").length },
          { id: "guarantor", label: "Guarantors", count: parties.filter((p) => p.role === "guarantor").length },
          { id: "co-accused", label: "Co-Accused", count: parties.filter((p) => p.role === "co-accused").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRoleFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-mono whitespace-nowrap transition-all ${
              roleFilter === tab.id
                ? "bg-[#1A1A1A] text-white font-bold shadow-sm"
                : "bg-[#FAFAF9] text-[#666666] hover:text-[#2D2D2D] border border-[#E5E4E2]"
            }`}
          >
            <span>{tab.label}</span>
            <span className="ml-1.5 opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* 4. Parties Cards Grid */}
      {filteredParties.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#F5F4F2] border border-dashed border-[#E5E4E2] text-center space-y-2">
          <Users className="w-8 h-8 text-[#666666] mx-auto" />
          <p className="text-xs font-semibold text-[#4A4A4A]">
            No parties found matching the selected filter.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-[#1A1A1A] hover:underline font-semibold"
          >
            Add first party contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredParties.map((party) => {
            const roleCfg = ROLE_CONFIG[party.role] || ROLE_CONFIG.other;
            const RoleIcon = roleCfg.icon;

            return (
              <div
                key={party.id}
                className="p-4 rounded-xl bg-[#FAFAF9] border border-[#E5E4E2] hover:border-[#D9D8D6] transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Top Bar: Name & Role Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0 text-[#105B38]">
                        <RoleIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0F172A]">
                          {party.name}
                        </h3>
                        {party.fatherName && (
                          <p className="text-xs text-[#64748B]">
                            s/o, d/o, w/o {party.fatherName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full border font-semibold ${roleCfg.badgeClass}`}
                      >
                        {party.role.toUpperCase()}
                      </span>
                      <button
                        onClick={() => deletePartyMutation.mutate(party.id)}
                        disabled={deletePartyMutation.isPending}
                        title="Remove party"
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    {/* CNIC */}
                    {party.cnic && (
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-[#E2E8F0]">
                        <span className="text-xs text-[#64748B] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-[#105B38]" />
                          <span className="font-mono text-[#0F172A]">{party.cnic}</span>
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(party.cnic!, `cnic-${party.id}`, "CNIC")
                          }
                          className="text-xs text-[#64748B] hover:text-[#105B38] p-0.5"
                          title="Copy CNIC"
                        >
                          {copiedField === `cnic-${party.id}` ? (
                            <Check className="w-3.5 h-3.5 text-[#105B38]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Phone */}
                    {party.phone && (
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-[#E2E8F0]">
                        <span className="text-xs text-[#64748B] flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#105B38]" />
                          <span className="font-mono text-[#0F172A]">{party.phone}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${party.phone}`}
                            className="text-xs text-[#64748B] hover:text-[#105B38] p-0.5"
                            title="Call"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() =>
                              copyToClipboard(party.phone!, `phone-${party.id}`, "Phone")
                            }
                            className="text-xs text-[#64748B] hover:text-[#105B38] p-0.5"
                            title="Copy Phone"
                          >
                            {copiedField === `phone-${party.id}` ? (
                              <Check className="w-3.5 h-3.5 text-[#105B38]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Email */}
                    {party.email && (
                      <div className="flex items-center gap-1.5 text-[#64748B] px-1 text-xs">
                        <Mail className="w-3.5 h-3.5 text-[#105B38] shrink-0" />
                        <span className="truncate">{party.email}</span>
                      </div>
                    )}

                    {/* Address */}
                    {party.address && (
                      <div className="flex items-start gap-1.5 text-[#64748B] px-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#105B38] shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{party.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Advocate notes footer */}
                {party.notes && (
                  <div className="pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B] italic">
                    Note: {party.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default PartiesManager;
