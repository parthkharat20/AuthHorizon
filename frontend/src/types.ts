/* ── TypeScript interfaces matching backend schemas ── */

export interface LineItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  status: "IN_STOCK" | "DELAYED" | "CAPTURED" | "VOIDED" | "SWAPPED";
  delay_reason?: string;
  new_ship_date?: string;
}

export interface CaptureRecord {
  id: string;
  capture_id?: string;
  amount: number;
  capture_type: "IN_STOCK_SHIPMENT" | "DELAYED_RESOLUTION" | "SWAP";
  idempotency_key: string;
  webhook_verified: boolean;
  captured_at: string;
}

export interface ConsentRecord {
  id: string;
  choice: "WAIT" | "SWAP" | "CANCEL";
  swap_sku?: string;
  swap_name?: string;
  swap_price?: number;
  submitted_at: string;
}

export interface Order {
  id: string;
  paypal_order_id: string;
  status: "CREATED" | "APPROVED" | "AUTHORIZED" | "PARTIALLY_CAPTURED" | "COMPLETED" | "VOIDED";
  total_amount: number;
  captured_amount: number;
  held_amount: number;
  currency: string;
  approval_url?: string;
  authorization_id?: string;
  items: LineItem[];
  captures: CaptureRecord[];
  consents: ConsentRecord[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrderResponse {
  id: string;
  paypal_order_id: string;
  approval_url: string;
  status: string;
  total_amount: number;
}

export interface AuthorizeResponse {
  id: string;
  status: string;
  authorization_id: string;
  total_amount: number;
  held_amount: number;
}

export interface ShipPartialResponse {
  id: string;
  status: string;
  captured_amount: number;
  held_amount: number;
  capture_id: string;
}

export interface ParseNoticeRequest {
  raw_text: string;
}

export interface ExtractionField {
  value: string;
  confidence: "HIGH" | "MED" | "LOW";
}

export interface ParseNoticeResponse {
  extraction: {
    item_identifier: string;
    new_ship_date: string;
    reason: string;
    language: string;
    confidence_item: "HIGH" | "MED" | "LOW";
    confidence_date: "HIGH" | "MED" | "LOW";
    confidence_reason: "HIGH" | "MED" | "LOW";
  };
  matched_sku: string | null;
  matched_name: string | null;
  needs_review: boolean;
  review_reason: string;
  status: string;
  generated_buyer_message: string;
  provider_used?: 'gemini' | 'groq' | 'cached';
  is_live_ai?: boolean;
  model_name?: string;
  provider_label?: string;
}

export interface ConsentSubmission {
  order_id: string;
  choice: "WAIT" | "SWAP" | "CANCEL";
  swap_sku?: string;
}

export interface ConsentResponse {
  success: boolean;
  message: string;
  capture_id?: string;
  released_amount?: number;
}

export interface Fixture {
  id: string;
  label: string;
  language: string;
  text: string;
}
