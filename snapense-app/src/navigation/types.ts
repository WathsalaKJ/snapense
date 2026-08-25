import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};

/** Order matches the design's tab bar: Transactions, Capture, Dashboard, Profile. */
export type TabParamList = {
  Transactions: undefined;
  Capture: undefined;
  Dashboard: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Scanning: { imageUri: string };
  TransactionDetail: { transactionId: number; startInEdit?: boolean };
  ReceiptReview: { transactionId: number; needsReview: boolean };
};

export type RootStackParamList = AuthStackParamList & AppStackParamList;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
