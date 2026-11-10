import axios from "axios";
import type {
  Order,
  CreateOrderResponse,
  AuthorizeResponse,
  ShipPartialResponse,
  ParseNoticeRequest,
  ParseNoticeResponse,
  ConsentSubmission,
  ConsentResponse,
  Fixture,
} from "./types";

const client = axios.create({ baseURL: "/api" });

/* ── Orders ───────────────────────────────────── */

export async function createOrder(): Promise<CreateOrderResponse> {
  const payload = {
    items: [
      { sku: "BEARING-4X", name: "Precision Bearings (Set of 4)", quantity: 1, amount: 30.0 },
      { sku: "HYDRO-PUMP", name: "Hydraulic Pump Assembly", quantity: 1, amount: 30.0 },
      { sku: "CERAMIC-KIT", name: "Ceramic Coating Kit", quantity: 1, amount: 30.0 },
    ],
    currency: "USD"
  };
  const { data } = await client.post<CreateOrderResponse>("/orders/create", payload);
  return data;
}

export async function authorizeOrder(orderId: string): Promise<AuthorizeResponse> {
  const { data } = await client.post<AuthorizeResponse>(`/orders/${orderId}/authorize`);
  return data;
}

export async function shipPartial(orderId: string): Promise<ShipPartialResponse> {
  const { data } = await client.post<ShipPartialResponse>(`/orders/${orderId}/ship-partial`);
  return data;
}

export async function getOrder(orderId: string): Promise<Order> {
  const { data } = await client.get<Order>(`/orders/${orderId}`);
  return data;
}

export async function getOrders(): Promise<Order[]> {
  const { data } = await client.get<Order[]>("/orders");
  return data;
}

/* ── Supplier Notice ──────────────────────────── */

export async function parseNotice(req: ParseNoticeRequest): Promise<ParseNoticeResponse> {
  const { data } = await client.post<ParseNoticeResponse>("/supplier/parse-notice", req);
  return data;
}

/* ── Consent ──────────────────────────────────── */

export async function submitConsent(req: ConsentSubmission): Promise<ConsentResponse> {
  const { data } = await client.post<ConsentResponse>("/consent/submit", req);
  return data;
}

/* ── Fixtures ─────────────────────────────────── */

export async function getFixtures(): Promise<Fixture[]> {
  const { data } = await client.get<Fixture[]>("/fixtures");
  return data;
}
