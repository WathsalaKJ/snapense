/**
 * Desktop-web dashboard layout: a real multi-column grid (hero stat, donut,
 * budgets summary in row one; trend + insights in row two) instead of the
 * mobile single-column stack. Rendered by DashboardScreen only when
 * useIsDesktopWeb() is true - it owns no data fetching of its own, just
 * layout, so the mobile JSX in DashboardScreen.tsx is untouched.
 */

import React from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import type { Budget, MonthSummary, SpendingInsight, Transaction, TrendPoint } from '../../api/types';
import { useTheme } from '../../context/ThemeContext';
import { DonutChart, DonutLegend, TrendChart, type DonutSlice } from '../../components/charts';
import { ProgressBar, formatCurrency } from '../../components';
import {
  accent,
  dangerAlpha,
  fontSize,
  fontWeight,
  resolveCategoryColor,
  tealAlpha,
} from '../../theme';
import { webFonts, webRadii, webShadow, webSpacing } from '../../theme/web';

function cardStyle(colors: { card: string; line: string }): ViewStyle {
  return {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: webRadii.card,
    padding: webSpacing.lg,
    // boxShadow isn't in core RN's ViewStyle type; react-native-web reads it directly.
    ...({ boxShadow: webShadow.card } as object),
  };
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: webSpacing.md,
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: fontSize.small,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          fontFamily: webFonts.body,
        }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}

/** Under 75% on-track, 75-100% warning, over 100% over budget - matches BudgetsScreen. */
function barColorFor(ratio: number): string {
  if (ratio > 1) return accent.danger;
  if (ratio >= 0.75) return accent.warning;
  return accent.success;
}

