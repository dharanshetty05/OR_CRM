import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  PhoneCall,
  Send,
} from "lucide-react";
import type { Lead, LeadStatus } from "./types";

type LeadActions = {
  onMarkDMSent: (leadId: string) => void;
  onCompleteFollowUp: (leadId: string) => void;
  onMarkReplied: (leadId: string) => void;
  onMarkCallBooked: (leadId: string) => void;
  onMarkWon: (leadId: string) => void;
  onMarkLost: (leadId: string) => void;
};

type LeadRowProps = LeadActions & {
  lead: Lead;
  variant: "table" | "card";
};

function instagramHandle(url: string): string {
  return url
    .replace("https://instagram.com/", "@")
    .replace("https://www.instagram.com/", "@")
    .replace(/\/$/, "");
}

function websiteLabel(url: string): string {
  let webDomain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (webDomain === "#") webDomain = "No site";
  return webDomain;
}

function StatusBadge({ status }: { status: LeadStatus }) {
  switch (status) {
    case "NOT_CONTACTED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          Not Contacted
        </span>
      );
    case "DM_SENT":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
          DM Sent
        </span>
      );
    case "REPLIED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          Replied
        </span>
      );
    case "CALL_BOOKED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Call Booked
        </span>
      );
    case "WON":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Won
        </span>
      );
    case "LOST":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
          Lost
        </span>
      );
  }
}

function NextFollowUpBadge({ lead }: { lead: Lead }) {
  if (!lead.nextFollowUp) {
    if (lead.status === "NOT_CONTACTED") {
      return <span className="text-xs text-slate-400">Not scheduled</span>;
    }
    if (lead.status === "WON") {
      return <span className="text-xs text-emerald-600 font-medium">Completed</span>;
    }
    if (lead.status === "LOST") {
      return <span className="text-xs text-slate-400">None</span>;
    }
    if (lead.status === "REPLIED" || lead.status === "CALL_BOOKED") {
      return <span className="text-xs text-violet-600 font-medium">In discussion</span>;
    }
    return <span className="text-xs text-slate-400">Cadence finished</span>;
  }

  const fuDate = new Date(lead.nextFollowUp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compDate = new Date(fuDate);
  compDate.setHours(0, 0, 0, 0);

  const isOverdue = compDate.getTime() < today.getTime();
  const isToday = compDate.getTime() === today.getTime();

  const fuNum = lead.followUpCount + 1;
  const formatted = fuDate.toLocaleDateString("en-IE", {
    month: "short",
    day: "numeric",
  });

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        F/U #{fuNum} • Overdue ({formatted})
      </span>
    );
  }

  if (isToday) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 shrink-0" />
        F/U #{fuNum} • Due Today
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      <Calendar className="w-3 h-3 shrink-0 text-slate-500" />
      F/U #{fuNum} • {formatted}
    </span>
  );
}

