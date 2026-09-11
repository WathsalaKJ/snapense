/**
 * Bottom-sheet create/edit form for a SavingsGoal - styled after
 * BudgetsScreen's BudgetModal (same drag handle, wide-web centered-dialog
 * fallback, Field + PrimaryButton layout). Shared between GoalsScreen
 * (create) and GoalDetailScreen (edit), which is why this lives in its own
 * file instead of staying local to one screen the way BudgetModal does.
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SavingsGoal } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { Field, PrimaryButton } from '../components';
import { accent, fontSize, fontWeight, radii } from '../theme';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface GoalFormValues {
  name: string;
  target_amount: number;
  target_date: string | null;
}

export default function GoalFormModal({
  visible,
  goal,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** null means "create a new goal"; otherwise the goal being edited. */
  goal: SavingsGoal | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: GoalFormValues) => void;
}) {
  const { colors } = useTheme();
  const { isWideWeb } = useResponsive();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setAmount(goal ? String(goal.target_amount) : '');
    setTargetDate(goal?.target_date ?? '');
  }, [visible, goal]);

  const amountValue = Number(amount);
  const isNameValid = name.trim() !== '';
  const isAmountValid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0;
  const isDateValid = targetDate.trim() === '' || ISO_DATE.test(targetDate.trim());
  const isValid = isNameValid && isAmountValid && isDateValid;

  const submit = () => {
    if (!isValid) return;
    onSubmit({
      name: name.trim(),
      target_amount: amountValue,
      target_date: targetDate.trim() === '' ? null : targetDate.trim(),
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
        accessibilityLabel="Close goal editor"
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
              style={{
                flex: 1,
                color: colors.text,
                fontSize: fontSize.xl,
                fontWeight: fontWeight.bold,
              }}
            >
              {goal ? 'Edit goal' : 'New savings goal'}
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
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Emergency fund"
            autoFocus
          />

          <Field
            label="Target amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Field
            label="Target date (optional)"
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          {targetDate.trim() !== '' && !isDateValid ? (
            <Text style={{ color: accent.danger, fontSize: fontSize.small, marginTop: -10 }}>
              Enter the date as YYYY-MM-DD.
            </Text>
          ) : null}

          <PrimaryButton
            label={goal ? 'Save changes' : 'Create goal'}
            onPress={submit}
            disabled={!isValid}
            loading={submitting}
          />
        </View>
      </View>
    </Modal>
  );
}
