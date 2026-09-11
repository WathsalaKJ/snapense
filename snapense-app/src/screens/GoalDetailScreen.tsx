/**
 * Full goal detail: progress breakdown, contribution history, add a manual
 * contribution, and edit/delete for both the goal and individual
 * contributions. Pushed as its own stack screen (like TransactionDetail)
 * since there's real content here beyond what a list row or a small sheet
 * can hold.
 *
 * There's no GET /api/goals/<id> on the backend (only the list route), so
 * this re-fetches the whole list and finds the matching goal - simplest
 * option given the auto_saved_amount/percent_complete/is_complete fields
 * are all server-computed and not worth re-deriving client-side after every
 * mutation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { goalsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { GoalContribution, SavingsGoal } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import {
  ErrorNote,
  Field,
  Loading,
  PrimaryButton,
  ProgressBar,
  WebContainer,
  formatCurrency,
} from '../components';
import ConfirmDialog from '../components/ConfirmDialog';
import GoalFormModal, { type GoalFormValues } from './GoalFormModal';
import { CompleteBadge, goalColor } from './GoalsScreen';
import { accent, dangerAlpha, fontSize, fontWeight, radii, spacing, tealAlpha } from '../theme';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GoalDetail'>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={14} viewBox="0 0 14 15">
      <Path
        d="M1 3.5h12M5 3.5V2a1 1 0 011-1h2a1 1 0 011 1v1.5M2.5 3.5l1 10a1 1 0 001 1h5a1 1 0 001-1l1-10"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Amount + optional note + optional date - local to this screen, like
 * BudgetsScreen's BudgetModal, since nothing else needs it. */
function ContributionFormModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: { amount: number; note: string | null; contributed_at: string | null }) => void;
}) {
  const { colors } = useTheme();
  const { isWideWeb } = useResponsive();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [contributedAt, setContributedAt] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
      setNote('');
      setContributedAt('');
    }
  }, [visible]);

  const amountValue = Number(amount);
  const isAmountValid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0;
  const isDateValid = contributedAt.trim() === '' || ISO_DATE.test(contributedAt.trim());
  const isValid = isAmountValid && isDateValid;

  const submit = () => {
    if (!isValid) return;
    onSubmit({
      amount: amountValue,
      note: note.trim() === '' ? null : note.trim(),
      contributed_at: contributedAt.trim() === '' ? null : contributedAt.trim(),
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWideWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,10,18,0.62)' }]}
        accessibilityLabel="Close contribution form"
      />
      <View
        pointerEvents="box-none"
        style={
          isWideWeb
            ? { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }
            : { flex: 1, justifyContent: 'flex-end' }
        }
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderBottomWidth: isWideWeb ? 1 : 0,
            borderColor: colors.line,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            borderBottomLeftRadius: isWideWeb ? radii.sheet : 0,
            borderBottomRightRadius: isWideWeb ? radii.sheet : 0,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 36,
            gap: 16,
            width: '100%',
            ...(isWideWeb ? { maxWidth: 420 } : null),
          }}
        >
          {isWideWeb ? null : (
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 100,
                backgroundColor: colors.softer,
                alignSelf: 'center',
              }}
            />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text
              style={{ flex: 1, color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}
            >
              Add contribution
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 14 }}>✕</Text>
            </Pressable>
          </View>

          <Field
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            autoFocus
          />
          <Field
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Bonus from work"
          />
          <Field
            label="Date (optional, defaults to today)"
            value={contributedAt}
            onChangeText={setContributedAt}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          {contributedAt.trim() !== '' && !isDateValid ? (
            <Text style={{ color: accent.danger, fontSize: fontSize.small, marginTop: -10 }}>
              Enter the date as YYYY-MM-DD.
            </Text>
          ) : null}

          <PrimaryButton
            label="Add contribution"
            onPress={submit}
            disabled={!isValid}
            loading={submitting}
          />
        </View>
      </View>
    </Modal>
  );
}

