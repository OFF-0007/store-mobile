/**
 * Input – light themed text input with label, error state, and icon support.
 */
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  className = "",
  ...props
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-slate-700">
          {label}
        </Text>
      ) : null}

      <View
        className={`
          flex-row items-center rounded-xl border px-4 py-3
          bg-slate-50
          ${focused ? "border-primary-500 bg-white" : "border-slate-200"}
          ${error ? "border-danger bg-red-50/20" : ""}
        `}
      >
        {leftIcon ? <View className="mr-3">{leftIcon}</View> : null}

        <TextInput
          className={`flex-1 text-base text-slate-800 ${className}`}
          placeholderTextColor="#94a3b8"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {rightIcon ? (
          <Pressable onPress={onRightIconPress} className="ml-3">
            {rightIcon}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1 text-xs text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
