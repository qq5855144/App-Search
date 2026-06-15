import React from 'react';
import { View, Text } from 'react-native';

const COLORS = ['#1677FF', '#00B96B', '#FF4D4F', '#FA8C16', '#722ED1', '#EB2F96'];

function getLetter(name: string): string {
  const char = name.trim().charAt(0).toUpperCase();
  return /[A-Za-z0-9\u4e00-\u9fa5]/.test(char) ? char : '?';
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface LetterAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export default function LetterAvatar({ name, size = 48, className = '' }: LetterAvatarProps) {
  const letter = getLetter(name);
  const color = getColor(name);
  const fontSize = size * 0.45;

  return (
    <View
      className={`items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size * 0.24,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize, fontWeight: '700' }}>{letter}</Text>
    </View>
  );
}