function ContributionRow({
  contribution,
  onDelete,
}: {
  contribution: GoalContribution;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
          {formatCurrency(contribution.amount)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
          {contribution.contributed_at}
          {contribution.note ? ` · ${contribution.note}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          backgroundColor: dangerAlpha(0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TrashIcon color={accent.danger} />
      </Pressable>
    </View>
  );
}

export default function GoalDetailScreen({ route, navigation }: Props) {
  const { goalId } = route.params;
  const { colors } = useTheme();

  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [contributionModalVisible, setContributionModalVisible] = useState(false);
  const [contributionSubmitting, setContributionSubmitting] = useState(false);
  const [pendingDeleteContribution, setPendingDeleteContribution] = useState<GoalContribution | null>(
    null,
  );

  const [deleteGoalDialogOpen, setDeleteGoalDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [goals, contribs] = await Promise.all([
        goalsApi.list(),
        goalsApi.listContributions(goalId),
      ]);
      setGoal(goals.find((item) => item.id === goalId) ?? null);
      setContributions(contribs);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this goal.'));
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitEdit = async (values: GoalFormValues) => {
    setEditSubmitting(true);
    try {
      const updated = await goalsApi.update(goalId, values);
      setGoal(updated);
      setEditModalVisible(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your changes.'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitContribution = async (values: {
    amount: number;
    note: string | null;
    contributed_at: string | null;
  }) => {
    setContributionSubmitting(true);
    try {
      await goalsApi.addContribution(goalId, values);
      setContributionModalVisible(false);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not add that contribution.'));
    } finally {
      setContributionSubmitting(false);
    }
  };

  const performDeleteContribution = async () => {
    if (!pendingDeleteContribution) return;
    const contribution = pendingDeleteContribution;
    setPendingDeleteContribution(null);
    try {
      await goalsApi.removeContribution(goalId, contribution.id);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that contribution.'));
    }
  };

  const performDeleteGoal = async () => {
    setDeleteGoalDialogOpen(false);
    try {
      await goalsApi.remove(goalId);
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this goal.'));
    }
  };

  if (loading) return <Loading label="Loading this goal…" />;

  if (!goal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}>
        <ErrorNote message={error ?? 'Goal not found.'} />
      </View>
    );
  }

  const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
  const color = goalColor(goal);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <WebContainer>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.text, fontSize: fontSize.title, fontWeight: fontWeight.bold }}>
                {goal.name}
              </Text>
              {goal.target_date ? (
                <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
                  Target date: {goal.target_date}
                </Text>
              ) : null}
            </View>
            {goal.is_complete ? <CompleteBadge /> : null}
            <Pressable
              onPress={() => setEditModalVisible(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: radii.chip,
                backgroundColor: tealAlpha(0.14),
                borderWidth: 1,
                borderColor: tealAlpha(0.35),
              }}
            >
              <EditIcon color={accent.teal} />
              <Text style={{ color: accent.teal, fontSize: fontSize.small, fontWeight: fontWeight.semibold }}>
                Edit
              </Text>
            </Pressable>
          </View>

          <ErrorNote message={error} />

          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              padding: 18,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                {formatCurrency(goal.current_amount)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
                of {formatCurrency(goal.target_amount)}
              </Text>
            </View>

            <ProgressBar ratio={ratio} color={color} style={{ height: 10, borderRadius: 5 }} />

            <Text style={{ color: color, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
              {Math.round(goal.percent_complete)}% complete
            </Text>

            {/* The two funding sources shown separately, not just summed -
                so it's clear how much of this is "free" budget surplus vs.
                money the user actually set aside themselves. */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.line,
                paddingTop: 12,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.muted2, fontSize: fontSize.caption }}>From budget savings</Text>
                <Text style={{ color: colors.text2, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold }}>
                  {formatCurrency(goal.auto_saved_amount)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.muted2, fontSize: fontSize.caption }}>Added manually</Text>
                <Text style={{ color: colors.text2, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold }}>
                  {formatCurrency(goal.manual_amount)}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                color: colors.muted,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              Contributions
            </Text>
            <Pressable onPress={() => setContributionModalVisible(true)}>
              <Text style={{ color: accent.teal, fontSize: fontSize.small, fontWeight: fontWeight.semibold }}>
                + Add
              </Text>
            </Pressable>
          </View>

          {contributions.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {contributions.map((contribution) => (
                <ContributionRow
                  key={contribution.id}
                  contribution={contribution}
                  onDelete={() => setPendingDeleteContribution(contribution)}
                />
              ))}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}>
                No manual contributions yet — add one, or just let budget under-spend build this up
                over time.
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => setDeleteGoalDialogOpen(true)}
            style={{
              marginTop: spacing.md,
              alignItems: 'center',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${accent.danger}59`,
            }}
          >
            <Text style={{ color: accent.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
              Delete goal
            </Text>
          </Pressable>
        </ScrollView>
      </WebContainer>

      <GoalFormModal
        visible={editModalVisible}
        goal={goal}
        submitting={editSubmitting}
        onClose={() => setEditModalVisible(false)}
        onSubmit={submitEdit}
      />

      <ContributionFormModal
        visible={contributionModalVisible}
        submitting={contributionSubmitting}
        onClose={() => setContributionModalVisible(false)}
        onSubmit={submitContribution}
      />

      <ConfirmDialog
        visible={pendingDeleteContribution != null}
        title="Delete contribution?"
        message={`This ${formatCurrency(pendingDeleteContribution?.amount ?? 0)} entry will be removed. This cannot be undone.`}
        onConfirm={performDeleteContribution}
        onCancel={() => setPendingDeleteContribution(null)}
      />

      <ConfirmDialog
        visible={deleteGoalDialogOpen}
        title="Delete goal?"
        message={`"${goal.name}" and its contribution history will be removed. This cannot be undone.`}
        onConfirm={performDeleteGoal}
        onCancel={() => setDeleteGoalDialogOpen(false)}
      />
    </View>
  );
}
