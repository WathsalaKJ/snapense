import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { budgetsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { BudgetHistoryEntry } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import {
  CategoryIcon,
  EmptyState,
  ErrorNote,
  Loading,
  WebContainer,
  formatCurrency,
} from '../components';
import { TrendChart, type TrendPointData } from '../components/charts';
import { accent, fontSize, fontWeight } from '../theme';

const HISTORY_MONTHS = 6;

function CategoryHistoryCard({ entry }: { entry: BudgetHistoryEntry }) {
  const { colors } = useTheme();

  const points: TrendPointData[] = entry.history.map((month) => ({
    month: month.month,
    total: month.amount_spent,
  }));

  // The limit is the same for every entry (today's monthly_limit, applied
  // retroactively - see the backend route's docstring), so any month works.
  const currentLimit = entry.history[entry.history.length - 1]?.monthly_limit ?? 0;
  const overBudgetMonths = entry.history.filter((month) => month.over_budget).length;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 18,
        padding: 20,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CategoryIcon
          name={entry.category?.name}
          iconName={entry.category?.icon_name}
          colorHex={entry.category?.color_hex}
          size={38}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{ color: colors.text, fontSize: fontSize.baseLg, fontWeight: fontWeight.semibold }}
          >
            {entry.category?.name ?? 'Uncategorised'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
            Limit {formatCurrency(currentLimit)}/mo
          </Text>
        </View>
        {overBudgetMonths > 0 ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 100,
              backgroundColor: `${accent.danger}22`,
            }}
          >
            <Text style={{ color: accent.danger, fontSize: fontSize.caption, fontWeight: fontWeight.bold }}>
              {overBudgetMonths} over
            </Text>
          </View>
        ) : null}
      </View>

      <TrendChart
        points={points}
        referenceValue={currentLimit}
        pointColor={(_point, index) =>
          entry.history[index].over_budget ? accent.danger : accent.success
        }
      />

      {/* Legend for the dashed reference line + dot colors - not obvious from the chart alone. */}
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.success }} />
          <Text style={{ color: colors.muted, fontSize: fontSize.caption }}>Under limit</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.danger }} />
          <Text style={{ color: colors.muted, fontSize: fontSize.caption }}>Over limit</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View
            style={{
              width: 10,
              height: 0,
              borderTopWidth: 1.3,
              borderStyle: 'dashed',
              borderTopColor: colors.muted2,
            }}
          />
          <Text style={{ color: colors.muted, fontSize: fontSize.caption }}>Current limit</Text>
        </View>
      </View>
    </View>
  );
}

export default function BudgetHistoryScreen() {
  const { colors } = useTheme();

  const [budgets, setBudgets] = useState<BudgetHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await budgetsApi.history(HISTORY_MONTHS);
      setBudgets(data.budgets);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your budget history.'));
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

  if (loading) return <Loading label="Loading your budget history…" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
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
        <View>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
            Budget History
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
            Last {HISTORY_MONTHS} months, compared against today's limits
          </Text>
        </View>

        <ErrorNote message={error} />

        {budgets.length > 0 ? (
          <View style={{ gap: 14 }}>
            {budgets.map((entry) => (
              <CategoryHistoryCard key={entry.budget_id} entry={entry} />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No budgets yet"
            body="Set a monthly limit on a category from the Budgets screen to start building up its history."
          />
        )}
      </ScrollView>
      </WebContainer>
    </SafeAreaView>
  );
}
