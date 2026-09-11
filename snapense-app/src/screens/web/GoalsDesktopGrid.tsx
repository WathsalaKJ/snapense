/**
 * Desktop-web goals layout: a multi-column card grid instead of the mobile
 * swipe-to-delete list (a mouse has no swipe gesture, so delete becomes a
 * hover-revealed button instead) - same treatment as BudgetsDesktopGrid.
 * Rendered by GoalsScreen only when useIsDesktopWeb() is true; the mobile
 * JSX there is untouched.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { SavingsGoal } from '../../api/types';
import { useTheme } from '../../context/ThemeContext';
import { ProgressBar, formatCurrency } from '../../components';
import { CompleteBadge, GoalIcon, goalColor } from '../GoalsScreen';
import { accent, dangerAlpha, fontSize, fontWeight } from '../../theme';
import { webFonts, webRadii, webShadow, webSpacing } from '../../theme/web';

function GoalCard({
  goal,
  onOpen,
  onDelete,
}: {
  goal: SavingsGoal;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
  const color = goalColor(goal);

  return (
    <Pressable onPress={onOpen} style={{ flexBasis: '31%', flexGrow: 0, minWidth: 240 }}>
      {({ hovered }: any) => (
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: hovered ? colors.line2 : colors.line,
            borderRadius: webRadii.card,
            padding: webSpacing.md,
            gap: webSpacing.sm,
            ...({ boxShadow: hovered ? webShadow.card : 'none' } as object),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                backgroundColor: `${color}24`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GoalIcon color={color} size={19} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.text,
                  fontSize: fontSize.baseLg,
                  fontWeight: fontWeight.semibold,
                  fontFamily: webFonts.body,
                }}
              >
                {goal.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.caption, fontFamily: webFonts.body }}>
                {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
              </Text>
            </View>

            {hovered ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                hitSlop={6}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  backgroundColor: dangerAlpha(0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: accent.danger, fontSize: 13, fontWeight: '700' }}>✕</Text>
              </Pressable>
            ) : goal.is_complete ? (
              <CompleteBadge />
            ) : (
              <Text style={{ color, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
                {Math.round(goal.percent_complete)}%
              </Text>
            )}
          </View>

          <ProgressBar ratio={ratio} color={color} />

          <Text style={{ color: colors.muted2, fontSize: fontSize.caption, fontFamily: webFonts.body }}>
            {formatCurrency(goal.auto_saved_amount)} auto + {formatCurrency(goal.manual_amount)} manual
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function GoalsDesktopGrid({
  goals,
  onOpen,
  onAddNew,
  onDelete,
}: {
  goals: SavingsGoal[];
  onOpen: (goal: SavingsGoal) => void;
  onAddNew: () => void;
  onDelete: (goal: SavingsGoal) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: webSpacing.xl, paddingBottom: webSpacing.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
            Goals
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 4, fontFamily: webFonts.body }}>
            Savings targets, funded automatically and by hand
          </Text>
        </View>

        <Pressable onPress={onAddNew} style={{ marginTop: 10 }}>
          {({ hovered }: any) => (
            <Text
              style={{
                color: hovered ? accent.tealBright : accent.teal,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                fontFamily: webFonts.body,
              }}
            >
              + New goal
            </Text>
          )}
        </Pressable>
      </View>

      {goals.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing.md }}>
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onOpen={() => onOpen(goal)}
              onDelete={() => onDelete(goal)}
            />
          ))}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: webRadii.card,
            padding: webSpacing.lg,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.baseLg, fontWeight: fontWeight.bold, fontFamily: webFonts.body }}>
            No goals yet
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19, fontFamily: webFonts.body }}>
            Create a savings goal and watch it fill up from budget under-spend and whatever you add by hand.
          </Text>
        </View>
      )}
    </View>
  );
}
