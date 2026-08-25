import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { dashboardApi, insightsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { DashboardSummary, SpendingInsight, Transaction } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ErrorNote, Loading, formatCurrency } from '../components';
import { DonutChart, DonutLegend, TrendChart } from '../components/charts';
import {
  accent,
  dangerAlpha,
  fontSize,
  fontWeight,
  resolveCategoryColor,
  spacing,
  tealAlpha,
} from '../theme';
import type { AppStackParamList } from '../navigation/types';

function ChevronIcon() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" style={{ marginTop: 4 }}>
      <Path
        d="M1 1l6 6-6 6"
        stroke={accent.danger}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TrendUpIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d="M1 12l4-5 3 3 4-6 3 4"
        stroke="#FDBA74"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Card wrapper matching the dashboard's 18px-radius panels. */
function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 18,
        padding: 20,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <Text
          style={{
            color: colors.muted,
            fontSize: fontSize.small,
            fontWeight: fontWeight.semibold,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
        {meta ? (
          <Text style={{ color: colors.muted2, fontSize: fontSize.caption }}>{meta}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryData, insightData] = await Promise.all([
        dashboardApi.summary(),
        insightsApi.list(10),
      ]);
      setSummary(summaryData);
      setInsights(insightData);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading label="Loading your spending…" />;

  const month = summary?.month;
  const slices =
    summary?.by_category.map((row) => ({
      id: row.category_id,
      name: row.name,
      total: row.total,
      colorHex: row.color_hex,
    })) ?? [];

  const selected = slices.find((slice) => slice.id === selectedCategory) ?? null;
  const topSlice = slices[0] ?? null;
  const focus = selected ?? topSlice;

  const anomalies = summary?.anomalies ?? [];
  const initials = (user?.full_name ?? '?')
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const openAnomaly = (transaction: Transaction) =>
    navigation.navigate('TransactionDetail', { transactionId: transaction.id });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={accent.teal}
          />
        }
      >
        <View style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                color: colors.text2,
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
              }}
            >
              Hi {user?.full_name?.split(' ')[0] ?? 'there'}, welcome back 👋
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: tealAlpha(0.16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: accent.teal, fontSize: 13, fontWeight: '800' }}>
                {initials}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
              Dashboard
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
              {month?.label ?? ''} · {formatCurrency(month?.total_spent)} spent
            </Text>
          </View>
        </View>

        <ErrorNote message={error} />

        {/* Donut */}
        <Panel title="Spending by category" meta="tap a segment">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14 }}>
            <DonutChart
              slices={slices}
              selectedId={selectedCategory}
              onSelect={(slice) =>
                setSelectedCategory((current) => (current === slice.id ? null : slice.id))
              }
              centerLabel={focus ? formatCurrency(focus.total) : formatCurrency(0)}
              centerSub={focus ? focus.name : 'No spending'}
            />
            <DonutLegend
              slices={slices}
              selectedId={selectedCategory}
              onSelect={(slice) =>
                setSelectedCategory((current) => (current === slice.id ? null : slice.id))
              }
              formatValue={formatCurrency}
            />
          </View>
        </Panel>

        {/* Trend */}
        <Panel title="Monthly trend" meta="last 6 months">
          <View style={{ marginTop: 12 }}>
            <TrendChart points={summary?.monthly_trend ?? []} />
          </View>
        </Panel>

        <Text
          style={{
            color: colors.muted,
            fontSize: fontSize.small,
            fontWeight: fontWeight.semibold,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            marginHorizontal: 4,
            marginBottom: -6,
          }}
        >
          Insights
        </Text>

        {/* Anomaly alerts, in the design's rose accent. */}
        {anomalies.map((transaction) => (
          <Pressable
            key={`anomaly-${transaction.id}`}
            onPress={() => openAnomaly(transaction)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? dangerAlpha(0.16) : dangerAlpha(0.1),
              borderWidth: 1,
              borderColor: dangerAlpha(0.35),
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 13,
            })}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: dangerAlpha(0.2),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: accent.danger, fontWeight: '800', fontSize: 16 }}>
                !
              </Text>
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  color: accent.danger,
                  fontSize: 13.5,
                  fontWeight: fontWeight.bold,
                }}
              >
                Unusual charge detected
              </Text>
              <Text style={{ color: colors.text, fontSize: fontSize.body, lineHeight: 19 }}>
                {transaction.merchant_name ?? 'A transaction'}{' '}
                {formatCurrency(transaction.total_amount)}
                {transaction.transaction_date ? ` on ${transaction.transaction_date}` : ''}
                {transaction.anomaly_reason ? ` — ${transaction.anomaly_reason}` : ''} Tap
                to review.
              </Text>
            </View>

            <ChevronIcon />
          </Pressable>
        ))}

        {/* Stored insights */}
        {insights.map((insight) => {
          const tone = insight.category
            ? resolveCategoryColor(insight.category.name, insight.category.color_hex)
            : '#FDBA74';
          return (
            <View
              key={`insight-${insight.id}`}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 13,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: `${tone}26`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendUpIcon />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13.5,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {insight.category?.name ?? 'Spending insight'}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}
                >
                  {insight.insight_text}
                </Text>
              </View>
            </View>
          );
        })}

        {anomalies.length === 0 && insights.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              padding: 18,
              gap: spacing.sm,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 13.5,
                fontWeight: fontWeight.bold,
              }}
            >
              No insights yet
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}>
              Record a few more receipts and Snapense will start spotting trends and
              unusual charges.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
