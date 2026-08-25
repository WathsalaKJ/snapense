/** Thin typed wrappers over the backend routes. */

import api from './client';
import type {
  AuthResponse,
  Category,
  DashboardSummary,
  Paginated,
  SpendingInsight,
  Transaction,
  TransactionFilters,
  TransactionUpdate,
  UploadReceiptResponse,
  User,
} from './types';

export const authApi = {
  async register(email: string, password: string, fullName: string) {
    const { data } = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      full_name: fullName,
    });
    return data;
  },

  async login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },

  async me() {
    const { data } = await api.get<{ user: User }>('/auth/me');
    return data.user;
  },
};

export const transactionsApi = {
  async list(filters: TransactionFilters = {}) {
    const { data } = await api.get<Paginated<Transaction>>('/transactions', {
      params: {
        ...filters,
        is_anomaly: filters.is_anomaly ? 'true' : undefined,
      },
    });
    return data;
  },

  async detail(id: number) {
    const { data } = await api.get<{ transaction: Transaction }>(`/transactions/${id}`);
    return data.transaction;
  },

  async update(id: number, patch: TransactionUpdate) {
    const { data } = await api.patch<{ transaction: Transaction }>(
      `/transactions/${id}`,
      patch,
    );
    return data.transaction;
  },

  async remove(id: number) {
    await api.delete(`/transactions/${id}`);
  },

  async categories() {
    const { data } = await api.get<{ categories: Category[] }>('/transactions/categories');
    return data.categories;
  },
};

export const receiptsApi = {
  /**
   * Upload a receipt photo. `uri` comes from expo-image-picker; React Native's
   * FormData takes the {uri, name, type} shape rather than a Blob.
   */
  async upload(uri: string) {
    const name = uri.split('/').pop() ?? 'receipt.jpg';
    const extension = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

    const form = new FormData();
    form.append('receipt', { uri, name, type: mimeType } as unknown as Blob);

    const { data } = await api.post<UploadReceiptResponse>('/receipts/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // OCR round-trips through a vision model, so allow well past the default.
      timeout: 60000,
    });
    return data;
  },
};

export const dashboardApi = {
  async summary(month?: string) {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary', {
      params: month ? { month } : undefined,
    });
    return data;
  },
};

export const insightsApi = {
  async list(limit = 20) {
    const { data } = await api.get<{ insights: SpendingInsight[] }>('/insights', {
      params: { limit },
    });
    return data.insights;
  },

  async generate(startDate?: string, endDate?: string) {
    const { data } = await api.post<{ insights: SpendingInsight[]; generated: number }>(
      '/insights/generate',
      { start_date: startDate, end_date: endDate },
    );
    return data;
  },
};
