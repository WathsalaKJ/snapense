import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import { budgetsApi, dashboardApi, goalsApi, insightsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Budget, DashboardSummary, SavingsGoal, SpendingInsight, Transaction } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb } from '../hooks/useResponsive';
import { ErrorNote, Loading, WebContainer, formatCurrency } from '../components';
import { DonutChart, DonutLegend, TrendChart } from '../components/charts';
import InsightCard from '../components/InsightCard';
import { DashboardSkeleton } from '../components/Skeleton';
import DashboardDesktopGrid from './web/DashboardDesktopGrid';
import { webContentMaxWidth, webSpacing } from '../theme/web';
import { accent, dangerAlpha, fontSize, fontWeight, tealAlpha } from '../theme';
import type { AppStackParamList } from '../navigation/types';

function ChevronIcon({ color = accent.danger }: { color?: string }) {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" style={{ marginTop: 4 }}>
      <Path
        d="M1 1l6 6-6 6"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function BudgetIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none">
      <Path
        d="M1.5 4.5A2 2 0 013.5 2.5h10a2 2 0 012 2v8a2 2 0 01-2 2h-10a2 2 0 01-2-2v-8z"
        stroke={accent.teal}
        strokeWidth={1.6}
      />
      <Path d="M11.5 8.5h4" stroke={accent.teal} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M11.5 8.5a1.5 1.5 0 100 3h1.5v-3h-1.5z"
        fill={accent.teal}
      />
    </Svg>
  );
}

/** A bullseye - matches GoalsScreen's GoalIcon, redrawn locally here the same
 * way BudgetIcon is (each screen keeps its own small SVGs rather than a
 * shared icon module - see components/icons.tsx's header comment). */
function GoalIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={accent.teal} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={5} stroke={accent.teal} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={1.6} fill={accent.teal} />
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
  const isDesktopWeb = useIsDesktopWeb();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [insight, setInsight] = useState<SpendingInsight | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regeneratingInsight, setRegeneratingInsight] = useState(false);

  // Budgets and goals only feed the desktop grid's summary cards - mobile's
  // Dashboard never fetched them (it just links to the Budgets/Goals
  // screens), so this stays conditional to avoid extra network round-trips
  // there.
  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryData, insightData, budgetData, goalData] = await Promise.all([
        dashboardApi.summary(),
        insightsApi.list(1),
        isDesktopWeb ? budgetsApi.list() : Promise.resolve<Budget[]>([]),
        isDesktopWeb ? goalsApi.list() : Promise.resolve<SavingsGoal[]>([]),
      ]);
      setSummary(summaryData);
      setInsight(insightData[0] ?? null);
      setBudgets(budgetData);
      setGoals(goalData);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDesktopWeb]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Matches BudgetsScreen's submitBudget: a dedicated loading flag, and
  // failures land in the same top-of-screen `error`/ErrorNote as everything
  // else. A failed regenerate leaves the last-fetched `insight` untouched -
  // the backend itself is careful not to delete the prior insight on a
  // failed generation, and the UI shouldn't undo that by clearing it here.
  const regenerateInsight = useCallback(async () => {
    setRegeneratingInsight(true);
    setError(null);
    try {
      const result = await insightsApi.generate();
      setInsight(result.insights[0] ?? null);
    } catch (err) {
      setError(errorMessage(err, 'Could not generate an insight right now.'));
    } finally {
      setRegeneratingInsight(false);
    }
  }, []);

  if (loading) {
    // The multi-column desktop grid doesn't have a matching skeleton yet
    // (out of scope for this pass) - it keeps the plain spinner; mobile's
    // single-column layout gets a shaped placeholder instead.
    if (isDesktopWeb) return <Loading label="Loading your spending…" />;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <WebContainer>
          <DashboardSkeleton />
        </WebContainer>
      </SafeAreaView>
    );
  }

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

  if (isDesktopWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            padding: webSpacing.xl,
            maxWidth: webContentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          }}
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
          <ErrorNote message={error} />
          <DashboardDesktopGrid
            greeting={`Hi ${user?.full_name?.split(' ')[0] ?? 'there'}, welcome back`}
            month={month}
            slices={slices}
            selectedCategory={selectedCategory}
            onSelectCategory={(slice) =>
              setSelectedCategory((current) => (current === slice.id ? null : slice.id))
            }
            monthlyTrend={summary?.monthly_trend ?? []}
            anomalies={anomalies}
            insight={insight}
            regeneratingInsight={regeneratingInsight}
            onRegenerateInsight={regenerateInsight}
            budgets={budgets}
            goals={goals}
            onOpenAnomaly={openAnomaly}
            onOpenBudgets={() => navigation.navigate('Budgets')}
            onOpenGoals={() => navigation.navigate('Goals')}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <WebContainer>
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

        {/* Budgets entry point */}
        <Pressable
          onPress={() => navigation.navigate('Budgets')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.soft : colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
          })}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: tealAlpha(0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BudgetIcon />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: fontWeight.bold }}>
              Budgets
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
              Set monthly limits by category
            </Text>
          </View>
          <ChevronIcon color={colors.muted} />
        </Pressable>

        {/* Goals entry point - same shape as the Budgets card above (icon +
            label + chevron); Goals gets no extra live numbers here, matching
            Budgets' own mobile treatment, which also just links out rather
            than previewing data inline. */}
        <Pressable
          onPress={() => navigation.navigate('Goals')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.soft : colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
          })}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: tealAlpha(0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GoalIcon />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 13.5, fontWeight: fontWeight.bold }}>
              Goals
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
              Track savings targets
            </Text>
          </View>
          <ChevronIcon color={colors.muted} />
        </Pressable>

        {/* AI insight - a dedicated panel (not a cramped stat row) since this
            is natural-language content and deserves room to read. */}
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 18,
            padding: 20,
          }}
        >
          <InsightCard
            insight={insight}
            regenerating={regeneratingInsight}
            onRegenerate={regenerateInsight}
            variant="mobile"
          />
        </View>

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

        {/* Anomaly alerts, in the design's rose accent. Nothing renders when
            there are none - unlike the AI insight above, "no alerts" isn't
            worth a dedicated empty-state card on a single-column stack. */}
        {anomalies.length > 0 ? (
          <>
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
              Alerts
            </Text>

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
          </>
        ) : null}
      </ScrollView>
      </WebContainer>
    </SafeAreaView>
  );
}
