/**
 * StableRemit OFI SDK v1.0
 * Originating Financial Institution API client for StableRemit.
 *
 * Zero dependencies — uses native fetch.
 * Copy this file into your project and import { StableRemitOFI } from './stableremit-ofi-sdk'.
 *
 * @example
 * ```ts
 * const client = new StableRemitOFI('fvofi_xxxxxxxx...', 'https://isjnzuqgskenphfjxeaq.supabase.co/functions/v1/ofi-public-api');
 * const quote = await client.requestQuote({ beneficiary_id: '...', destination_amount: 1000, destination_currency: 'MXN' });
 * const payment = await client.confirmPayment(quote.quote_reference);
 * ```
 */

// ─── Types ─────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(body.error as string || `API error ${status}`);
    this.name = 'ApiError';
  }
}

export interface Beneficiary {
  id: string;
  name: string;
  dba_name: string | null;
  merchant_type: 'individual' | 'business';
  external_id: string | null;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  fv_counterparty_id: string | null;
  created_at: string;
  metadata?: {
    legal_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    country: string | null;
    fv_payment_instrument_id: string | null;
  } | null;
}

export interface BeneficiaryList {
  beneficiaries: Beneficiary[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateBeneficiaryInput {
  /** Beneficiary display name */
  name: string;
  /** Defaults to 'business' */
  merchant_type?: 'individual' | 'business';
  /** Your internal ID */
  external_id?: string;
  /** Doing-business-as name */
  dba_name?: string;
  /** Optional metadata */
  legal_name?: string;
  contact_email?: string;
  contact_phone?: string;
  country?: string;
}

export interface QuoteRequest {
  /** Beneficiary UUID to send funds to */
  beneficiary_id: string;
  /** Amount in destination currency */
  destination_amount: number;
  /** ISO 4217 currency code (e.g. MXN, PHP, BRL) */
  destination_currency: string;
  /** Purpose of payment */
  payment_purpose?: string;
  /** Supporting document ID if required */
  supporting_document_id?: string;
}

export interface Quote {
  quote_reference: string;
  fx_rate: number;
  source_amount_usd: number;
  fees: number;
  total_debit_usd: number;
  expires_at: string;
  destination_amount: number;
  destination_currency: string;
  beneficiary_name: string;
  status?: string;
  created_at?: string;
}

export interface Payment {
  payment_id: string;
  status: string;
  transaction_number: string | null;
  quote_reference: string;
}

export interface PaymentDetail {
  id: string;
  beneficiary_merchant_id: string;
  source_amount_usd: number;
  destination_amount: number;
  destination_currency: string;
  fx_rate: number;
  fees: number;
  status: string;
  fv_transfer_id: string | null;
  payment_purpose: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentList {
  payments: PaymentDetail[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccountBalance {
  account_name: string;
  available_balance: number;
  pending_balance: number;
  currency: string;
}

export interface DocumentUpload {
  file_id: string;
  file_name: string;
}

export interface PaymentPurpose {
  [key: string]: unknown;
}

export interface PaymentPurposeList {
  purposes: PaymentPurpose[];
}

// ─── SDK Client ────────────────────────────────────────────

export class StableRemitOFI {
  private headers: Record<string, string>;

  /**
   * Create a new OFI API client.
   * @param apiKey - Your OFI API key (starts with `fvofi_`)
   * @param baseUrl - The OFI Public API base URL
   */
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };
  }

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers = { ...this.headers };
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
  }

  // ── Beneficiaries ────────────────────────────────────

  /** List all beneficiaries */
  async listBeneficiaries(params?: { limit?: number; offset?: number; status?: string }): Promise<BeneficiaryList> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return this.request('GET', `/beneficiaries${q ? `?${q}` : ''}`);
  }

  /** Get a single beneficiary by ID */
  async getBeneficiary(id: string): Promise<Beneficiary> {
    return this.request('GET', `/beneficiaries/${id}`);
  }

  /** Create a new beneficiary */
  async createBeneficiary(data: CreateBeneficiaryInput, idempotencyKey?: string): Promise<Beneficiary> {
    return this.request('POST', '/beneficiaries', data, idempotencyKey);
  }

  // ── Quotes ───────────────────────────────────────────

  /** Request a payment quote with FX rates */
  async requestQuote(data: QuoteRequest, idempotencyKey?: string): Promise<Quote> {
    return this.request('POST', '/quotes', data, idempotencyKey);
  }

  /** Get a quote by reference */
  async getQuote(quoteReference: string): Promise<Quote> {
    return this.request('GET', `/quotes/${quoteReference}`);
  }

  // ── Payments ─────────────────────────────────────────

  /** Confirm a quote and execute the cross-border payment */
  async confirmPayment(quoteReference: string, options?: { payment_purpose?: string }, idempotencyKey?: string): Promise<Payment> {
    return this.request('POST', '/payments', { quote_reference: quoteReference, ...options }, idempotencyKey);
  }

  /** List all payments */
  async listPayments(params?: { limit?: number; offset?: number; status?: string }): Promise<PaymentList> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return this.request('GET', `/payments${q ? `?${q}` : ''}`);
  }

  /** Get payment details by ID */
  async getPayment(id: string): Promise<PaymentDetail> {
    return this.request('GET', `/payments/${id}`);
  }

  // ── Balance ──────────────────────────────────────────

  /** Get account balance */
  async getBalance(): Promise<AccountBalance> {
    return this.request('GET', '/balance');
  }

  // ── Payment Purposes ────────────────────────────────

  /** List available payment purpose values for cross-border quotes */
  async listPaymentPurposes(): Promise<PaymentPurposeList> {
    return this.request('GET', '/payment-purposes');
  }

  // ── Documents ───────────────────────────────────────

  /**
   * Upload a supporting document (PDF, JPG, PNG, etc.) required for cross-border quotes.
   * Returns a file_id to pass as `supporting_document_id` in requestQuote().
   * @param file - File object or Blob
   * @param customField - Optional document type (e.g. "Payment_Invoice")
   */
  async uploadDocument(file: File | Blob, customField?: string): Promise<DocumentUpload> {
    const formData = new FormData();
    formData.append('file', file);
    if (customField) formData.append('custom_field', customField);

    const res = await fetch(`${this.baseUrl}/documents`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data);
    return data as DocumentUpload;
  }
}
