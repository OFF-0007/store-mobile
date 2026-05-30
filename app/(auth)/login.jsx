/**
 * Login screen – light-themed modern design with email/password form.
 * Calls the Laravel /api/login endpoint via the auth store.
 */
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/authStore";
import { Button, GlassCard, Input } from "@/components/ui";

export default function LoginScreen() {
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    const next = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Enter a valid email.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Minimum 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!validate()) return;
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      Alert.alert(
        "Login Failed",
        err?.message ?? "Please check your credentials and try again."
      );
    }
  }

  return (
    <LinearGradient
      colors={["#f8fafc", "#eff6ff", "#f8fafc"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo / Brand ─────────────────────────────────────────────── */}
          <View className="mb-10 items-center">
            <View className="mb-6 h-20 w-20 items-center justify-center rounded-3xl bg-primary-100/60 border border-primary-200">
              <Text className="text-4xl">🏪</Text>
            </View>
            <Text className="text-3xl font-black text-slate-800 tracking-tight">
              StoreManage
            </Text>
            <Text className="mt-1 text-slate-500 text-sm">
              ERP & POS Mobile Companion
            </Text>
          </View>

          {/* ── Glass card form ───────────────────────────────────────────── */}
          <GlassCard className="border-slate-100 bg-white shadow-md">
            <Text className="mb-6 text-xl font-bold text-slate-800">
              Sign in to your account
            </Text>

            <Input
              label="Email address"
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              leftIcon={<Text className="text-slate-400">✉️</Text>}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              error={errors.password}
              leftIcon={<Text className="text-slate-400">🔒</Text>}
              rightIcon={
                <Text className="text-slate-500 text-sm font-semibold">
                  {showPassword ? "Hide" : "Show"}
                </Text>
              }
              onRightIconPress={() => setShowPassword((v) => !v)}
            />

            <Button
              label="Sign In"
              loading={isLoading}
              fullWidth
              onPress={handleLogin}
              className="mt-2"
            />
          </GlassCard>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <View className="mt-8 items-center">
            <Text className="text-slate-400 text-xs">
              Powered by{" "}
              <Text className="text-primary-600 font-semibold">Fillosoft</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
