import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { transactionsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Category, Transaction } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { ErrorNote, Loading, formatCurrency } from '../components';
import CategoryPicker from '../components/CategoryPicker';
import {
  accent,
  confidenceColors,
  fontSize,
  fontWeight,
  radii,
  resolveCategoryColor,
  spacing,
  tealAlpha,
} from '../theme';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ReceiptReview'>;

/** Confidence above this reads as "high" on the dot legend. */
const HIGH_CONFIDENCE = 0.8;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface EditableItem {
  key: string;
  name: string;
  price: string;
  categoryId: number | null;
  categoryName: string | null;
}

export default function ReceiptReviewScreen({ route, navigation }: Props) {
  const { transactionId, needsReview } = route.params;
  const { colors } = useTheme();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState('');
  const [tax, setTax] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [pickerFor, setPickerFor] = useState<number | 'transaction' | null>(null);
  const [transactionCategoryId, setTransactionCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [data, cats] = await Promise.all([
          transactionsApi.detail(transactionId),
          transactionsApi.categories(),
        ]);
        if (cancelled) return;

        setTransaction(data);
        setCategories(cats);
        setMerchant(data.merchant_name ?? '');
        setDate(data.transaction_date ?? '');
        setTax(data.tax_amount != null ? String(data.tax_amount) : '');
        setTransactionCategoryId(data.category_id);
        setItems(
          (data.line_items ?? []).map((item) => ({
            key: String(item.id),
            name: item.item_name,
            price: item.line_total != null ? String(item.line_total) : '',
            categoryId: item.category_id,
            categoryName: item.category?.name ?? null,
          })),
        );
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load the receipt.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  /** Total tracks the edited line items, so corrections are reflected live. */
  const total = useMemo(() => {
    const itemsTotal = items.reduce((sum, item) => {
      const value = Number(item.price);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const taxValue = Number(tax);
    return itemsTotal + (Number.isFinite(taxValue) ? taxValue : 0);
  }, [items, tax]);

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const pickCategory = (category: Category) => {
    if (pickerFor === 'transaction') {
      setTransactionCategoryId(category.id);
    } else if (typeof pickerFor === 'number') {
      updateItem(pickerFor, {
        categoryId: category.id,
        categoryName: category.name,
      });
    }
    setPickerFor(null);
  };

  const save = async () => {
    setError(null);

    if (!merchant.trim()) {
      setError('Enter a merchant name.');
      return;
    }
    if (date && !ISO_DATE.test(date.trim())) {
      setError('Date must look like 2026-08-20.');
      return;
    }
    if (items.some((item) => item.price !== '' && !Number.isFinite(Number(item.price)))) {
      setError('One of the item prices is not a number.');
      return;
    }

    setSaving(true);
    try {
      await transactionsApi.update(transactionId, {
        merchant_name: merchant.trim(),
        transaction_date: date.trim() || null,
        total_amount: Number(total.toFixed(2)),
        tax_amount: tax === '' ? null : Number(tax),
        category_id: transactionCategoryId,
        line_items: items.map((item) => ({
          item_name: item.name,
          quantity: 1,
          line_total: item.price === '' ? null : Number(item.price),
          unit_price: item.price === '' ? null : Number(item.price),
          category_id: item.categoryId,
        })),
      });

      navigation.navigate('Tabs', { screen: 'Transactions' });
    } catch (err) {
      setError(errorMessage(err, 'Could not save this receipt.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading receipt…" />;

  // The backend only records a confidence score when the OCR path supplies
  // one; without it the dots would be meaningless, so they stay hidden.
  const confidence = transaction?.ocr_confidence;
  const showConfidence = confidence != null;
  const confidenceTone =
    confidence != null && confidence >= HIGH_CONFIDENCE
      ? confidenceColors.high
      : confidenceColors.low;

  const pickerCurrentId =
    pickerFor === 'transaction'
      ? transactionCategoryId
      : typeof pickerFor === 'number'
        ? items[pickerFor]?.categoryId
        : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.title,
                fontWeight: fontWeight.bold,
                flex: 1,
              }}
            >
              Review receipt
            </Text>
            <View
              style={{
                backgroundColor: tealAlpha(0.12),
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 100,
              }}
            >
              <Text
                style={{
                  color: accent.teal,
                  fontSize: fontSize.caption,
                  fontWeight: fontWeight.semibold,
                }}
              >
                AI parsed
              </Text>
            </View>
          </View>

          {needsReview ? (
            <View
              style={{
                backgroundColor: `${confidenceColors.low}22`,
                borderRadius: radii.tile,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: confidenceColors.low, fontSize: fontSize.small }}>
                Some fields could not be read confidently. Check the total before saving.
              </Text>
            </View>
          ) : null}

          <ErrorNote message={error} />

          {/* Merchant + date */}
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.card,
              padding: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              {showConfidence ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: confidenceTone,
                  }}
                />
              ) : null}
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Merchant name"
                placeholderTextColor={colors.faint}
                style={{
                  flex: 1,
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: fontWeight.bold,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                  paddingBottom: 2,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              {showConfidence ? (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: confidenceTone,
                  }}
                />
              ) : null}
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  color: colors.muted,
                  fontSize: fontSize.body,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                  paddingBottom: 2,
                }}
              />
            </View>

            <Pressable onPress={() => setPickerFor('transaction')}>
              <CategoryChipInline
                name={
                  categories.find((c) => c.id === transactionCategoryId)?.name ??
                  'Uncategorised'
                }
                colorHex={
                  categories.find((c) => c.id === transactionCategoryId)?.color_hex
                }
              />
            </Pressable>
          </View>

          <Text
            style={{
              color: colors.muted,
              fontSize: fontSize.caption,
              fontWeight: fontWeight.semibold,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginHorizontal: 4,
            }}
          >
            Line items · tap a category to change
          </Text>

          {/* Line items */}
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.card,
              overflow: 'hidden',
            }}
          >
            {items.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
                  No line items were extracted. The total above still applies.
                </Text>
              </View>
            ) : null}

            {items.map((item, index) => (
              <View
                key={item.key}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.line,
                }}
              >
                {showConfidence ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: confidenceTone,
                    }}
                  />
                ) : null}

                <View style={{ flex: 1, gap: 6 }}>
                  <TextInput
                    value={item.name}
                    onChangeText={(value) => updateItem(index, { name: value })}
                    placeholder="Item name"
                    placeholderTextColor={colors.faint}
                    style={{
                      color: colors.text,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.medium,
                      padding: 0,
                    }}
                  />
                  <Pressable
                    onPress={() => setPickerFor(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Change category for ${item.name}`}
                  >
                    <CategoryChipInline
                      name={item.categoryName ?? 'Uncategorised'}
                      colorHex={
                        categories.find((c) => c.id === item.categoryId)?.color_hex
                      }
                    />
                  </Pressable>
                </View>

                <TextInput
                  value={item.price}
                  onChangeText={(value) => updateItem(index, { price: value })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.faint}
                  style={{
                    width: 70,
                    textAlign: 'right',
                    color: colors.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.softer,
                    paddingVertical: 2,
                  }}
                />
              </View>
            ))}

            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.line,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: fontSize.body }}>Tax</Text>
              <TextInput
                value={tax}
                onChangeText={setTax}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.faint}
                style={{
                  width: 70,
                  textAlign: 'right',
                  color: colors.text,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.semibold,
                  padding: 0,
                }}
              />
            </View>

            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: tealAlpha(0.05),
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Total
              </Text>
              <Text
                style={{ color: colors.text, fontSize: 22, fontWeight: fontWeight.bold }}
              >
                {formatCurrency(total)}
              </Text>
            </View>
          </View>

          {showConfidence ? (
            <View style={{ flexDirection: 'row', gap: 14, marginHorizontal: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: confidenceColors.high,
                  }}
                />
                <Text style={{ color: colors.muted, fontSize: fontSize.captionLg }}>
                  High confidence
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: confidenceColors.low,
                  }}
                />
                <Text style={{ color: colors.muted, fontSize: fontSize.captionLg }}>
                  Needs review
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Confirm bar */}
        <View style={{ padding: 20, paddingTop: 14, backgroundColor: colors.bg }}>
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => ({
              height: 54,
              borderRadius: 15,
              backgroundColor: pressed ? accent.tealBright : accent.teal,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              style={{ color: '#0B1120', fontSize: fontSize.xl, fontWeight: fontWeight.bold }}
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <CategoryPicker
        visible={pickerFor !== null}
        categories={categories}
        currentCategoryId={pickerCurrentId}
        onSelect={pickCategory}
        onClose={() => setPickerFor(null)}
      />
    </SafeAreaView>
  );
}

/** Tappable category pill, matching the design's chipStyle. */
function CategoryChipInline({
  name,
  colorHex,
}: {
  name: string;
  colorHex?: string | null;
}) {
  const tone = resolveCategoryColor(name, colorHex);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 100,
        backgroundColor: `${tone}1F`,
        borderWidth: 1,
        borderColor: `${tone}3D`,
      }}
    >
      <Text
        style={{ color: tone, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}
      >
        {name}
      </Text>
    </View>
  );
}
