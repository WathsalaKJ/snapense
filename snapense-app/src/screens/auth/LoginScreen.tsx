import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { errorMessage } from '../../api/client';
import { ErrorNote, PrimaryButton } from '../../components';
import { CaptureIcon } from '../../components/icons';
import { accent, fontSize, fontWeight, spacing, tealAlpha } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

import AuthField from './AuthField';
import {
  hasErrors,
  validateEmail,
  validateLoginForm,
  validateLoginPassword,
  type FieldErrors,
  type LoginFields,
} from './validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<LoginFields>>({});
  const [touched, setTouched] = useState<Record<LoginFields, boolean>>({
    email: false,
    password: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Re-validate a field once it has been blurred, so errors clear as you fix them. */
  const revalidate = (field: LoginFields, value: string) => {
    if (!touched[field]) return;
    const message =
      field === 'email' ? validateEmail(value) : validateLoginPassword(value);
    setErrors((current) => ({ ...current, [field]: message }));
  };

  const blur = (field: LoginFields, value: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
    const message =
      field === 'email' ? validateEmail(value) : validateLoginPassword(value);
    setErrors((current) => ({ ...current, [field]: message }));
  };

  const submit = async () => {
    setFormError(null);

    const nextErrors = validateLoginForm({ email, password });
    setErrors(nextErrors);
    setTouched({ email: true, password: true });
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      // On success the root navigator swaps to the app stack on its own.
    } catch (error) {
      setFormError(errorMessage(error, 'Could not sign you in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
            gap: 28,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: tealAlpha(0.12),
                borderWidth: 1,
                borderColor: tealAlpha(0.3),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CaptureIcon color={accent.teal} size={32} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.display,
                fontWeight: fontWeight.bold,
              }}
            >
              Welcome back
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
              Sign in to keep your spending honest.
            </Text>
          </View>

          <View style={{ gap: spacing.xl }}>
            <AuthField
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                revalidate('email', value);
              }}
              onBlur={() => blur('email', email)}
              error={errors.email}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <AuthField
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                revalidate('password', value);
              }}
              onBlur={() => blur('password', password)}
              error={errors.password}
              placeholder="Your password"
              isPassword
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <ErrorNote message={formError} />

            <PrimaryButton label="Sign in" onPress={submit} loading={busy} />

            <Pressable
              onPress={() => navigation.navigate('Register')}
              style={{ alignItems: 'center', paddingVertical: spacing.md }}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
                New here?{' '}
                <Text style={{ color: accent.teal, fontWeight: fontWeight.semibold }}>
                  Create an account
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
