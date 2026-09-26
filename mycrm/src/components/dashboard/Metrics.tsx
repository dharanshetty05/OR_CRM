import {
  Award,
  Clock,
  MessageSquare,
  Percent,
  PhoneCall,
  Send,
  Users,
} from "lucide-react";

type MetricsProps = {
  totalLeads: number;
  dmsSentCount: number;
  repliesCount: number;
  replyRateDisplay: string;
  followUpsDueCount: number;
  overdueFollowUpsCount: number;
  callsBookedCount: number;
  wonCount: number;
};

export function Metrics({
  totalLeads,
  dmsSentCount,
  repliesCount,
  replyRateDisplay,
  followUpsDueCount,
  overdueFollowUpsCount,
  callsBookedCount,
  wonCount,
}: MetricsProps) {
  return (
    <section
      aria-labelledby="analytics-heading"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          id="analytics-heading"
          className="text-xs font-semibold tracking-wider uppercase text-slate-500"
        >
          Outreach Analytics
        </h2>
        <span className="text-xs text-slate-400">
          Auto-calculated from live activity
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Total Leads</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {totalLeads}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Identified targets</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">DMs Sent</span>
            <Send className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-violet-600">
            {dmsSentCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Contacted leads</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Replies</span>
            <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {repliesCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Responded to DM</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Reply Rate</span>
            <Percent className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {replyRateDisplay}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Replies / DMs Sent</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Follow-ups Due</span>
            <Clock
              className={`w-3.5 h-3.5 ${
                followUpsDueCount > 0 ? "text-amber-500" : "text-slate-400"
              }`}
            />
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              followUpsDueCount > 0 ? "text-amber-600" : "text-slate-900"
            }`}
          >
            {followUpsDueCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {overdueFollowUpsCount > 0
              ? `${overdueFollowUpsCount} overdue`
              : "Overdue + Today"}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Calls Booked</span>
            <PhoneCall className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {callsBookedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Discovery calls</div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-medium">Won</span>
            <Award className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">
            {wonCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Closed deals</div>
        </div>
      </div>
    </section>
  );
}
