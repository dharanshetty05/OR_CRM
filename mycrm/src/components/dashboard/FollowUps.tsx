import { AlertTriangle, Calendar, Check, Clock, ExternalLink } from "lucide-react";
import type { FollowUpDisplayItem, FollowUpGroup } from "./types";

type FollowUpsProps = {
  overdueFollowUps: FollowUpDisplayItem[];
  todayFollowUps: FollowUpDisplayItem[];
  upcomingFollowUps: FollowUpDisplayItem[];
  activeCount: number;
  onMarkReplied: (leadId: string) => void;
  onCompleteFollowUp: (leadId: string) => void;
};

type ColumnStyle = {
  columnBorder: string;
  headerBorder: string;
  heading: string;
  dot: string;
  badge: string;
  empty: string;
};

const COLUMN_STYLES: Record<FollowUpGroup, ColumnStyle> = {
  OVERDUE: {
    columnBorder: "border-rose-200/80",
    headerBorder: "border-rose-100",
    heading: "text-rose-950",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800",
    empty: "No overdue follow-ups. You are on track!",
  },
  TODAY: {
    columnBorder: "border-amber-200/80",
    headerBorder: "border-amber-100",
    heading: "text-amber-950",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
    empty: "No follow-ups scheduled for today.",
  },
  UPCOMING: {
    columnBorder: "border-slate-200",
    headerBorder: "border-slate-100",
    heading: "text-slate-800",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700",
    empty: "No upcoming follow-ups queued.",
  },
};

function FollowUpItemCard({
  item,
  group,
  onMarkReplied,
  onCompleteFollowUp,
}: {
  item: FollowUpDisplayItem;
  group: FollowUpGroup;
  onMarkReplied: (leadId: string) => void;
  onCompleteFollowUp: (leadId: string) => void;
}) {
  const cardClass =
    group === "OVERDUE"
      ? "p-3 rounded-lg bg-rose-50/50 border border-rose-200 hover:border-rose-300 transition-colors"
      : group === "TODAY"
        ? "p-3 rounded-lg bg-amber-50/50 border border-amber-200 hover:border-amber-300 transition-colors"
        : "p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors";

  const badgeClass =
    group === "OVERDUE"
      ? "inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold rounded bg-rose-100 text-rose-800 shrink-0"
      : group === "TODAY"
        ? "inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-800 shrink-0"
        : "inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded bg-slate-200 text-slate-700 shrink-0";

  const metaClass =
    group === "OVERDUE"
      ? "mt-2 text-xs flex items-center justify-between text-rose-700"
      : group === "TODAY"
        ? "mt-2 text-xs flex items-center justify-between text-amber-800"
        : "mt-2 text-xs flex items-center justify-between text-slate-600";

  const dividerClass =
    group === "OVERDUE"
      ? "mt-3 pt-2.5 border-t border-rose-200/60 flex items-center justify-between gap-2"
      : group === "TODAY"
        ? "mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between gap-2"
        : "mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2";

  const completeButtonClass =
    group === "OVERDUE"
      ? "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-2xs"
      : group === "TODAY"
        ? "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-2xs"
        : "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-900 text-white transition-colors";

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm text-slate-900">{item.businessName}</div>
          <div className="text-xs text-slate-500">
            {item.niche} • {item.location}
          </div>
        </div>
        <span className={badgeClass}>Follow-up #{item.followUpNumber}</span>
      </div>

      <div className={metaClass}>
        <span
          className={
            group === "UPCOMING"
              ? "inline-flex items-center gap-1"
              : "inline-flex items-center gap-1 font-medium"
          }
        >
          {group === "OVERDUE" && <AlertTriangle className="w-3 h-3" />}
          {group === "TODAY" && <Clock className="w-3 h-3 text-amber-600" />}
          {group === "UPCOMING" && <Calendar className="w-3 h-3 text-slate-400" />}
          {group === "OVERDUE" && `Due: ${item.dateStr} at ${item.timeStr}`}
          {group === "TODAY" && `Today at ${item.timeStr}`}
          {group === "UPCOMING" && `${item.dateStr} at ${item.timeStr}`}
        </span>
        <a
          href={item.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-600 hover:text-violet-800 font-medium inline-flex items-center gap-0.5"
        >
          IG Profile
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      <div className={dividerClass}>
        <button
          type="button"
          onClick={() => onMarkReplied(item.leadId)}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Replied?
        </button>
        <button
          type="button"
          onClick={() => onCompleteFollowUp(item.leadId)}
          className={completeButtonClass}
        >
          <Check className="w-3 h-3" />
          Complete F/U #{item.followUpNumber}
        </button>
      </div>
    </div>
  );
}

function FollowUpColumn({
  title,
  group,
  items,
  onMarkReplied,
  onCompleteFollowUp,
}: {
  title: string;
  group: FollowUpGroup;
  items: FollowUpDisplayItem[];
  onMarkReplied: (leadId: string) => void;
  onCompleteFollowUp: (leadId: string) => void;
}) {
  const styles = COLUMN_STYLES[group];

  return (
    <div
      className={`bg-white rounded-xl border ${styles.columnBorder} shadow-xs p-4 flex flex-col`}
    >
      <div
        className={`flex items-center justify-between mb-3 pb-2 border-b ${styles.headerBorder}`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
          <h3 className={`text-sm font-semibold ${styles.heading}`}>{title}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 my-auto">{styles.empty}</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <FollowUpItemCard
              key={item.leadId}
              item={item}
              group={group}
              onMarkReplied={onMarkReplied}
              onCompleteFollowUp={onCompleteFollowUp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FollowUps({
  overdueFollowUps,
  todayFollowUps,
  upcomingFollowUps,
  activeCount,
  onMarkReplied,
  onCompleteFollowUp,
}: FollowUpsProps) {
  return (
    <section
      aria-labelledby="followups-heading"
      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h2
            id="followups-heading"
            className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
          >
            <span>Follow-ups Queue</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
              {activeCount} active
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Schedule: Follow-up #1 (+1 day) → Follow-up #2 (+3 days). Mark complete to
            progress.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <FollowUpColumn
          title="Overdue"
          group="OVERDUE"
          items={overdueFollowUps}
          onMarkReplied={onMarkReplied}
          onCompleteFollowUp={onCompleteFollowUp}
        />
        <FollowUpColumn
          title="Due Today"
          group="TODAY"
          items={todayFollowUps}
          onMarkReplied={onMarkReplied}
          onCompleteFollowUp={onCompleteFollowUp}
        />
        <FollowUpColumn
          title="Upcoming"
          group="UPCOMING"
          items={upcomingFollowUps}
          onMarkReplied={onMarkReplied}
          onCompleteFollowUp={onCompleteFollowUp}
        />
      </div>
    </section>
  );
}
