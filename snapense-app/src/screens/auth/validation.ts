/**
 * Form validation shared by the auth screens.
 *
 * Rules mirror what the backend enforces in routes/auth_routes.py, so the user
 * gets the error inline instead of a round trip: a valid-looking email, and a
 * password of at least 8 characters.
 */

/** Same shape the backend's EMAIL_RE accepts. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

/** MIN_PASSWORD_LENGTH in routes/auth_routes.py. */
export const MIN_PASSWORD_LENGTH = 8;

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_RE.test(trimmed)) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

/** Login only checks presence - length rules belong to registration. */
export function validateLoginPassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  return undefined;
}

export function validateFullName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Name is required.';
  if (trimmed.length < 2) return 'Enter your full name.';
  return undefined;
}

export function validateConfirmPassword(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return 'Confirm your password.';
  if (password !== confirmation) return 'Passwords do not match.';
  return undefined;
}

export type LoginFields = 'email' | 'password';
export type RegisterFields = 'fullName' | 'email' | 'password' | 'confirmPassword';

export function validateLoginForm(values: {
  email: string;
  password: string;
}): FieldErrors<LoginFields> {
  const errors: FieldErrors<LoginFields> = {};
  const email = validateEmail(values.email);
  const password = validateLoginPassword(values.password);
  if (email) errors.email = email;
  if (password) errors.password = password;
  return errors;
}

export function validateRegisterForm(values: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors<RegisterFields> {
  const errors: FieldErrors<RegisterFields> = {};
  const fullName = validateFullName(values.fullName);
  const email = validateEmail(values.email);
  const password = validatePassword(values.password);
  const confirmPassword = validateConfirmPassword(
    values.password,
    values.confirmPassword,
  );
  if (fullName) errors.fullName = fullName;
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (confirmPassword) errors.confirmPassword = confirmPassword;
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
