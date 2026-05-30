import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

export function LoadingScreen({ message = "Loading…" }) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-4 text-slate-500 text-sm">{message}</Text>
    </View>
  );
}
