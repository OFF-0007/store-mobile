import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

export function SkeletonLoader({ height, width, className, style }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          height: height || 20,
          width: width || "100%",
          backgroundColor: "#e2e8f0",
          opacity: pulseAnim,
        },
        style,
      ]}
      className={className}
    />
  );
}

export function CardSkeleton() {
  return (
    <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-sm gap-3">
      <View className="flex-row items-center gap-3">
        <SkeletonLoader height={40} width={40} className="rounded-xl" />
        <View className="flex-1 gap-2">
          <SkeletonLoader height={14} width="60%" className="rounded" />
          <SkeletonLoader height={10} width="40%" className="rounded" />
        </View>
      </View>
      <View className="border-t border-slate-100 pt-3 gap-2">
        <SkeletonLoader height={10} width="80%" className="rounded" />
        <SkeletonLoader height={10} width="90%" className="rounded" />
      </View>
    </View>
  );
}
