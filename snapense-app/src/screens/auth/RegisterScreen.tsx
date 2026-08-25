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
import { accent, fontSize, fontWeight, spacing, tealAlpha } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

import AuthField from './AuthField';
import {
  MIN_PASSWORD_LENGTH,
  hasErrors,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
  validateRegisterForm,
  type FieldErrors,
  type RegisterFields,
} from './validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Cheap strength read-out so the 8-character rule does not feel arbitrary. */
function passwordStrength(password: string): { label: string; ratio: number; color: string } {
  if (!password) return { label: '', ratio: 0, color: accent.danger };

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: 'Weak', ratio: 0.25, color: accent.danger };
  if (score === 2) return { label: 'Fair', ratio: 0.5, color: accent.warning };
  if (score === 3) return { label: 'Good', ratio: 0.75, color: accent.teal };
  return { label: 'Strong', ratio: 1, color: accent.success };
}

export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<RegisterFields>>({});
  const [touched, setTouched] = useState<Record<RegisterFields, boolean>>({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validateField = (
    field: RegisterFields,
    value: string,
    currentPassword = password,
  ): string | undefined => {
    switch (field) {
      case 'fullName':
        return validateFullName(value);
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'confirmPassword':
        return validateConfirmPassword(currentPassword, value);
    }
  };

  const revalidate = (field: RegisterFields, value: string, currentPassword?: string) => {
    if (!touched[field]) return;
    setErrors((current) => ({
      ...current,
      [field]: validateField(field, value, currentPassword),
    }));
  };

  const blur = (field: RegisterFields, value: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validateField(field, value) }));
  };

  const submit = async () => {
    setFormError(null);

    const nextErrors = validateRegisterForm({
      fullName,
      email,
      password,
      confirmPassword,
    });
    setErrors(nextErrors);
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    try {
      await register(email.trim(), password, fullName.trim());
    } catch (error) {
      setFormError(errorMessage(error, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  const strength = passwordStrength(password);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 26 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                backgroundColor: tealAlpha(0.12),
                borderWidth: 1,
                borderColor: tealAlpha(0.3),
              }}
            />
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.display,
                fontWeight: fontWeight.bold,
              }}
            >
              Create account
            </Text>
            <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
              Start scanning receipts in seconds.
            </Text>
          </View>

          <View style={{ gap: spacing.xl }}>
            <AuthField
              label="Full name"
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                revalidate('fullName', value);
              }}
              onBlur={() => blur('fullName', fullName)}
              error={errors.fullName}
              placeholder="Ada Lovelace"
              autoCapitalize="words"
              textContentType="name"
            />

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
            />

            <View style={{ gap: spacing.sm }}>
              <AuthField
                label="Password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  revalidate('password', value);
                  // The confirmation depends on this field, so re-check it too.
                  revalidate('confirmPassword', confirmPassword, value);
                }}
                onBlur={() => blur('password', password)}
                error={errors.password}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                isPassword
                autoCapitalize="none"
                textContentType="newPassword"
              />

              {password ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.soft,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${strength.ratio * 100}%`,
                        height: '100%',
                        borderRadius: 2,
                        backgroundColor: strength.color,
                      }}
                    />
                  </View>
                  <Text style={{ color: strength.color, fontSize: fontSize.caption }}>
                    {strength.label}
                  </Text>
                </View>
              ) : null}
            </View>

            <AuthField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                revalidate('confirmPassword', value);
              }}
              onBlur={() => blur('confirmPassword', confirmPassword)}
              error={errors.confirmPassword}
              placeholder="Repeat your password"
              isPassword
              autoCapitalize="none"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <ErrorNote message={formError} />

            <PrimaryButton label="Create account" onPress={submit} loading={busy} />

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={{ alignItems: 'center', paddingVertical: spacing.md }}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.muted, fontSize: fontSize.body }}>
                Already have an account?{' '}
                <Text style={{ color: accent.teal, fontWeight: fontWeight.semibold }}>
                  Sign in
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