function TableActions({ lead, ...actions }: LeadActions & { lead: Lead }) {
  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      {lead.status === "NOT_CONTACTED" && (
        <button
          type="button"
          onClick={() => actions.onMarkDMSent(lead.leadId)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-violet-600 hover:bg-violet-700 text-white shadow-2xs transition-colors"
        >
          <Send className="w-3 h-3" />
          Mark DM Sent
        </button>
      )}

      {lead.status === "DM_SENT" && (
        <>
          {lead.nextFollowUp && (
            <button
              type="button"
              onClick={() => actions.onCompleteFollowUp(lead.leadId)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
              title="Mark follow-up done"
            >
              <Check className="w-3 h-3 text-slate-600" />
              Done F/U #{lead.followUpCount + 1}
            </button>
          )}
          <button
            type="button"
            onClick={() => actions.onMarkReplied(lead.leadId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Replied
          </button>
        </>
      )}

      {lead.status === "REPLIED" && (
        <>
          <button
            type="button"
            onClick={() => actions.onMarkCallBooked(lead.leadId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
          >
            <PhoneCall className="w-3 h-3" />
            Book Call
          </button>
          <button
            type="button"
            onClick={() => actions.onMarkLost(lead.leadId)}
            className="px-1.5 py-1 text-xs text-slate-400 hover:text-rose-600 transition-colors"
            title="Mark Lost"
          >
            Lost
          </button>
        </>
      )}

      {lead.status === "CALL_BOOKED" && (
        <>
          <button
            type="button"
            onClick={() => actions.onMarkWon(lead.leadId)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors"
          >
            <Award className="w-3 h-3" />
            Mark Won
          </button>
          <button
            type="button"
            onClick={() => actions.onMarkLost(lead.leadId)}
            className="px-1.5 py-1 text-xs text-slate-400 hover:text-rose-600 transition-colors"
            title="Mark Lost"
          >
            Lost
          </button>
        </>
      )}

      {lead.status === "WON" && (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold px-2 py-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Deal Won
        </span>
      )}

      {lead.status === "LOST" && (
        <button
          type="button"
          onClick={() => actions.onMarkDMSent(lead.leadId)}
          className="text-xs text-slate-500 hover:text-violet-600 transition-colors"
        >
          Restart Cadence
        </button>
      )}
    </div>
  );
}

function CardActions({ lead, ...actions }: LeadActions & { lead: Lead }) {
  return (
    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
      {lead.status === "NOT_CONTACTED" && (
        <button
          type="button"
          onClick={() => actions.onMarkDMSent(lead.leadId)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-700 text-white shadow-2xs transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          Mark DM Sent
        </button>
      )}

      {lead.status === "DM_SENT" && (
        <div className="w-full grid grid-cols-2 gap-2">
          {lead.nextFollowUp && (
            <button
              type="button"
              onClick={() => actions.onCompleteFollowUp(lead.leadId)}
              className="inline-flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
            >
              <Check className="w-3 h-3 text-slate-600" />
              Done F/U #{lead.followUpCount + 1}
            </button>
          )}
          <button
            type="button"
            onClick={() => actions.onMarkReplied(lead.leadId)}
            className="inline-flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Mark Replied
          </button>
        </div>
      )}

      {lead.status === "REPLIED" && (
        <div className="w-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => actions.onMarkLost(lead.leadId)}
            className="text-xs text-slate-400 hover:text-rose-600 py-1.5 px-2"
          >
            Lost
          </button>
          <button
            type="button"
            onClick={() => actions.onMarkCallBooked(lead.leadId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Mark Call Booked
          </button>
        </div>
      )}

      {lead.status === "CALL_BOOKED" && (
        <div className="w-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => actions.onMarkLost(lead.leadId)}
            className="text-xs text-slate-400 hover:text-rose-600 py-1.5 px-2"
          >
            Lost
          </button>
          <button
            type="button"
            onClick={() => actions.onMarkWon(lead.leadId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            <Award className="w-3.5 h-3.5" />
            Mark Won
          </button>
        </div>
      )}

      {lead.status === "WON" && (
        <div className="w-full text-center text-xs text-emerald-600 font-semibold py-1">
          Won Contract
        </div>
      )}

      {lead.status === "LOST" && (
        <button
          type="button"
          onClick={() => actions.onMarkDMSent(lead.leadId)}
          className="text-xs text-slate-500 hover:text-violet-600 py-1"
        >
          Restart Cadence
        </button>
      )}
    </div>
  );
}

export function LeadRow({ lead, variant, ...actions }: LeadRowProps) {
  const instaHandle = instagramHandle(lead.instagramUrl);
  const webDomain = websiteLabel(lead.websiteUrl);

  if (variant === "table") {
    return (
      <tr className="hover:bg-slate-50/70 transition-colors">
        <td className="py-3.5 px-4 font-semibold text-slate-900">
          <div>{lead.businessName}</div>
          {lead.outcome && (
            <div className="text-[11px] text-slate-400 font-normal">{lead.outcome}</div>
          )}
        </td>
        <td className="py-3.5 px-3 text-slate-600">{lead.location}</td>
        <td className="py-3.5 px-3 text-slate-600 max-w-[140px] truncate">{lead.niche}</td>
        <td className="py-3.5 px-3">
          <a
            href={lead.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-600 hover:text-violet-800 hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>{instaHandle}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </td>
        <td className="py-3.5 px-3">
          {lead.websiteUrl !== "#" ? (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-1"
            >
              <span>{webDomain}</span>
              <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="py-3.5 px-3">
          <StatusBadge status={lead.status} />
        </td>
        <td className="py-3.5 px-3">
          <NextFollowUpBadge lead={lead} />
        </td>
        <td className="py-3.5 px-4 text-right">
          <TableActions lead={lead} {...actions} />
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm text-slate-900">{lead.businessName}</h3>
          <p className="text-xs text-slate-500">
            {lead.niche} • {lead.location}
          </p>
        </div>
        <div>
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <a
          href={lead.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-600 font-medium inline-flex items-center gap-1"
        >
          <span>{instaHandle}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        {lead.websiteUrl !== "#" && (
          <a
            href={lead.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 inline-flex items-center gap-1"
          >
            <span>{webDomain}</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span className="text-slate-500 font-medium">Follow-up:</span>
        <div>
          <NextFollowUpBadge lead={lead} />
        </div>
      </div>

      {lead.outcome && (
        <div className="text-xs bg-slate-50 rounded p-2 text-slate-600">{lead.outcome}</div>
      )}

      <CardActions lead={lead} {...actions} />
    </div>
  );
}
