import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../context/ThemeContext';
import { PrimaryButton } from '../components';
import { CaptureIcon } from '../components/icons';
import { accent, fontSize, fontWeight, spacing, tealAlpha } from '../theme';
import type { AppStackParamList } from '../navigation/types';

/** Guide-frame geometry, straight from the design's corner-bracket block. */
const FRAME_WIDTH = 262;
const FRAME_HEIGHT = 398;
const BRACKET = 36;
const BRACKET_WIDTH = 3;

const SHUTTER_OUTER = 78;
const SHUTTER_INNER = 62;

function FlashIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={18} viewBox="0 0 14 18">
      <Path d="M8.5 1L2 10.5h4L5.5 17 12 7.5H8L8.5 1z" fill={color} />
    </Svg>
  );
}

function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x={1} y={1} width={14} height={14} rx={3} stroke={color} strokeWidth={1.6} />
      <Circle cx={5.5} cy={5.5} r={1.6} fill={color} />
      <Path
        d="M1 11.5L5.5 8l4 3.5L12 9.5l3 2.5"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** One corner of the alignment frame. */
function Corner({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = corner === 'tl' || corner === 'tr';
  const isLeft = corner === 'tl' || corner === 'bl';

  return (
    <View
      style={{
        position: 'absolute',
        width: BRACKET,
        height: BRACKET,
        ...(isTop ? { top: 0 } : { bottom: 0 }),
        ...(isLeft ? { left: 0 } : { right: 0 }),
        ...(isTop
          ? { borderTopWidth: BRACKET_WIDTH, borderTopColor: accent.teal }
          : { borderBottomWidth: BRACKET_WIDTH, borderBottomColor: accent.teal }),
        ...(isLeft
          ? { borderLeftWidth: BRACKET_WIDTH, borderLeftColor: accent.teal }
          : { borderRightWidth: BRACKET_WIDTH, borderRightColor: accent.teal }),
        borderTopLeftRadius: corner === 'tl' ? 10 : 0,
        borderTopRightRadius: corner === 'tr' ? 10 : 0,
        borderBottomLeftRadius: corner === 'bl' ? 10 : 0,
        borderBottomRightRadius: corner === 'br' ? 10 : 0,
      }}
    />
  );
}

export default function CaptureScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goScan = (uri: string) => navigation.navigate('Scanning', { imageUri: uri });

  const snap = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) goScan(photo.uri);
    } catch {
      setError('Could not take the photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickFromGallery = async () => {
    setError(null);
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!media.granted) {
      setError('Photo access is needed to pick a receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) goScan(result.assets[0].uri);
  };

  // Permission is still resolving on first mount.
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#0D1320' }} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: spacing.xxl,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              backgroundColor: tealAlpha(0.12),
              borderWidth: 1,
              borderColor: tealAlpha(0.3),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CaptureIcon color={accent.teal} size={40} />
          </View>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.title,
              fontWeight: fontWeight.bold,
              textAlign: 'center',
            }}
          >
            Camera access needed
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: fontSize.body, textAlign: 'center' }}
          >
            Snapense uses the camera to scan receipts. You can also pick an existing
            photo instead.
          </Text>
          <PrimaryButton
            label="Allow camera"
            onPress={requestPermission}
            style={{ alignSelf: 'stretch' }}
          />
          <Pressable onPress={pickFromGallery}>
            <Text style={{ color: accent.teal, fontSize: fontSize.body }}>
              Choose from library
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const flashOn = flash === 'on';

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1320' }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
      />

      {/* Alignment frame, centred at 46% of the height as in the design. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: 'absolute',
            top: '46%',
            left: '50%',
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            marginLeft: -FRAME_WIDTH / 2,
            marginTop: -FRAME_HEIGHT / 2,
          }}
        >
          <Corner corner="tl" />
          <Corner corner="tr" />
          <Corner corner="bl" />
          <Corner corner="br" />

          <View
            style={{
              position: 'absolute',
              top: -44,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                backgroundColor: 'rgba(17,24,39,0.72)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 100,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: accent.success,
                }}
              />
              <Text style={{ color: '#F9FAFB', fontSize: 12, fontWeight: '500' }}>
                Line up the receipt
              </Text>
            </View>
          </View>
        </View>
      </View>

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top controls: flash and gallery. */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <Pressable
            onPress={() => setFlash(flashOn ? 'off' : 'on')}
            accessibilityRole="button"
            accessibilityLabel={flashOn ? 'Turn flash off' : 'Turn flash on'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: flashOn ? tealAlpha(0.9) : 'rgba(17,24,39,0.6)',
              borderWidth: 1,
              borderColor: flashOn ? accent.teal : 'rgba(255,255,255,0.08)',
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 100,
            }}
          >
            <FlashIcon color={flashOn ? '#0B1120' : '#F9FAFB'} />
            <Text
              style={{
                color: flashOn ? '#0B1120' : '#F9FAFB',
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {flashOn ? 'Flash on' : 'Flash off'}
            </Text>
          </Pressable>

          <Pressable
            onPress={pickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choose a receipt from your gallery"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: 'rgba(17,24,39,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 100,
            }}
          >
            <GalleryIcon color="#F9FAFB" />
            <Text style={{ color: '#F9FAFB', fontSize: 12, fontWeight: '600' }}>
              Gallery
            </Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* Shutter. */}
        <View style={{ alignItems: 'center', gap: 16, paddingBottom: 24 }}>
          {error ? (
            <Text style={{ color: accent.danger, fontSize: fontSize.small }}>{error}</Text>
          ) : (
            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '500' }}>
              Snap it — we'll do the typing
            </Text>
          )}

          <Pressable
            onPress={snap}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => ({
              width: SHUTTER_OUTER,
              height: SHUTTER_OUTER,
              borderRadius: SHUTTER_OUTER / 2,
              borderWidth: 4,
              borderColor: pressed ? tealAlpha(0.7) : tealAlpha(0.35),
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.93 : 1 }],
              opacity: busy ? 0.6 : 1,
            })}
          >
            <View
              style={{
                width: SHUTTER_INNER,
                height: SHUTTER_INNER,
                borderRadius: SHUTTER_INNER / 2,
                backgroundColor: accent.teal,
                alignItems: 'center',
                justifyContent: 'center',
                ...Platform.select({
                  ios: {
                    shadowColor: accent.teal,
                    shadowOpacity: 0.45,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  },
                  android: { elevation: 10 },
                  default: {},
                }),
              }}
            >
              <CaptureIcon color="#0B1120" size={26} />
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
