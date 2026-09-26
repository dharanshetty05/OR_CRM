export type LeadStatus =
  | "NOT_CONTACTED"
  | "DM_SENT"
  | "REPLIED"
  | "CALL_BOOKED"
  | "WON"
  | "LOST";

export type Lead = {
  leadId: string;
  businessName: string;
  location: string;
  niche: string;
  instagramUrl: string;
  websiteUrl: string;
  status: LeadStatus;
  dmSentAt?: string;
  nextFollowUp?: string;
  followUpCount: number;
  replyDate?: string;
  callBookedDate?: string;
  outcome?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpGroup = "OVERDUE" | "TODAY" | "UPCOMING";

export type FollowUpDisplayItem = {
  leadId: string;
  businessName: string;
  followUpNumber: number;
  dueDate: string;
  dateStr: string;
  timeStr: string;
  status: LeadStatus;
  instagramUrl: string;
  niche: string;
  location: string;
  group: FollowUpGroup;
};

export type StatusFilter = "ALL" | LeadStatus;
