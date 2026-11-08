export type AdPaymentStatus = "valid" | "void";

export type AdPayment = {
  id: string;
  workspace_id: string;
  listing_id: string;
  amount: string;
  paid_on: string;
  payer_id: string;
  note: string | null;
  status: AdPaymentStatus;
  correction_reason: string | null;
  version: number;
  client_request_id: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type AdPaymentListItem = AdPayment & {
  listing_title: string;
  payer_display_name: string | null;
};

export type WorkspaceMemberOption = {
  profile_id: string;
  display_name: string | null;
};

export type ListingOption = {
  id: string;
  title: string;
  status: "active" | "archived";
};

export type AdPaymentCreateInput = {
  listing_id: string;
  amount_kopiyky: number;
  paid_on: string;
  payer_id: string;
  note: string;
  client_request_id: string;
};

export type AdPaymentCorrectInput = {
  amount_kopiyky: number;
  paid_on: string;
  payer_id: string;
  note: string;
  status: AdPaymentStatus;
  correction_reason: string;
};

export type AdActionCode =
  | "ok"
  | "validation"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "error";

export type AdActionState = {
  ok: boolean;
  code: AdActionCode;
  message: string;
  paymentId?: string;
  idempotentReplay?: boolean;
};
