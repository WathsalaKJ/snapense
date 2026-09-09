import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { budgetsApi, transactionsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Budget, Category } from '../api/types';
import { useTheme } from '../context/ThemeContext';
import { useIsDesktopWeb, useResponsive } from '../hooks/useResponsive';
import type { AppStackParamList } from '../navigation/types';
import {
  CategoryIcon,
  ErrorNote,
  Field,
  Loading,
  PrimaryButton,
  ProgressBar,
  WebContainer,
  formatCurrency,
} from '../components';
import BudgetsDesktopGrid from './web/BudgetsDesktopGrid';
import { webContentMaxWidth, webSpacing } from '../theme/web';
import { accent, dangerAlpha, fontSize, fontWeight, radii, spacing } from '../theme';

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

function HistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1a7 7 0 100 14A7 7 0 008 1z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path d="M8 4.5V8l2.5 1.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Uppercase eyebrow label, matching the Dashboard's "Insights" section header. */
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
        marginHorizontal: 4,
      }}
    >
      {children}
    </Text>
  );
}

/** Thresholds: under 75% success, 75-100% warning, over 100% danger. */
function barColorFor(ratio: number): string {
  if (ratio > 1) return accent.danger;
  if (ratio >= 0.75) return accent.warning;
  return accent.success;
}

function BudgetRow({
  budget,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);

  const limit = budget.monthly_limit;
  const spent = budget.amount_spent_this_month;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? 1 : 0;
  const color = barColorFor(ratio);

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
        onPress={onEdit}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.soft : colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 16,
          padding: 16,
          gap: 12,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CategoryIcon
            name={budget.category?.name}
            iconName={budget.category?.icon_name}
            colorHex={budget.category?.color_hex}
            size={38}
          />

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.baseLg,
                fontWeight: fontWeight.semibold,
              }}
            >
              {budget.category?.name ?? 'Uncategorised'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.small }}>
              {formatCurrency(spent)} / {formatCurrency(limit)}
            </Text>
          </View>

          <Text style={{ color, fontSize: fontSize.small, fontWeight: fontWeight.bold }}>
            {limit > 0 ? `${Math.round(ratio * 100)}%` : '—'}
          </Text>
        </View>

        <ProgressBar ratio={ratio} color={color} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** Bottom-sheet set/edit form, styled after CategoryPicker's sheet. */
function BudgetModal({
  visible,
  category,
  budget,
  submitting,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  category: Category | null;
  budget: Budget | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const { colors } = useTheme();
  const { isWideWeb } = useResponsive();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(budget ? String(budget.monthly_limit) : '');
  }, [visible, budget]);

  const amount = Number(value);
  const isValid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0;

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
        accessibilityLabel="Close budget editor"
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
          <CategoryIcon
            name={category?.name}
            iconName={category?.icon_name}
            colorHex={category?.color_hex}
            size={30}
          />
          <Text
            style={{
              flex: 1,
              color: colors.text,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
            }}
          >
            {budget ? `Edit ${category?.name ?? ''} budget` : `Set ${category?.name ?? ''} budget`}
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
          label="Monthly limit"
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          placeholder="0.00"
          autoFocus
        />

        <PrimaryButton
          label={budget ? 'Update budget' : 'Set budget'}
          onPress={() => isValid && onSubmit(amount)}
          disabled={!isValid}
          loading={submitting}
        />
      </View>
      </View>
    </Modal>
  );
}

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const viewHistory = () => navigation.navigate('BudgetHistory');

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [modalBudget, setModalBudget] = useState<Budget | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [budgetList, categoryList] = await Promise.all([
        budgetsApi.list(),
        transactionsApi.categories(),
      ]);
      setBudgets(budgetList);
      setCategories(categoryList);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your budgets.'));
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

  const openModal = (category: Category | null, budget: Budget | null) => {
    setModalCategory(category);
    setModalBudget(budget);
    setModalVisible(true);
  };

  const submitBudget = async (amount: number) => {
    if (!modalCategory) return;
    setSubmitting(true);
    try {
      const saved = await budgetsApi.upsert(modalCategory.id, amount);
      setBudgets((current) => {
        const others = current.filter((item) => item.category_id !== saved.category_id);
        return [...others, saved].sort((a, b) => a.id - b.id);
      });
      setModalVisible(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save that budget.'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (budget: Budget) => {
    Alert.alert(
      'Delete budget?',
      `The limit for ${budget.category?.name ?? 'this category'} will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic: drop it locally, restore on failure.
            const previous = budgets;
            setBudgets((current) => current.filter((item) => item.id !== budget.id));
            try {
              await budgetsApi.remove(budget.id);
            } catch (err) {
              setBudgets(previous);
              setError(errorMessage(err, 'Could not delete that budget.'));
            }
          },
        },
      ],
    );
  };

  if (loading) return <Loading label="Loading your budgets…" />;

  const unbudgeted = categories.filter(
    (category) => !budgets.some((budget) => budget.category_id === category.id),
  );

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
          <BudgetsDesktopGrid
            budgets={budgets}
            unbudgeted={unbudgeted}
            onEdit={(budget) => openModal(budget.category, budget)}
            onAddNew={(category) => openModal(category, null)}
            onDelete={confirmDelete}
            onViewHistory={viewHistory}
          />
        </ScrollView>

        <BudgetModal
          visible={modalVisible}
          category={modalCategory}
          budget={modalBudget}
          submitting={submitting}
          onClose={() => setModalVisible(false)}
          onSubmit={submitBudget}
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
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Budgets</Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, marginTop: 3 }}>
              Monthly spending limits by category
            </Text>
          </View>

          <Pressable
            onPress={viewHistory}
            accessibilityLabel="View budget history"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.soft,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <HistoryIcon color={colors.muted} />
          </Pressable>
        </View>

        <ErrorNote message={error} />

        {budgets.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Your budgets</SectionLabel>
            {budgets.map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                onEdit={() => openModal(budget.category, budget)}
                onDelete={() => confirmDelete(budget)}
              />
            ))}
          </View>
        ) : null}

        {unbudgeted.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Add a budget</SectionLabel>
            {unbudgeted.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => openModal(category, null)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.soft : colors.card,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.line2,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                })}
              >
                <CategoryIcon
                  name={category.name}
                  iconName={category.icon_name}
                  colorHex={category.color_hex}
                  size={30}
                />
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: fontSize.baseLg,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {category.name}
                </Text>
                <Text
                  style={{
                    color: accent.teal,
                    fontSize: fontSize.small,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  + Set limit
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {budgets.length === 0 && unbudgeted.length === 0 ? (
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
              style={{ color: colors.text, fontSize: 13.5, fontWeight: fontWeight.bold }}
            >
              No categories yet
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}>
              Scan a few receipts first, then come back to set monthly spending limits.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      </WebContainer>

      <BudgetModal
        visible={modalVisible}
        category={modalCategory}
        budget={modalBudget}
        submitting={submitting}
        onClose={() => setModalVisible(false)}
        onSubmit={submitBudget}
      />
    </SafeAreaView>
  );
}
