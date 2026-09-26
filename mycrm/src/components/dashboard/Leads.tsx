import { Search } from "lucide-react";
import { LeadRow } from "./LeadRow";
import type { Lead, StatusFilter } from "./types";

type LeadsProps = {
  leads: Lead[];
  filteredLeads: Lead[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onMarkDMSent: (leadId: string) => void;
  onCompleteFollowUp: (leadId: string) => void;
  onMarkReplied: (leadId: string) => void;
  onMarkCallBooked: (leadId: string) => void;
  onMarkWon: (leadId: string) => void;
  onMarkLost: (leadId: string) => void;
};

export function Leads({
  leads,
  filteredLeads,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onMarkDMSent,
  onCompleteFollowUp,
  onMarkReplied,
  onMarkCallBooked,
  onMarkWon,
  onMarkLost,
}: LeadsProps) {
  const rowActions = {
    onMarkDMSent,
    onCompleteFollowUp,
    onMarkReplied,
    onMarkCallBooked,
    onMarkWon,
    onMarkLost,
  };

  return (
    <section
      aria-labelledby="leads-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2
            id="leads-heading"
            className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
          >
            <span>Outreach Leads</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredLeads.length} of {leads.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Direct Instagram outreach pipeline & action center
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search business, location, niche..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="ALL">All Statuses ({leads.length})</option>
            <option value="NOT_CONTACTED">Not Contacted</option>
            <option value="DM_SENT">DM Sent</option>
            <option value="REPLIED">Replied</option>
            <option value="CALL_BOOKED">Call Booked</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      </div>

      <div className="hidden md:block bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Niche</th>
                <th className="py-3 px-3">Instagram</th>
                <th className="py-3 px-3">Website</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Next Follow-up</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No leads match your current search or filter.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <LeadRow key={lead.leadId} lead={lead} variant="table" {...rowActions} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            No leads match your criteria.
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadRow key={lead.leadId} lead={lead} variant="card" {...rowActions} />
          ))
        )}
      </div>
    </section>
  );
}
