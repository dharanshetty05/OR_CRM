"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, X } from "lucide-react";
import { FollowUps } from "@/components/dashboard/FollowUps";
import { Header } from "@/components/dashboard/Header";
import { Leads } from "@/components/dashboard/Leads";
import { Metrics } from "@/components/dashboard/Metrics";
import type {
  FollowUpDisplayItem,
  FollowUpGroup,
  Lead,
  StatusFilter,
} from "@/components/dashboard/types";

const createRelativeDate = (daysOffset: number, hours = 10, minutes = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const getInitialSampleLeads = (): Lead[] => [
  {
    leadId: "lead-1",
    businessName: "Rebel Green Landscaping",
    location: "Cork",
    niche: "Landscaping & Paving",
    instagramUrl: "https://instagram.com/rebelgreenlandscapes",
    websiteUrl: "https://rebelgreen.ie",
    status: "NOT_CONTACTED",
    followUpCount: 0,
    createdAt: createRelativeDate(-2),
    updatedAt: createRelativeDate(-2),
  },
  {
    leadId: "lead-2",
    businessName: "Lee Valley Plumbing & Heating",
    location: "Cork",
    niche: "Emergency Plumbing & Boilers",
    instagramUrl: "https://instagram.com/leevalleyplumbing",
    websiteUrl: "https://leevalleyplumbing.ie",
    status: "DM_SENT",
    dmSentAt: createRelativeDate(-1, 10, 30),
    nextFollowUp: createRelativeDate(0, 10, 30),
    followUpCount: 0,
    createdAt: createRelativeDate(-2),
    updatedAt: createRelativeDate(-1),
  },
  {
    leadId: "lead-3",
    businessName: "Apex Dublin Roofing & Guttering",
    location: "Dublin",
    niche: "Roofing & Gutter Repair",
    instagramUrl: "https://instagram.com/apexdublinroofing",
    websiteUrl: "https://apexdublinroofing.com",
    status: "DM_SENT",
    dmSentAt: createRelativeDate(-3, 11, 0),
    nextFollowUp: createRelativeDate(-1, 11, 0),
    followUpCount: 0,
    createdAt: createRelativeDate(-4),
    updatedAt: createRelativeDate(-3),
  },
  {
    leadId: "lead-4",
    businessName: "Corrib Spark Electrical Services",
    location: "Galway",
    niche: "Domestic & Commercial Electrical",
    instagramUrl: "https://instagram.com/corribspark",
    websiteUrl: "https://corribspark.ie",
    status: "DM_SENT",
    dmSentAt: createRelativeDate(-1, 14, 0),
    nextFollowUp: createRelativeDate(2, 14, 0),
    followUpCount: 1,
    createdAt: createRelativeDate(-3),
    updatedAt: createRelativeDate(0),
  },
  {
    leadId: "lead-5",
    businessName: "Shannon Air & Heat Solutions",
    location: "Limerick",
    niche: "Heat Pumps & Air Conditioning",
    instagramUrl: "https://instagram.com/shannonairheat",
    websiteUrl: "https://shannonairheat.ie",
    status: "REPLIED",
    dmSentAt: createRelativeDate(-4, 9, 15),
    replyDate: createRelativeDate(-1, 16, 20),
    followUpCount: 1,
    outcome: "Interested in SEO & lead-gen review",
    createdAt: createRelativeDate(-5),
    updatedAt: createRelativeDate(-1),
  },
  {
    leadId: "lead-6",
    businessName: "Shandon Deco Painters",
    location: "Cork",
    niche: "Interior & Exterior Painting",
    instagramUrl: "https://instagram.com/shandondecopainters",
    websiteUrl: "https://shandondeco.ie",
    status: "CALL_BOOKED",
    dmSentAt: createRelativeDate(-5, 10, 0),
    replyDate: createRelativeDate(-3, 15, 0),
    callBookedDate: createRelativeDate(1, 14, 30),
    followUpCount: 1,
    outcome: "Audit call scheduled for tomorrow 2:30 PM",
    createdAt: createRelativeDate(-6),
    updatedAt: createRelativeDate(-2),
  },
  {
    leadId: "lead-7",
    businessName: "Liffey Garden Crafts",
    location: "Dublin",
    niche: "Garden Design & Stonework",
    instagramUrl: "https://instagram.com/liffeygardencrafts",
    websiteUrl: "https://liffeygardencrafts.ie",
    status: "WON",
    dmSentAt: createRelativeDate(-10, 11, 30),
    replyDate: createRelativeDate(-8, 14, 0),
    callBookedDate: createRelativeDate(-6, 11, 0),
    followUpCount: 2,
    outcome: "Client signed quarterly retainer (€2,200/mo)",
    createdAt: createRelativeDate(-12),
    updatedAt: createRelativeDate(-4),
  },
  {
    leadId: "lead-8",
    businessName: "Suir Flow Plumbing",
    location: "Waterford",
    niche: "Bathroom Renovations & Plumbing",
    instagramUrl: "https://instagram.com/suirflowplumbing",
    websiteUrl: "https://suirflow.ie",
    status: "LOST",
    dmSentAt: createRelativeDate(-7, 10, 0),
    replyDate: createRelativeDate(-6, 12, 10),
    followUpCount: 1,
    outcome: "Has in-house marketing coordinator",
    createdAt: createRelativeDate(-8),
    updatedAt: createRelativeDate(-5),
  },
];

const STORAGE_KEY = "mycrm_instagram_leads_data";

function loadLeads(): Lead[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Lead[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore parse errors, fallback to sample leads
  }
  return getInitialSampleLeads();
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>(loadLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  const [newBusinessName, setNewBusinessName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNiche, setNewNiche] = useState("");
  const [newInstagram, setNewInstagram] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  const showNotification = (msg: string) => {
    setQuickNotice(msg);
    setTimeout(() => {
      setQuickNotice((current) => (current === msg ? null : current));
    }, 3500);
  };

  const handleResetSampleData = () => {
    setLeads(getInitialSampleLeads());
    showNotification("Sample data reloaded successfully");
  };

  const handleMarkDMSent = (leadId: string) => {
    const now = new Date();
    const isoNow = now.toISOString();

    const fu1 = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    fu1.setHours(10, 0, 0, 0);

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;
        return {
          ...lead,
          status: "DM_SENT",
          dmSentAt: isoNow,
          nextFollowUp: fu1.toISOString(),
          followUpCount: 0,
          updatedAt: isoNow,
        };
      })
    );

    const lead = leads.find((l) => l.leadId === leadId);
    showNotification(
      `DM recorded for ${lead?.businessName ?? "lead"}. Follow-up #1 scheduled (+1 day)`
    );
  };

  const handleCompleteFollowUp = (leadId: string) => {
    const now = new Date();
    const isoNow = now.toISOString();

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;

        const currentCount = lead.followUpCount;
        let nextFUDatetime: string | undefined;

        if (currentCount === 0) {
          const dmBase = lead.dmSentAt ? new Date(lead.dmSentAt) : now;
          const fu2 = new Date(dmBase.getTime() + 3 * 24 * 60 * 60 * 1000);
          fu2.setHours(10, 0, 0, 0);

          if (fu2.getTime() <= now.getTime()) {
            fu2.setTime(now.getTime() + 1 * 24 * 60 * 60 * 1000);
            fu2.setHours(10, 0, 0, 0);
          }

          nextFUDatetime = fu2.toISOString();
        } else {
          nextFUDatetime = undefined;
        }

        return {
          ...lead,
          followUpCount: currentCount + 1,
          nextFollowUp: nextFUDatetime,
          updatedAt: isoNow,
        };
      })
    );

    const lead = leads.find((l) => l.leadId === leadId);
    const completedNum = (lead?.followUpCount ?? 0) + 1;
    if (completedNum === 1) {
      showNotification(
        `Follow-up #1 completed for ${lead?.businessName}. Follow-up #2 scheduled.`
      );
    } else {
      showNotification(
        `Follow-up #2 completed for ${lead?.businessName}. Cadence finished.`
      );
    }
  };

  const handleMarkReplied = (leadId: string) => {
    const isoNow = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;
        return {
          ...lead,
          status: "REPLIED",
          replyDate: isoNow,
          nextFollowUp: undefined,
          updatedAt: isoNow,
        };
      })
    );
    const target = leads.find((l) => l.leadId === leadId);
    showNotification(`Marked replied: ${target?.businessName ?? "lead"}`);
  };

  const handleMarkCallBooked = (leadId: string) => {
    const isoNow = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;
        return {
          ...lead,
          status: "CALL_BOOKED",
          callBookedDate: isoNow,
          nextFollowUp: undefined,
          updatedAt: isoNow,
        };
      })
    );
    const target = leads.find((l) => l.leadId === leadId);
    showNotification(`Call booked with ${target?.businessName ?? "lead"}! 🎉`);
  };

  const handleMarkWon = (leadId: string) => {
    const isoNow = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;
        return {
          ...lead,
          status: "WON",
          nextFollowUp: undefined,
          updatedAt: isoNow,
        };
      })
    );
    const target = leads.find((l) => l.leadId === leadId);
    showNotification(`Won deal with ${target?.businessName ?? "lead"}! 🏆`);
  };

  const handleMarkLost = (leadId: string) => {
    const isoNow = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.leadId !== leadId) return lead;
        return {
          ...lead,
          status: "LOST",
          nextFollowUp: undefined,
          updatedAt: isoNow,
        };
      })
    );
    const target = leads.find((l) => l.leadId === leadId);
    showNotification(`Marked lost: ${target?.businessName ?? "lead"}`);
  };

  const handleAddNewLead = (e: FormEvent) => {
    e.preventDefault();
    if (!newBusinessName.trim()) return;

    let formattedInsta = newInstagram.trim();
    if (formattedInsta && !formattedInsta.startsWith("http")) {
      formattedInsta = `https://instagram.com/${formattedInsta.replace("@", "")}`;
    }

    let formattedWeb = newWebsite.trim();
    if (formattedWeb && !formattedWeb.startsWith("http")) {
      formattedWeb = `https://${formattedWeb}`;
    }

    const isoNow = new Date().toISOString();
    const newEntry: Lead = {
      leadId: `lead-${Date.now()}`,
      businessName: newBusinessName.trim(),
      location: newLocation.trim() || "Ireland",
      niche: newNiche.trim() || "Home Services",
      instagramUrl: formattedInsta || "https://instagram.com",
      websiteUrl: formattedWeb || "#",
      status: "NOT_CONTACTED",
      followUpCount: 0,
      createdAt: isoNow,
      updatedAt: isoNow,
    };

    setLeads((prev) => [newEntry, ...prev]);
    setNewBusinessName("");
    setNewLocation("");
    setNewNiche("");
    setNewInstagram("");
    setNewWebsite("");
    setIsAddModalOpen(false);
    showNotification(`Added new lead: ${newEntry.businessName}`);
  };

  const totalLeads = leads.length;

  const dmsSentCount = leads.filter(
    (l) => l.status !== "NOT_CONTACTED" || Boolean(l.dmSentAt)
  ).length;

  const repliesCount = leads.filter(
    (l) =>
      l.status === "REPLIED" ||
      l.status === "CALL_BOOKED" ||
      l.status === "WON" ||
      Boolean(l.replyDate)
  ).length;

  const replyRateDisplay =
    dmsSentCount === 0
      ? "0.0%"
      : `${((repliesCount / dmsSentCount) * 100).toFixed(1)}%`;

  const callsBookedCount = leads.filter(
    (l) => l.status === "CALL_BOOKED" || Boolean(l.callBookedDate)
  ).length;

  const wonCount = leads.filter((l) => l.status === "WON").length;

  const followUpItems = useMemo<FollowUpDisplayItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: FollowUpDisplayItem[] = [];

    leads.forEach((lead) => {
      if (!lead.nextFollowUp) return;
      if (lead.status === "WON" || lead.status === "LOST" || lead.status === "REPLIED") {
        return;
      }

      const fuDate = new Date(lead.nextFollowUp);
      if (isNaN(fuDate.getTime())) return;

      const dateOnly = new Date(fuDate);
      dateOnly.setHours(0, 0, 0, 0);

      let group: FollowUpGroup;
      if (dateOnly.getTime() < today.getTime()) {
        group = "OVERDUE";
      } else if (dateOnly.getTime() === today.getTime()) {
        group = "TODAY";
      } else {
        group = "UPCOMING";
      }

      const dateStr = fuDate.toLocaleDateString("en-IE", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const timeStr = fuDate.toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
      });

      items.push({
        leadId: lead.leadId,
        businessName: lead.businessName,
        followUpNumber: lead.followUpCount + 1,
        dueDate: lead.nextFollowUp,
        dateStr,
        timeStr,
        status: lead.status,
        instagramUrl: lead.instagramUrl,
        niche: lead.niche,
        location: lead.location,
        group,
      });
    });

    return items.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [leads]);

  const overdueFollowUps = useMemo(
    () => followUpItems.filter((item) => item.group === "OVERDUE"),
    [followUpItems]
  );

  const todayFollowUps = useMemo(
    () => followUpItems.filter((item) => item.group === "TODAY"),
    [followUpItems]
  );

  const upcomingFollowUps = useMemo(
    () => followUpItems.filter((item) => item.group === "UPCOMING"),
    [followUpItems]
  );

  const followUpsDueCount = overdueFollowUps.length + todayFollowUps.length;

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        searchQuery === "" ||
        lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.niche.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 selection:bg-violet-100 selection:text-violet-900">
      {quickNotice && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{quickNotice}</span>
        </div>
      )}

      <Header
        onResetSampleData={handleResetSampleData}
        onAddLead={() => setIsAddModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Metrics
          totalLeads={totalLeads}
          dmsSentCount={dmsSentCount}
          repliesCount={repliesCount}
          replyRateDisplay={replyRateDisplay}
          followUpsDueCount={followUpsDueCount}
          overdueFollowUpsCount={overdueFollowUps.length}
          callsBookedCount={callsBookedCount}
          wonCount={wonCount}
        />

        <FollowUps
          overdueFollowUps={overdueFollowUps}
          todayFollowUps={todayFollowUps}
          upcomingFollowUps={upcomingFollowUps}
          activeCount={followUpItems.length}
          onMarkReplied={handleMarkReplied}
          onCompleteFollowUp={handleCompleteFollowUp}
        />

        <Leads
          leads={leads}
          filteredLeads={filteredLeads}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onMarkDMSent={handleMarkDMSent}
          onCompleteFollowUp={handleCompleteFollowUp}
          onMarkReplied={handleMarkReplied}
          onMarkCallBooked={handleMarkCallBooked}
          onMarkWon={handleMarkWon}
          onMarkLost={handleMarkLost}
        />
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add Outreach Lead</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewLead} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cork Prestige Roofing"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cork / Dublin"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Niche / Service
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Roofing & Repairs"
                    value={newNiche}
                    onChange={(e) => setNewNiche(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Instagram URL or @handle
                </label>
                <input
                  type="text"
                  placeholder="e.g. @corkroofing or https://instagram.com/corkroofing"
                  value={newInstagram}
                  onChange={(e) => setNewInstagram(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Website URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. corkroofing.ie"
                  value={newWebsite}
                  onChange={(e) => setNewWebsite(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
