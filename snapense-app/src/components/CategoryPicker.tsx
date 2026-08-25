/**
 * Bottom-sheet category picker: a 2-column grid of every category, matching
 * the design's picker sheet (22px top radius, grab handle, tick on current).
 */

import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../context/ThemeContext';
import type { Category } from '../api/types';
import { accent, fontSize, fontWeight, radii, resolveCategoryColor, spacing } from '../theme';

function Tick() {
  return (
    <Svg width={13} height={10} viewBox="0 0 15 12" style={{ marginLeft: 'auto' }}>
      <Path
        d="M1 6.5L5 10.5 14 1.5"
        stroke={accent.teal}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function CategoryPicker({
  visible,
  categories,
  currentCategoryId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  categories: Category[];
  currentCategoryId?: number | null;
  onSelect: (category: Category) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(6,10,18,0.62)' }}
        accessibilityLabel="Close category picker"
      />

      <View
        style={{
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: colors.line,
          borderTopLeftRadius: radii.sheet,
          borderTopRightRadius: radii.sheet,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 44,
        }}
      >
        <View
          style={{
            width: 38,
            height: 4,
            borderRadius: 100,
            backgroundColor: colors.softer,
            alignSelf: 'center',
            marginBottom: 16,
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
            }}
          >
            Choose category
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

        <ScrollView style={{ maxHeight: 320 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 9,
            }}
          >
            {categories.map((category) => {
              const tone = resolveCategoryColor(category.name, category.color_hex);
              const isCurrent = category.id === currentCategoryId;

              return (
                <Pressable
                  key={category.id}
                  onPress={() => onSelect(category)}
                  style={{
                    // Two per row, accounting for the 9px gap.
                    width: '48%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: 13,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: isCurrent ? `${tone}1F` : colors.soft,
                    borderWidth: 1,
                    borderColor: isCurrent ? `${tone}3D` : colors.line,
                  }}
                >
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      backgroundColor: tone,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.text,
                      fontSize: 13.5,
                      fontWeight: fontWeight.semibold,
                      flexShrink: 1,
                    }}
                  >
                    {category.name}
                  </Text>
                  {isCurrent ? <Tick /> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
