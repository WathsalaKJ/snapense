/**
 * Manual transaction entry - no receipt/OCR involved. For cash purchases, or
 * when starting fresh is easier than fixing a bad OCR read. Pushed as its own
 * screen (like TransactionDetail) rather than a modal sheet, since it has
 * several fields rather than the one or two a BudgetModal-style sheet suits.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { transactionsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Category } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { CategoryIcon, ErrorNote, Field, PrimaryButton, WebContainer } from '../components';
import CategoryPicker from '../components/CategoryPicker';
import { accent, fontSize, fontWeight, radii, resolveCategoryColor, spacing, tealAlpha } from '../theme';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AddTransaction'>;

type DateMode = 'today' | 'yesterday' | 'custom';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: fontSize.small,
        fontWeight: fontWeight.medium,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}

export default function AddTransactionScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const [categories, setCategories] = useState<Category[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>('today');
  const [customDate, setCustomDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await transactionsApi.categories();
        if (!cancelled) setCategories(list);
      } catch {
        // Non-fatal: the form still works, just without a category picker.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const resolvedDate =
    dateMode === 'today' ? isoDate(today) : dateMode === 'yesterday' ? isoDate(yesterday) : customDate.trim();

  const amountValue = Number(amount);
  const isAmountValid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue >= 0;
  const isDateValid = dateMode !== 'custom' || ISO_DATE.test(customDate.trim());
  const canSubmit = isAmountValid && isDateValid && !saving;

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const tone = resolveCategoryColor(category?.name, category?.color_hex);

  const submit = async () => {
    setError(null);
    if (!isAmountValid) {
      setError('Enter a valid amount.');
      return;
    }
    if (!isDateValid) {
      setError('Enter the custom date as YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    try {
      const created = await transactionsApi.create({
        merchant_name: merchant.trim() || null,
        transaction_date: resolvedDate || null,
        total_amount: Number(amountValue.toFixed(2)),
        category_id: categoryId,
        notes: notes.trim() || null,
      });
      navigation.replace('TransactionDetail', { transactionId: created.id });
    } catch (err) {
      setError(errorMessage(err, 'Could not save this transaction.'));
    } finally {
      setSaving(false);
    }
  };

  const datePills: { key: DateMode; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebContainer>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}>
            For cash purchases, or when it's quicker to start fresh than fix an OCR read.
          </Text>

          <ErrorNote message={error} />

          <Field
            label="Merchant"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Corner Store"
            autoCapitalize="words"
          />

          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <View>
            <SectionLabel>Date</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {datePills.map((pill) => {
                const active = pill.key === dateMode;
                return (
                  <Pressable
                    key={pill.key}
                    onPress={() => setDateMode(pill.key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: radii.chip,
                      backgroundColor: active ? tealAlpha(0.18) : colors.soft,
                      borderWidth: 1,
                      borderColor: active ? tealAlpha(0.4) : colors.line,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? accent.teal : colors.muted,
                        fontSize: fontSize.small,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {pill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {dateMode === 'custom' ? (
              <Field
                label="Custom date"
                value={customDate}
                onChangeText={setCustomDate}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>

          <View>
            <SectionLabel>Category</SectionLabel>
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                backgroundColor: colors.soft,
                borderRadius: radii.input,
                borderWidth: 1,
                borderColor: colors.line,
                paddingHorizontal: spacing.xl,
                paddingVertical: 10,
              }}
            >
              <CategoryIcon
                name={category?.name}
                iconName={category?.icon_name}
                colorHex={category?.color_hex}
                size={30}
              />
              <Text
                style={{
                  flex: 1,
                  color: category ? colors.text : colors.faint,
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                }}
              >
                {category?.name ?? 'Uncategorised (optional)'}
              </Text>
              {category ? (
                <View
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    borderRadius: radii.chip,
                    backgroundColor: `${tone}1F`,
                  }}
                >
                  <Text style={{ color: tone, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}>
                    Change
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View>
            <SectionLabel>Notes (optional)</SectionLabel>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything worth remembering about this one"
              placeholderTextColor={colors.faint}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: colors.soft,
                borderRadius: radii.input,
                borderWidth: 1,
                borderColor: colors.line,
                color: colors.text,
                fontSize: fontSize.base,
                paddingHorizontal: spacing.xl,
                paddingVertical: 13,
                minHeight: 84,
              }}
            />
          </View>

          <PrimaryButton
            label="Add transaction"
            onPress={submit}
            disabled={!canSubmit}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </WebContainer>

      <CategoryPicker
        visible={pickerOpen}
        categories={categories}
        currentCategoryId={categoryId}
        onSelect={(picked) => {
          setCategoryId(picked.id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
