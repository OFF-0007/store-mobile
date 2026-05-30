/**
 * GlassCard – structured card for light mode theme.
 */
import React from "react";
import { View } from "react-native";

export function GlassCard({ children, className = "", style, ...props }) {
  return (
    <View
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${className}`}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}
