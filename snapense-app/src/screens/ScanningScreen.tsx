import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { receiptsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { accent, fontSize, fontWeight, spacing } from '../theme';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Scanning'>;

const SHEET_WIDTH = 224;
const SHEET_HEIGHT = 368;

/** Three dots pulsing in sequence, as in the design's pulsedot animation. */
function PulsingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 7, marginTop: 6 }}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: accent.teal,
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

export default function ScanningScreen({ route, navigation }: Props) {
  const { imageUri } = route.params;
  const [error, setError] = useState<string | null>(null);
  const scan = useRef(new Animated.Value(0)).current;

  // Sweeping scan line over the captured image.
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scan]);

  // Upload once, on mount. `replace` keeps Scanning out of the back stack, so
  // the hardware back button from Review returns to Capture, not here.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await receiptsApi.upload(imageUri);
        if (cancelled) return;
        navigation.replace('ReceiptReview', {
          transactionId: response.transaction.id,
          needsReview: response.needs_review,
        });
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not read that receipt.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUri, navigation]);

  const translateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SHEET_HEIGHT - 3],
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0D1320',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        padding: 24,
      }}
    >
      <View
        style={{
          width: SHEET_WIDTH,
          height: SHEET_HEIGHT,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#F4F5F6',
          transform: [{ rotate: '-1deg' }],
        }}
      >
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

        {!error ? (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 3,
              backgroundColor: accent.teal,
              opacity: 0.9,
              transform: [{ translateY }],
            }}
          />
        ) : null}
      </View>

      {error ? (
        <View style={{ alignItems: 'center', gap: spacing.lg, maxWidth: 300 }}>
          <Text
            style={{ color: '#F9FAFB', fontSize: 18, fontWeight: fontWeight.bold }}
          >
            Could not read it
          </Text>
          <Text
            style={{ color: '#9CA3AF', fontSize: fontSize.body, textAlign: 'center' }}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              marginTop: spacing.md,
              backgroundColor: accent.teal,
              paddingHorizontal: 24,
              paddingVertical: 13,
              borderRadius: 100,
            }}
          >
            <Text style={{ color: '#0B1120', fontWeight: fontWeight.semibold }}>
              Try another photo
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#F9FAFB', fontSize: 18, fontWeight: fontWeight.bold }}>
            Reading your receipt…
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: fontSize.body }}>
            Extracting merchant, items and totals
          </Text>
          <PulsingDots />
        </View>
      )}
    </View>
  );
}
