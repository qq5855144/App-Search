import React from 'react';
import { View, Text } from 'react-native';

const PLATFORM_COLORS: Record<string, string> = {
  Android: '#3DDC84',
  iOS: '#007AFF',
  macOS: '#999999',
  Windows: '#00A4EF',
  Linux: '#FCC624',
};

const PLATFORM_LABELS: Record<string, string> = {
  Android: 'Android',
  iOS: 'iOS',
  macOS: 'macOS',
  Windows: 'Windows',
  Linux: 'Linux',
};

interface PlatformTagProps {
  platform: string;
  className?: string;
}

export default function PlatformTag({ platform, className = '' }: PlatformTagProps) {
  const color = PLATFORM_COLORS[platform] || '#666666';
  const label = PLATFORM_LABELS[platform] || platform;

  return (
    <View
      className={`px-2 py-0.5 rounded-full ${className}`}
      style={{ backgroundColor: `${color}20` }}
    >
      <Text className="text-xs font-medium" style={{ color }}>{label}</Text>
    </View>
  );
}
