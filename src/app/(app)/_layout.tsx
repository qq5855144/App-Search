import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="detail" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="downloads" />
      <Stack.Screen name="search-history" />
    </Stack>
  );
}
