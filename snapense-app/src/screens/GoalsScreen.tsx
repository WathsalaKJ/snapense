import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import { goalsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { SavingsGoal } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb, useResponsive } from '../hooks/useResponsive';
import type { AppStackParamList } from '../navigation/types';
import {
  EmptyState,
  ErrorNote,
  Loading,
  ProgressBar,
  WebContainer,
  formatCurrency,
} from '../components';
import ConfirmDialog from '../components/ConfirmDialog';
import GoalFormModal, { type GoalFormValues } from './GoalFormModal';
import GoalsDesktopGrid from './web/GoalsDesktopGrid';
import { webContentMaxWidth, webSpacing } from '../theme/web';
import { accent, dangerAlpha, fontSize, fontWeight } from '../theme';

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

/** Same glyph as TransactionsListScreen's header "+" button - the
 * established convention for a screen's single primary add action. */
function PlusIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 1.5v13M1.5 8h13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** A bullseye - reads as "target" without borrowing the Budgets wallet glyph. */
export function GoalIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={10} height={8} viewBox="0 0 11 9" fill="none">
      <Path
        d="M1 4.5l3 3 6-6"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Distinct from budget over/warning/success ratio colors - a goal only ever
 * has two states worth coloring: still in progress, or done. */
export function goalColor(goal: SavingsGoal): string {
  return goal.is_complete ? accent.success : accent.teal;
}

export function CompleteBadge() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
        backgroundColor: `${accent.success}22`,
      }}
    >
      <CheckIcon color={accent.success} />
      <Text style={{ color: accent.success, fontSize: fontSize.caption, fontWeight: fontWeight.bold }}>
        Complete
      </Text>
    </View>
  );
}

function GoalCard({
  goal,
  onPress,
  onDelete,
}: {
  goal: SavingsGoal;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);

  const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
  const color = goalColor(goal);
  const close = () => swipeRef.current?.close();

  const renderActions = () => (
    <Pressable
      onPress={() => {
        close();
        onDelete();
      }}
      style={{
        width: 84,
        backgroundColor: dangerAlpha(0.2),
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 16,
        marginLeft: 8,
      }}
    >
      <DeleteIcon />
      <Text style={{ color: accent.danger, fontSize: 11, fontWeight: '600' }}>Delete</Text>
    </Pressable>
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
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.soft : colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
          padding: 16,
          gap: 10,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: `${color}24`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GoalIcon color={color} size={20} />
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: colors.text, fontSize: fontSize.baseLg, fontWeight: fontWeight.semibold }}
            >
              {goal.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
              {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
              {goal.target_date ? ` · by ${goal.target_date}` : ''}
            </Text>
          </View>

          {goal.is_complete ? (
            <CompleteBadge />
          ) : (
            <Text style={{ color, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
              {Math.round(goal.percent_complete)}%
            </Text>
          )}
        </View>

        <ProgressBar ratio={ratio} color={color} />

        <Text style={{ color: colors.muted2, fontSize: fontSize.caption }}>
          {formatCurrency(goal.auto_saved_amount)} from budget savings + {formatCurrency(goal.manual_amount)} added manually
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function GoalsScreen() {
  const { colors } = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavingsGoal | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGoals(await goalsApi.list());
    } catch (err) {
      setError(errorMessage(err, 'Could not load your goals.'));
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

  const openDetail = (goal: SavingsGoal) => navigation.navigate('GoalDetail', { goalId: goal.id });

  const submitGoal = async (values: GoalFormValues) => {
    setSubmitting(true);
    try {
      const created = await goalsApi.create(values);
      setGoals((current) => [...current, created]);
      setModalVisible(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not create that goal.'));
    } finally {
      setSubmitting(false);
    }
  };

  const performDeleteGoal = async () => {
    if (!pendingDelete) return;
    const goal = pendingDelete;
    setPendingDelete(null);

    const previous = goals;
    setGoals((current) => current.filter((item) => item.id !== goal.id));
    try {
      await goalsApi.remove(goal.id);
    } catch (err) {
      setGoals(previous);
      setError(errorMessage(err, 'Could not delete that goal.'));
    }
  };

  if (loading) return <Loading label="Loading your goals…" />;

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
          <GoalsDesktopGrid
            goals={goals}
            onOpen={openDetail}
            onAddNew={() => setModalVisible(true)}
            onDelete={setPendingDelete}
          />
        </ScrollView>

        <GoalFormModal
          visible={modalVisible}
          goal={null}
          submitting={submitting}
          onClose={() => setModalVisible(false)}
          onSubmit={submitGoal}
        />

        <ConfirmDialog
          visible={pendingDelete != null}
          title="Delete goal?"
          message={`"${pendingDelete?.name ?? 'This goal'}" and its contribution history will be removed. This cannot be undone.`}
          onConfirm={performDeleteGoal}
          onCancel={() => setPendingDelete(null)}
        />
      </View>
    );
  }

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
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Goals</Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
                Savings targets, funded automatically and by hand
              </Text>
            </View>

            <Pressable
              onPress={() => setModalVisible(true)}
              accessibilityLabel="Add a new goal"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accent.teal,
              }}
            >
              <PlusIcon color="#06231F" />
            </Pressable>
          </View>

          <ErrorNote message={error} />

          {goals.length > 0 ? (
            <View style={{ gap: 10 }}>
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPress={() => openDetail(goal)}
                  onDelete={() => setPendingDelete(goal)}
                />
              ))}
            </View>
          ) : (
            // No action button here - matches BudgetsScreen's own empty
            // state, which also relies on the header's "+" rather than
            // repeating the same action twice on one screen.
            <EmptyState
              icon={<GoalIcon color={accent.teal} />}
              title="No goals yet"
              body="Create a savings goal and watch it fill up from budget under-spend and whatever you add by hand."
            />
          )}
        </ScrollView>
      </WebContainer>

      <GoalFormModal
        visible={modalVisible}
        goal={null}
        submitting={submitting}
        onClose={() => setModalVisible(false)}
        onSubmit={submitGoal}
      />

      <ConfirmDialog
        visible={pendingDelete != null}
        title="Delete goal?"
        message={`"${pendingDelete?.name ?? 'This goal'}" and its contribution history will be removed. This cannot be undone.`}
        onConfirm={performDeleteGoal}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}
