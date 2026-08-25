import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import { transactionsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Category, Transaction } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { ErrorNote, Loading, formatCurrency } from '../components';
import {
  accent,
  dangerAlpha,
  fontSize,
  fontWeight,
  radii,
  resolveCategoryColor,
  spacing,
  tealAlpha,
} from '../theme';
import type { AppStackParamList } from '../navigation/types';

const ALL = 'All';
const ACTION_WIDTH = 136;

/** Date-range presets, resolved to the API's start_date/end_date params. */
type RangeKey = 'all' | 'month' | 'days30' | 'year';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'month', label: 'This month' },
  { key: 'days30', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
];

function resolveRange(key: RangeKey): { start_date?: string; end_date?: string } {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  switch (key) {
    case 'month':
      return {
        start_date: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
        end_date: iso(today),
      };
    case 'days30': {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { start_date: iso(from), end_date: iso(today) };
    }
    case 'year':
      return {
        start_date: iso(new Date(today.getFullYear(), 0, 1)),
        end_date: iso(today),
      };
    default:
      return {};
  }
}

function EditIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 15 15">
      <Path
        d="M10.5 1.5l3 3L5 13H2v-3l8.5-8.5z"
        stroke={accent.teal}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DeleteIcon() {
  return (
    <Svg width={14} height={15} viewBox="0 0 14 15">
      <Path
        d="M1 3.5h12M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M2.5 3.5l1 10a1 1 0 001 1h5a1 1 0 001-1l1-10"
        stroke={accent.danger}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function SearchIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Circle cx={6.5} cy={6.5} r={5} stroke={color} strokeWidth={1.8} />
      <Path d="M10.5 10.5L14 14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function SwipeableRow({
  transaction,
  onOpen,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const tone = resolveCategoryColor(
    transaction.category?.name,
    transaction.category?.color_hex,
  );
  const letter = (transaction.merchant_name ?? '?').trim().charAt(0).toUpperCase();

  const close = () => swipeRef.current?.close();

  const renderActions = () => (
    <View style={{ width: ACTION_WIDTH, flexDirection: 'row' }}>
      <Pressable
        onPress={() => {
          close();
          onEdit();
        }}
        style={{
          flex: 1,
          backgroundColor: tealAlpha(0.18),
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <EditIcon />
        <Text style={{ color: accent.teal, fontSize: 11, fontWeight: '600' }}>Edit</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          close();
          onDelete();
        }}
        style={{
          flex: 1,
          backgroundColor: dangerAlpha(0.2),
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <DeleteIcon />
        <Text style={{ color: accent.danger, fontSize: 11, fontWeight: '600' }}>
          Delete
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderActions}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.soft : colors.bg,
          paddingHorizontal: 20,
          paddingVertical: 13,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.line,
        })}
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
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: fontSize.baseLg,
              fontWeight: fontWeight.semibold,
            }}
          >
            {transaction.merchant_name ?? 'Unknown merchant'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
            {[transaction.category?.name, transaction.transaction_date]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
            }}
          >
            {formatCurrency(transaction.total_amount)}
          </Text>
          {transaction.is_anomaly ? (
            <Text style={{ color: accent.danger, fontSize: fontSize.tiny }}>Unusual</Text>
          ) : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function TransactionsListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string>(ALL);
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (categoryName: string, rangeKey: RangeKey, query: string) => {
      setError(null);
      try {
        const page = await transactionsApi.list({
          category: categoryName === ALL ? undefined : categoryName,
          q: query.trim() || undefined,
          per_page: 100,
          ...resolveRange(rangeKey),
        });
        setTransactions(page.transactions);

        if (categories.length === 0) {
          setCategories(await transactionsApi.categories());
        }
      } catch (err) {
        setError(errorMessage(err, 'Could not load transactions.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [categories.length],
  );

  useFocusEffect(
    useCallback(() => {
      load(category, range, search);
    }, [load, category, range, search]),
  );

  const confirmDelete = (transaction: Transaction) => {
    Alert.alert(
      'Delete transaction?',
      `${transaction.merchant_name ?? 'This transaction'} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic: drop it locally, restore on failure.
            const previous = transactions;
            setTransactions((current) =>
              current.filter((item) => item.id !== transaction.id),
            );
            try {
              await transactionsApi.remove(transaction.id);
            } catch (err) {
              setTransactions(previous);
              setError(errorMessage(err, 'Could not delete that transaction.'));
            }
          },
        },
      ],
    );
  };

  const clearFilters = () => {
    setCategory(ALL);
    setRange('all');
    setSearch('');
  };

  const filtersActive = category !== ALL || range !== 'all' || search.trim() !== '';

  if (loading) return <Loading label="Loading transactions…" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: spacing.md, gap: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{ color: colors.text, fontSize: 26, fontWeight: fontWeight.bold }}
            >
              Transactions
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
              {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>

          <Pressable
            onPress={() => setSearchOpen((open) => !open)}
            accessibilityLabel="Search transactions"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: searchOpen ? tealAlpha(0.16) : colors.soft,
              borderWidth: 1,
              borderColor: searchOpen ? tealAlpha(0.4) : colors.line,
            }}
          >
            <SearchIcon color={searchOpen ? accent.teal : colors.muted} />
          </Pressable>
        </View>

        {searchOpen ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: colors.soft,
              borderWidth: 1,
              borderColor: colors.line2,
              borderRadius: 12,
              paddingHorizontal: 14,
              height: 42,
            }}
          >
            <SearchIcon color={colors.muted} size={14} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search merchants…"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              style={{ flex: 1, color: colors.text, fontSize: fontSize.base }}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Text style={{ color: colors.muted, fontSize: fontSize.small }}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Category chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[ALL, ...categories.map((item) => item.name)]}
          keyExtractor={(item) => `cat-${item}`}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const active = item === category;
            const tone =
              item === ALL
                ? accent.teal
                : resolveCategoryColor(
                    item,
                    categories.find((c) => c.name === item)?.color_hex,
                  );
            return (
              <Pressable
                onPress={() => setCategory(item)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: radii.chip,
                  backgroundColor: active ? `${tone}2E` : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? `${tone}66` : colors.line2,
                }}
              >
                <Text
                  style={{
                    color: active ? tone : colors.muted,
                    fontSize: 12.5,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />

        {/* Date-range chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={RANGES}
          keyExtractor={(item) => `range-${item.key}`}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => {
            const active = item.key === range;
            return (
              <Pressable
                onPress={() => setRange(item.key)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: radii.chip,
                  backgroundColor: active ? tealAlpha(0.18) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? tealAlpha(0.4) : colors.line2,
                }}
              >
                <Text
                  style={{
                    color: active ? accent.teal : colors.muted,
                    fontSize: 12.5,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />

        <ErrorNote message={error} />
      </View>

      {transactions.length > 0 ? (
        <Text
          style={{
            color: colors.muted2,
            fontSize: fontSize.caption,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          Swipe a row left for quick actions
        </Text>
      ) : null}

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <SwipeableRow
            transaction={item}
            onOpen={() =>
              navigation.navigate('TransactionDetail', { transactionId: item.id })
            }
            onEdit={() =>
              navigation.navigate('TransactionDetail', {
                transactionId: item.id,
                startInEdit: true,
              })
            }
            onDelete={() => confirmDelete(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(category, range, search);
            }}
            tintColor={accent.teal}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 70, paddingHorizontal: 40 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: colors.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SearchIcon color={colors.muted} size={26} />
            </View>
            <Text
              style={{ color: colors.text, fontSize: 15.5, fontWeight: fontWeight.bold }}
            >
              No transactions found
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: fontSize.body,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {filtersActive
                ? 'Nothing matches these filters yet.'
                : 'Scan a receipt to record your first transaction.'}
            </Text>
            {filtersActive ? (
              <Pressable
                onPress={clearFilters}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: tealAlpha(0.4),
                  borderRadius: radii.chip,
                }}
              >
                <Text
                  style={{
                    color: accent.teal,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}
