/**
 * Cross-platform confirmation dialog - a themed replacement for
 * `Alert.alert(...)`, which on this project's web build silently does
 * nothing: react-native-web's Alert module is a no-op stub
 * (`static alert() {}`), so any screen that used it for a destructive
 * confirmation (delete transaction, delete budget, etc.) appeared to just
 * not respond at all when tapped on web. `Modal`, unlike `Alert`, has a real
 * react-native-web implementation, so it's the basis here instead.
 *
 * Usage matches BudgetsScreen's existing modal-state convention: the caller
 * holds the "what am I about to delete" state (visible / null) and renders
 * one `<ConfirmDialog>` wired to it, rather than this component managing
 * a queue or a global singleton.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { accent, dangerAlpha, fontSize, fontWeight, radii, spacing } from '../theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,10,18,0.62)' }]}
        accessibilityLabel={`Close ${title} dialog`}
      />

      <View
        pointerEvents="box-none"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: radii.sheet,
            padding: 22,
            gap: spacing.lg,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
              {title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body, lineHeight: 19 }}>
              {message}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: radii.chip,
                backgroundColor: pressed ? colors.softer : colors.soft,
                borderWidth: 1,
                borderColor: colors.line,
              })}
            >
              <Text style={{ color: colors.text2, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: radii.chip,
                backgroundColor: pressed ? dangerAlpha(0.28) : dangerAlpha(0.16),
                borderWidth: 1,
                borderColor: dangerAlpha(0.5),
              })}
            >
              <Text style={{ color: accent.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
