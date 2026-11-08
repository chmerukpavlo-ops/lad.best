export type SaleStatus = "open" | "completed" | "cancelled";

export type Sale = {
  id: string;
  workspace_id: string;
  listing_id: string;
  sale_price: string;
  cost_price: string;
  direct_expenses: string;
  color_text: string | null;
  size_text: string | null;
  note: string | null;
  executor_id: string;
  sold_on: string;
  status: SaleStatus;
  margin: string | null;
  completed_on: string | null;
  completed_at: string | null;
  completed_by: string | null;
  correction_reason: string | null;
  version: number;
  client_request_id: string;
  complete_request_id: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type SaleListItem = Sale & {
  listing_title: string;
  executor_display_name: string | null;
};

export type SaleCreateInput = {
  listing_id: string;
  sale_price_kopiyky: number;
  cost_price_kopiyky: number;
  direct_expenses_kopiyky: number;
  color_text: string;
  size_text: string;
  note: string;
  executor_id: string;
  sold_on: string;
  client_request_id: string;
};

export type SaleUpdateInput = {
  sale_price_kopiyky: number;
  cost_price_kopiyky: number;
  direct_expenses_kopiyky: number;
  color_text: string;
  size_text: string;
  note: string;
  executor_id: string;
  sold_on: string;
};

export type SaleCorrectInput = SaleUpdateInput & {
  completed_on: string;
  correction_reason: string;
};

export type SaleActionCode =
  | "ok"
  | "validation"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "error";

export type SaleActionState = {
  ok: boolean;
  code: SaleActionCode;
  message: string;
  saleId?: string;
  idempotentReplay?: boolean;
};
