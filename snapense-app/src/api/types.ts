/** Response shapes returned by the Flask backend. */

export interface Category {
  id: number;
  name: string;
  color_hex: string;
  icon_name: string;
  is_default: boolean;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: number;
  transaction_id: number;
  item_name: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  category_id: number | null;
  category: Category | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  merchant_name: string | null;
  transaction_date: string | null;
  total_amount: number;
  tax_amount: number | null;
  category_id: number | null;
  category: Category | null;
  receipt_image_url: string | null;
  ocr_raw_text: string | null;
  ocr_confidence: number | null;
  is_anomaly: boolean;
  anomaly_reason: string | null;
  created_at: string;
  updated_at: string;
  line_items?: LineItem[];
}

export interface SpendingInsight {
  id: number;
  user_id: number;
  insight_text: string;
  category_id: number | null;
  category: Category | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface Paginated<T> {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  transactions: T[];
}

export interface CategoryBreakdown {
  category_id: number;
  name: string;
  color_hex: string;
  icon_name: string;
  total: number;
  transaction_count: number;
  share_pct: number;
}

export interface TrendPoint {
  month: string;
  total: number;
  transaction_count: number;
}

export interface MonthSummary {
  start: string;
  end: string;
  label: string;
  total_spent: number;
  transaction_count: number;
  average_transaction: number;
  total_tax: number;
  anomaly_count: number;
  previous_month_total: number;
  change_pct: number | null;
}

export interface DashboardSummary {
  month: MonthSummary;
  by_category: CategoryBreakdown[];
  by_category_total: number;
  monthly_trend: TrendPoint[];
  anomalies: Transaction[];
}

export interface UploadReceiptResponse {
  transaction: Transaction;
  receipt_image_url: string | null;
  needs_review: boolean;
}

/** What PATCH /transactions/<id> accepts. Line items are replaced wholesale. */
export interface LineItemInput {
  item_name: string;
  quantity?: number | null;
  unit_price?: number | null;
  line_total?: number | null;
  category_id?: number | null;
}

export interface TransactionUpdate {
  merchant_name?: string | null;
  transaction_date?: string | null;
  total_amount?: number;
  tax_amount?: number | null;
  category_id?: number | null;
  line_items?: LineItemInput[];
}

export interface TransactionFilters {
  category?: string;
  start_date?: string;
  end_date?: string;
  q?: string;
  is_anomaly?: boolean;
  page?: number;
  per_page?: number;
}
