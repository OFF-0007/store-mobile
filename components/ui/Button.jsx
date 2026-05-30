/**
 * Button – primary, secondary, danger, and ghost variants styled for light mode.
 */
import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

const variantClasses = {
  primary: {
    container: "bg-primary-600 active:bg-primary-700",
    text: "text-white font-semibold",
  },
  secondary: {
    container: "bg-accent active:bg-accent-dark",
    text: "text-white font-semibold",
  },
  danger: {
    container: "bg-danger active:bg-red-600",
    text: "text-white font-semibold",
  },
  ghost: {
    container: "border border-slate-200 active:bg-slate-50 bg-white",
    text: "text-slate-700 font-medium",
  },
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  fullWidth = false,
  disabled,
  className = "",
  ...props
}) {
  const { container, text } = variantClasses[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-xl px-6 py-3.5
        ${container}
        ${fullWidth ? "w-full" : ""}
        ${isDisabled ? "opacity-50" : ""}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "ghost" ? "#334155" : "#fff"} />
      ) : (
        <Text className={`text-base ${text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
