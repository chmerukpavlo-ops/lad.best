export type ListingStatus = "active" | "archived";

export type Listing = {
  id: string;
  workspace_id: string;
  title: string;
  brand: string | null;
  /** DB numeric as string, e.g. "3200.00"; null if unset */
  list_price: string | null;
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

/** Listing row enriched for list UI. */
export type ListingListItem = Listing & {
  last_ad_paid_on: string | null;
};

export type ListingInput = {
  title: string;
  brand: string;
  /** Empty string = no price; otherwise UAH decimal string for form */
  list_price: string;
  /** Parsed kopiyky when price set; null when empty */
  list_price_kopiyky: number | null;
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
