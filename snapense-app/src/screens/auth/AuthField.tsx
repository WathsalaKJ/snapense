/** Labelled input with inline validation state, styled from the design tokens. */

import React, { useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { EyeIcon, EyeOffIcon } from '../../components/icons';
import { accent, fontSize, fontWeight, radii, spacing } from '../../theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Renders a show/hide toggle and starts masked. */
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export default function AuthField({
  label,
  error,
  isPassword,
  containerStyle,
  ...props
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? accent.danger : focused ? accent.teal : colors.line;

  return (
    <View style={[{ gap: spacing.sm }, containerStyle]}>
      <Text
        style={{
          color: colors.muted,
          fontSize: fontSize.small,
          fontWeight: fontWeight.medium,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.soft,
          borderRadius: radii.input,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: spacing.xl,
        }}
      >
        <TextInput
          placeholderTextColor={colors.faint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword && !revealed}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: fontSize.base,
            paddingVertical: 13,
          }}
          {...props}
        />

        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((current) => !current)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? (
              <EyeOffIcon color={colors.muted} />
            ) : (
              <EyeIcon color={colors.muted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={{ color: accent.danger, fontSize: fontSize.caption }}>{error}</Text>
      ) : null}
    </View>
  );
}
