/**
 * Desktop-web budgets layout: a multi-column card grid instead of the
 * mobile swipe-to-delete list (a mouse has no swipe gesture, so delete
 * becomes a hover-revealed button instead). Rendered by BudgetsScreen only
 * when useIsDesktopWeb() is true; the mobile JSX there is untouched.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Budget, Category } from '../../api/types';
import { useTheme } from '../../context/ThemeContext';
import { CategoryIcon, ProgressBar, formatCurrency } from '../../components';
import { accent, dangerAlpha, fontSize, fontWeight, tealAlpha } from '../../theme';
import { webFonts, webRadii, webShadow, webSpacing } from '../../theme/web';

/** Under 75% on-track, 75-100% warning, over 100% over budget - matches BudgetsScreen. */
function barColorFor(ratio: number): string {
  if (ratio > 1) return accent.danger;
  if (ratio >= 0.75) return accent.warning;
  return accent.success;
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const limit = budget.monthly_limit;
  const spent = budget.amount_spent_this_month;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? 1 : 0;
  const color = barColorFor(ratio);

  return (
    <Pressable onPress={onEdit} style={{ flexBasis: '31%', flexGrow: 0, minWidth: 220 }}>
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
            <CategoryIcon
              name={budget.category?.name}
              iconName={budget.category?.icon_name}
              colorHex={budget.category?.color_hex}
              size={36}
            />
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
                {budget.category?.name ?? 'Uncategorised'}
              </Text>
              <Text style={{ color: colors.muted, fontSize: fontSize.caption, fontFamily: webFonts.body }}>
                {formatCurrency(spent)} / {formatCurrency(limit)}
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
            ) : (
              <Text style={{ color, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
                {limit > 0 ? `${Math.round(ratio * 100)}%` : '—'}
              </Text>
            )}
          </View>

          <ProgressBar ratio={ratio} color={color} />
        </View>
      )}
    </Pressable>
  );
}

function AddBudgetCard({ category, onPress }: { category: Category; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={{ flexBasis: '31%', flexGrow: 0, minWidth: 220 }}>
      {({ hovered }: any) => (
        <View
          style={{
            backgroundColor: hovered ? tealAlpha(0.06) : colors.card,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: hovered ? tealAlpha(0.5) : colors.line2,
            borderRadius: webRadii.card,
            padding: webSpacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CategoryIcon
            name={category.name}
            iconName={category.icon_name}
            colorHex={category.color_hex}
            size={36}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.baseLg,
                fontWeight: fontWeight.semibold,
                fontFamily: webFonts.body,
              }}
            >
              {category.name}
            </Text>
            <Text style={{ color: accent.teal, fontSize: fontSize.caption, fontWeight: fontWeight.semibold }}>
              + Set limit
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
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
      {children}
    </Text>
  );
}

export default function BudgetsDesktopGrid({
  budgets,
  unbudgeted,
  onEdit,
  onAddNew,
  onDelete,
  onViewHistory,
}: {
  budgets: Budget[];
  unbudgeted: Category[];
  onEdit: (budget: Budget) => void;
  onAddNew: (category: Category) => void;
  onDelete: (budget: Budget) => void;
  onViewHistory: () => void;
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
            Budgets
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 4, fontFamily: webFonts.body }}>
            Monthly spending limits by category
          </Text>
        </View>

        <Pressable onPress={onViewHistory} style={{ marginTop: 10 }}>
          {({ hovered }: any) => (
            <Text
              style={{
                color: hovered ? accent.tealBright : accent.teal,
                fontSize: fontSize.small,
                fontWeight: fontWeight.semibold,
                fontFamily: webFonts.body,
              }}
            >
              View history →
            </Text>
          )}
        </Pressable>
      </View>

      {budgets.length > 0 ? (
        <View style={{ gap: webSpacing.md }}>
          <SectionLabel>Your budgets</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing.md }}>
            {budgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={() => onEdit(budget)}
                onDelete={() => onDelete(budget)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {unbudgeted.length > 0 ? (
        <View style={{ gap: webSpacing.md }}>
          <SectionLabel>Add a budget</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing.md }}>
            {unbudgeted.map((category) => (
              <AddBudgetCard key={category.id} category={category} onPress={() => onAddNew(category)} />
            ))}
          </View>
        </View>
      ) : null}

      {budgets.length === 0 && unbudgeted.length === 0 ? (
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
            No categories yet
          </Text>
          <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19, fontFamily: webFonts.body }}>
            Scan a few receipts first, then come back to set monthly spending limits.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
