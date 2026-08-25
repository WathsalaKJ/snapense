import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { transactionsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { tokenStore } from '../api/tokenStore';
import type { Category, Transaction } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { ErrorNote, Loading, formatCurrency } from '../components';
import CategoryPicker from '../components/CategoryPicker';
import {
  accent,
  fontSize,
  fontWeight,
  radii,
  resolveCategoryColor,
  spacing,
  tealAlpha,
} from '../theme';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TransactionDetail'>;

interface EditableItem {
  key: string;
  name: string;
  price: string;
}

function EditIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 15 15">
      <Path
        d="M10.5 1.5l3 3L5 13H2v-3l8.5-8.5z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function TransactionDetailScreen({ route, navigation }: Props) {
  const { transactionId, startInEdit } = route.params;
  const { colors } = useTheme();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState(Boolean(startInEdit));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [data, cats, stored] = await Promise.all([
          transactionsApi.detail(transactionId),
          transactionsApi.categories(),
          tokenStore.getAccessToken(),
        ]);
        if (cancelled) return;

        setTransaction(data);
        setCategories(cats);
        setToken(stored);
        setMerchant(data.merchant_name ?? '');
        setCategoryId(data.category_id);
        setItems(
          (data.line_items ?? []).map((item) => ({
            key: String(item.id),
            name: item.item_name,
            price: item.line_total != null ? String(item.line_total) : '',
          })),
        );
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load this transaction.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const total = useMemo(() => {
    if (!editing) return transaction?.total_amount ?? 0;
    const itemsTotal = items.reduce((sum, item) => {
      const value = Number(item.price);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const tax = transaction?.tax_amount ?? 0;
    return itemsTotal > 0 ? itemsTotal + tax : (transaction?.total_amount ?? 0);
  }, [editing, items, transaction]);

  const save = async () => {
    setError(null);
    if (!merchant.trim()) {
      setError('Enter a merchant name.');
      return;
    }

    setSaving(true);
    try {
      const updated = await transactionsApi.update(transactionId, {
        merchant_name: merchant.trim(),
        category_id: categoryId,
        total_amount: Number(total.toFixed(2)),
        line_items: items.map((item) => ({
          item_name: item.name,
          quantity: 1,
          line_total: item.price === '' ? null : Number(item.price),
          unit_price: item.price === '' ? null : Number(item.price),
        })),
      });
      setTransaction(updated);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await transactionsApi.remove(transactionId);
            navigation.goBack();
          } catch (err) {
            setError(errorMessage(err, 'Could not delete this transaction.'));
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  if (!transaction) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}>
        <ErrorNote message={error ?? 'Transaction not found.'} />
      </View>
    );
  }

  const category = categories.find((c) => c.id === categoryId) ?? transaction.category;
  const tone = resolveCategoryColor(category?.name, category?.color_hex);
  const letter = (transaction.merchant_name ?? '?').trim().charAt(0).toUpperCase();

  // The receipt endpoint is JWT-protected, so the header rides with the image
  // request. Falls back to a rendered receipt if there is no photo.
  const receiptUri = transaction.receipt_image_url
    ? `${API_BASE_URL}/receipts/${transaction.receipt_image_url}`
    : null;
  const showPhoto = receiptUri && token && !imageFailed;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text
            style={{
              flex: 1,
              color: colors.text,
              fontSize: fontSize.title,
              fontWeight: fontWeight.bold,
            }}
          >
            Transaction
          </Text>

          <Pressable
            onPress={() => (editing ? save() : setEditing(true))}
            disabled={saving}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 13,
              paddingVertical: 8,
              borderRadius: radii.chip,
              backgroundColor: editing ? accent.teal : tealAlpha(0.14),
              borderWidth: 1,
              borderColor: editing ? accent.teal : tealAlpha(0.35),
            }}
          >
            <EditIcon color={editing ? '#0B1120' : accent.teal} />
            <Text
              style={{
                color: editing ? '#0B1120' : accent.teal,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
              }}
            >
              {saving ? 'Saving…' : editing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        </View>

        {editing ? (
          <View
            style={{
              backgroundColor: tealAlpha(0.08),
              borderWidth: 1,
              borderColor: tealAlpha(0.25),
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 9,
            }}
          >
            <Text style={{ color: accent.teal, fontSize: fontSize.captionLg }}>
              Editing — tap the category chip or any price, then Done.
            </Text>
          </View>
        ) : null}

        <ErrorNote message={error} />

        {/* Receipt image */}
        <View
          style={{
            backgroundColor: '#0D1320',
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 16,
            padding: 18,
            alignItems: 'center',
          }}
        >
          {showPhoto ? (
            <Image
              source={{ uri: receiptUri, headers: { Authorization: `Bearer ${token}` } }}
              onError={() => setImageFailed(true)}
              style={{
                width: 180,
                height: 260,
                borderRadius: 6,
                transform: [{ rotate: '-1deg' }],
              }}
              resizeMode="cover"
            />
          ) : (
            // Rendered stand-in when no photo was stored (e.g. manual entry).
            <View
              style={{
                width: 180,
                backgroundColor: '#F4F5F6',
                borderRadius: 6,
                paddingHorizontal: 14,
                paddingVertical: 16,
                transform: [{ rotate: '-1deg' }],
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: 9.5,
                  color: '#1F2937',
                  textTransform: 'uppercase',
                }}
              >
                {transaction.merchant_name ?? 'Receipt'}
              </Text>
              <Text
                style={{
                  textAlign: 'center',
                  color: '#6B7280',
                  fontSize: 7.5,
                  marginBottom: 8,
                }}
              >
                {transaction.transaction_date ?? ''}
              </Text>
              {(transaction.line_items ?? []).map((item) => (
                <View
                  key={item.id}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: '#1F2937', fontSize: 8.5, flex: 1 }}
                  >
                    {item.item_name.toUpperCase()}
                  </Text>
                  <Text style={{ color: '#1F2937', fontSize: 8.5 }}>
                    {item.line_total?.toFixed(2) ?? ''}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: '#9CA3AF',
                  borderStyle: 'dashed',
                  marginVertical: 6,
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', fontSize: 9.5, color: '#1F2937' }}>
                  TOTAL
                </Text>
                <Text style={{ fontWeight: '700', fontSize: 9.5, color: '#1F2937' }}>
                  {transaction.total_amount.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Structured data */}
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.line,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                backgroundColor: `${tone}24`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: tone, fontSize: 15, fontWeight: '800' }}>{letter}</Text>
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <TextInput
                value={merchant}
                onChangeText={setMerchant}
                editable={editing}
                style={{
                  color: colors.text,
                  fontSize: fontSize.baseLg,
                  fontWeight: fontWeight.semibold,
                  padding: 0,
                  borderBottomWidth: editing ? 1 : 0,
                  borderBottomColor: accent.teal,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
                {transaction.transaction_date ?? 'No date'}
              </Text>
            </View>

            <Pressable
              onPress={() => editing && setPickerOpen(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: radii.chip,
                backgroundColor: `${tone}1F`,
                borderWidth: 1,
                borderColor: editing ? `${tone}99` : `${tone}3D`,
              }}
            >
              <Text
                style={{
                  color: tone,
                  fontSize: fontSize.caption,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {category?.name ?? 'Uncategorised'}
              </Text>
            </Pressable>
          </View>

          {items.map((item, index) => (
            <View
              key={item.key}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.line,
              }}
            >
              <Text style={{ color: colors.text2, fontSize: 13.5, flex: 1 }}>
                {item.name}
              </Text>
              <TextInput
                value={item.price}
                onChangeText={(value) =>
                  setItems((current) =>
                    current.map((row, i) => (i === index ? { ...row, price: value } : row)),
                  )
                }
                editable={editing}
                keyboardType="decimal-pad"
                style={{
                  width: 72,
                  textAlign: 'right',
                  color: colors.text,
                  fontSize: 13.5,
                  fontWeight: fontWeight.semibold,
                  padding: 0,
                  borderBottomWidth: editing ? 1 : 0,
                  borderBottomColor: accent.teal,
                }}
              />
            </View>
          ))}

          {transaction.tax_amount != null ? (
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.line,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 13.5 }}>Tax</Text>
              <Text style={{ color: colors.text, fontSize: 13.5 }}>
                {formatCurrency(transaction.tax_amount)}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              paddingHorizontal: 18,
              paddingVertical: 15,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: tealAlpha(0.05),
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 13.5,
                fontWeight: fontWeight.semibold,
              }}
            >
              Total
            </Text>
            <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800' }}>
              {formatCurrency(total)}
            </Text>
          </View>
        </View>

        {transaction.is_anomaly && transaction.anomaly_reason ? (
          <View
            style={{
              backgroundColor: `${accent.danger}1A`,
              borderWidth: 1,
              borderColor: `${accent.danger}59`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{ color: accent.danger, fontSize: fontSize.small }}>
              {transaction.anomaly_reason}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginHorizontal: 6,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: accent.success,
            }}
          />
          <Text style={{ color: colors.muted2, fontSize: fontSize.captionLg }}>
            Parsed automatically · verified by you
          </Text>
        </View>

        <Pressable
          onPress={confirmDelete}
          style={{
            marginTop: spacing.md,
            alignItems: 'center',
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: `${accent.danger}59`,
          }}
        >
          <Text
            style={{
              color: accent.danger,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
            }}
          >
            Delete transaction
          </Text>
        </Pressable>
      </ScrollView>

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
