export type ListingStatus = "active" | "archived";

export type Listing = {
  id: string;
  workspace_id: string;
  title: string;
  colors_text: string | null;
  description: string | null;
  notes: string | null;
  publication_url: string | null;
  status: ListingStatus;
  version: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type ListingInput = {
  title: string;
  colors_text: string;
  description: string;
  notes: string;
  publication_url: string;
};

export type ListingActionCode =
  | "ok"
  | "validation"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "error";

export type ListingActionState = {
  ok: boolean;
  code: ListingActionCode;
  message: string;
  listingId?: string;
};