export default function DashboardDesktopGrid({
  greeting,
  month,
  slices,
  selectedCategory,
  onSelectCategory,
  monthlyTrend,
  anomalies,
  insights,
  budgets,
  onOpenAnomaly,
  onOpenBudgets,
}: {
  greeting: string;
  month: MonthSummary | undefined;
  slices: DonutSlice[];
  selectedCategory: number | null;
  onSelectCategory: (slice: DonutSlice) => void;
  monthlyTrend: TrendPoint[];
  anomalies: Transaction[];
  insights: SpendingInsight[];
  budgets: Budget[];
  onOpenAnomaly: (transaction: Transaction) => void;
  onOpenBudgets: () => void;
}) {
  const { colors } = useTheme();

  const selected = slices.find((slice) => slice.id === selectedCategory) ?? null;
  const focus = selected ?? slices[0] ?? null;

  const changePct = month?.change_pct ?? null;
  const isIncrease = changePct != null && changePct > 0;
  const deltaColor = changePct == null ? colors.muted : isIncrease ? accent.danger : accent.success;

  const topBudgets = budgets.slice(0, 4);

  return (
    <View style={{ gap: webSpacing.xl, paddingBottom: webSpacing.xxl }}>
      {/* Header */}
      <View>
        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            fontWeight: '600',
            fontFamily: webFonts.display,
            letterSpacing: 0.2,
          }}
        >
          Dashboard
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: fontSize.body,
            marginTop: 4,
            fontFamily: webFonts.body,
          }}
        >
          {greeting}
        </Text>
      </View>

      {/* Row 1: hero stat / donut / budgets summary */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing.lg }}>
        {/* Hero stat */}
        <View
          style={{
            flexBasis: '30%',
            flexGrow: 1,
            minWidth: 260,
            backgroundColor: tealAlpha(0.08),
            borderWidth: 1,
            borderColor: tealAlpha(0.22),
            borderRadius: webRadii.hero,
            padding: webSpacing.lg,
            justifyContent: 'space-between',
            gap: webSpacing.lg,
            ...({ boxShadow: webShadow.hero } as object),
          }}
        >
          <View>
            <Text
              style={{
                color: colors.muted,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                fontFamily: webFonts.body,
              }}
            >
              Total spent · {month?.label ?? ''}
            </Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 46,
                fontWeight: '600',
                fontFamily: webFonts.display,
                marginTop: 6,
              }}
            >
              {formatCurrency(month?.total_spent)}
            </Text>
            {changePct != null ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: deltaColor, fontSize: fontSize.small, fontWeight: '800' }}>
                  {isIncrease ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%
                </Text>
                <Text style={{ color: colors.muted2, fontSize: fontSize.small, fontFamily: webFonts.body }}>
                  vs last month
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: webSpacing.lg,
              borderTopWidth: 1,
              borderTopColor: tealAlpha(0.18),
              paddingTop: webSpacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: webFonts.body }}>
                Avg. transaction
              </Text>
              <Text style={{ color: colors.text2, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold }}>
                {formatCurrency(month?.average_transaction)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: webFonts.body }}>
                Transactions
              </Text>
              <Text style={{ color: colors.text2, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold }}>
                {month?.transaction_count ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Donut - legend stacked below (not beside) the circle, so it gets
            the card's full width rather than a narrow leftover column that
            truncates longer category names. */}
        <View style={{ flexBasis: '34%', flexGrow: 1, minWidth: 300, ...cardStyle(colors) }}>
          <CardHeader title="Spending by category" />
          <View style={{ alignItems: 'center', marginBottom: webSpacing.md }}>
            <DonutChart
              slices={slices}
              selectedId={selectedCategory}
              onSelect={onSelectCategory}
              centerLabel={focus ? formatCurrency(focus.total) : formatCurrency(0)}
              centerSub={focus ? focus.name : 'No spending'}
              size={168}
            />
          </View>
          <DonutLegend
            slices={slices}
            selectedId={selectedCategory}
            onSelect={onSelectCategory}
            formatValue={formatCurrency}
          />
        </View>

        {/* Budgets summary */}
        <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 260, ...cardStyle(colors) }}>
          <CardHeader
            title="Budgets"
            action={
              <Pressable onPress={onOpenBudgets}>
                {({ hovered }: any) => (
                  <Text
                    style={{
                      color: hovered ? accent.tealBright : accent.teal,
                      fontSize: fontSize.caption,
                      fontWeight: fontWeight.semibold,
                      fontFamily: webFonts.body,
                    }}
                  >
                    View all →
                  </Text>
                )}
              </Pressable>
            }
          />
          {topBudgets.length > 0 ? (
            <View style={{ gap: webSpacing.sm }}>
              {topBudgets.map((budget) => {
                const limit = budget.monthly_limit;
                const spent = budget.amount_spent_this_month;
                const ratio = limit > 0 ? spent / limit : spent > 0 ? 1 : 0;
                const color = barColorFor(ratio);
                return (
                  <View key={budget.id} style={{ gap: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.text2,
                          fontSize: fontSize.small,
                          fontWeight: fontWeight.semibold,
                          fontFamily: webFonts.body,
                          flexShrink: 1,
                        }}
                      >
                        {budget.category?.name ?? 'Uncategorised'}
                      </Text>
                      <Text style={{ color, fontSize: fontSize.caption, fontWeight: '800' }}>
                        {limit > 0 ? `${Math.round(ratio * 100)}%` : '—'}
                      </Text>
                    </View>
                    <ProgressBar ratio={ratio} color={color} />
                  </View>
                );
              })}
            </View>
          ) : (
            <Pressable onPress={onOpenBudgets}>
              <Text style={{ color: colors.muted, fontSize: fontSize.body, fontFamily: webFonts.body }}>
                No budgets yet — set one to track spending by category.
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Row 2: trend / insights */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing.lg }}>
        <View style={{ flexBasis: '62%', flexGrow: 1, minWidth: 420, ...cardStyle(colors) }}>
          <CardHeader title="Monthly trend" />
          <TrendChart points={monthlyTrend} height={200} />
        </View>

        <View style={{ flexBasis: '32%', flexGrow: 1, minWidth: 280, ...cardStyle(colors), gap: webSpacing.md }}>
          <CardHeader title="Insights" />

          {anomalies.map((transaction) => (
            <Pressable key={`anomaly-${transaction.id}`} onPress={() => onOpenAnomaly(transaction)}>
              {({ hovered }: any) => (
                <View
                  style={{
                    backgroundColor: hovered ? dangerAlpha(0.16) : dangerAlpha(0.1),
                    borderWidth: 1,
                    borderColor: dangerAlpha(0.3),
                    borderRadius: 12,
                    padding: webSpacing.sm,
                    gap: 3,
                  }}
                >
                  <Text style={{ color: accent.danger, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
                    Unusual charge
                  </Text>
                  <Text style={{ color: colors.text2, fontSize: fontSize.caption, lineHeight: 16, fontFamily: webFonts.body }}>
                    {transaction.merchant_name ?? 'A transaction'} · {formatCurrency(transaction.total_amount)}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}

          {insights.map((insight) => {
            const tone = insight.category
              ? resolveCategoryColor(insight.category.name, insight.category.color_hex)
              : '#FDBA74';
            return (
              <View
                key={`insight-${insight.id}`}
                style={{
                  backgroundColor: colors.soft,
                  borderRadius: 12,
                  padding: webSpacing.sm,
                  gap: 3,
                }}
              >
                <Text style={{ color: tone, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
                  {insight.category?.name ?? 'Spending insight'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: fontSize.caption, lineHeight: 16, fontFamily: webFonts.body }}>
                  {insight.insight_text}
                </Text>
              </View>
            );
          })}

          {anomalies.length === 0 && insights.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: fontSize.body, fontFamily: webFonts.body }}>
              Record a few more receipts and Snapense will start spotting trends and unusual
              charges.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
