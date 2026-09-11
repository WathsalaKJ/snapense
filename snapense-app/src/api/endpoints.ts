/** Thin typed wrappers over the backend routes. */

import { Platform } from 'react-native';

import api from './client';
import type {
  AuthResponse,
  Budget,
  BudgetHistoryResponse,
  Category,
  ContributionCreate,
  DashboardSummary,
  GoalContribution,
  GoalCreate,
  GoalUpdate,
  Paginated,
  SavingsGoal,
  SpendingInsight,
  Transaction,
  TransactionCreate,
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

  /** Manual entry - no receipt image (cash purchases, or starting fresh after a bad OCR read). */
  async create(entry: TransactionCreate) {
    const { data } = await api.post<{ transaction: Transaction }>('/transactions', entry);
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
   * Upload a receipt photo. `uri` comes from expo-image-picker.
   *
   * Native (iOS/Android): React Native's FormData polyfill special-cases a
   * plain {uri, name, type} object appended as a value and turns it into a
   * real multipart file part - a RN-only convention, not part of the web
   * FormData spec.
   *
   * Web: `FormData` is the browser's native implementation, which only
   * accepts a string or a Blob/File as the appended value. Appending that
   * same {uri, name, type} object instead gets coerced with String(value)
   * ("[object Object]") and sent as a plain form field, not a file part -
   * so Flask's `request.files` never sees it and 400s with "a receipt image
   * is required". The `uri` here is also typically a `blob:`/`data:` URL on
   * web, not a filesystem path, so there's no reliable filename/extension to
   * read off it either. Fetching the uri back into a real Blob and reading
   * its own `.type` sidesteps both problems.
   */
  async upload(uri: string) {
    const form = new FormData();

    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      const mimeType = blob.type || 'image/jpeg';
      const extension = mimeType.split('/').pop() || 'jpg';
      form.append('receipt', blob, `receipt.${extension}`);
    } else {
      const name = uri.split('/').pop() ?? 'receipt.jpg';
      const extension = name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      form.append('receipt', { uri, name, type: mimeType } as unknown as Blob);
    }

    const { data } = await api.post<UploadReceiptResponse>('/receipts/upload', form, {
      headers: {
        // Native: React Native's networking layer writes its own multipart
        // boundary regardless of this value, so a hardcoded content-type is
        // harmless. Web: a real browser XHR/fetch only auto-generates the
        // required `boundary=...` parameter when *no* Content-Type has been
        // set at all - and the api instance already defaults to
        // 'application/json' (client.ts). Explicitly clearing it here (not
        // just omitting the override) is what tells axios to drop that
        // default and let the browser derive the correct multipart header
        // from the FormData body itself.
        'Content-Type': Platform.OS === 'web' ? undefined : 'multipart/form-data',
      },
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

export const budgetsApi = {
  async list() {
    const { data } = await api.get<{ budgets: Budget[] }>('/budgets');
    return data.budgets;
  },

  /** POST also updates the limit when a budget for the category already exists. */
  async upsert(categoryId: number, monthlyLimit: number) {
    const { data } = await api.post<{ budget: Budget }>('/budgets', {
      category_id: categoryId,
      monthly_limit: monthlyLimit,
    });
    return data.budget;
  },

  async remove(id: number) {
    await api.delete(`/budgets/${id}`);
  },

  /** Past-months spend per current budget, compared against today's monthly_limit. Defaults to 6 months server-side. */
  async history(months?: number) {
    const { data } = await api.get<BudgetHistoryResponse>('/budgets/history', {
      params: months ? { months } : undefined,
    });
    return data;
  },
};

export const goalsApi = {
  async list() {
    const { data } = await api.get<{ goals: SavingsGoal[] }>('/goals');
    return data.goals;
  },

  async create(payload: GoalCreate) {
    const { data } = await api.post<{ goal: SavingsGoal }>('/goals', payload);
    return data.goal;
  },

  async update(id: number, patch: GoalUpdate) {
    const { data } = await api.patch<{ goal: SavingsGoal }>(`/goals/${id}`, patch);
    return data.goal;
  },

  async remove(id: number) {
    await api.delete(`/goals/${id}`);
  },

  async listContributions(goalId: number) {
    const { data } = await api.get<{ contributions: GoalContribution[] }>(
      `/goals/${goalId}/contributions`,
    );
    return data.contributions;
  },

  async addContribution(goalId: number, payload: ContributionCreate) {
    const { data } = await api.post<{ contribution: GoalContribution }>(
      `/goals/${goalId}/contributions`,
      payload,
    );
    return data.contribution;
  },

  async removeContribution(goalId: number, contributionId: number) {
    await api.delete(`/goals/${goalId}/contributions/${contributionId}`);
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
      // Round-trips through Gemini, so allow well past the default (matches
      // receiptsApi.upload's timeout override for the same reason).
      { timeout: 30000 },
    );
    return data;
  },
};
