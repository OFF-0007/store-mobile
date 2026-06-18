/**
 * OTP Verification Screen – shown after self-registration.
 * User enters the 6-digit code sent to their email/phone.
 */
import React, { useState, useRef, useEffect } from "react";
import {
  Alert,
  Text,
  View,
  Animated,
  Easing,
  Pressable,
  TextInput,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import apiClient from "@/lib/api/client";

export default function VerifyOtpScreen() {
  const { verifyOtp, isLoading } = useAuthStore();
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef([]);

  // ── Animations ────────────────────────────────────────────────────────────
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(logoSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(blob1X, { toValue: 25, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob1Y, { toValue: -15, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(blob1X, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob1Y, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── OTP Input Handlers ────────────────────────────────────────────────────
  function handleOtpChange(text, index) {
    const newOtp = [...otp];
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 1) {
      // Handle paste
      const digits = cleaned.split("").slice(0, 6);
      const filled = [...newOtp];
      digits.forEach((d, i) => { if (index + i < 6) filled[index + i] = d; });
      setOtp(filled);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newOtp[index] = cleaned;
      setOtp(newOtp);
      if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
    }
    if (error) setError("");
  }

  function handleKeyPress(key, index) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleVerify() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    try {
      await verifyOtp(email, code);
      // authStore sets isAuthenticated → router will redirect automatically
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid or expired OTP. Please try again.");
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await apiClient.post("/forgot-password", { email });
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      setError("");
      inputRefs.current[0]?.focus();
      Alert.alert("OTP Resent", "A new OTP has been sent to your email.");
    } catch (err) {
      Alert.alert("Failed", "Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const handlePressIn = () => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();

  return (
    <LinearGradient colors={["#fffaf5", "#ffeae0", "#fffaf5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-1 relative overflow-hidden">
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <Animated.View style={{ transform: [{ translateX: blob1X }, { translateY: blob1Y }] }} className="absolute top-12 -right-16 w-52 h-52 rounded-full bg-orange-200/35" />
      <Animated.View className="absolute bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-100/40" />

      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <Animated.View style={{ opacity: logoFade, transform: [{ translateY: logoSlide }] }} className="mb-10 items-center">
          <View className="mb-4 relative items-center justify-center h-20 w-20">
            <Animated.View style={{ transform: [{ rotate: spin }] }} className="absolute inset-0 border-2 border-dashed border-orange-500/50 rounded-full" />
            <View className="absolute inset-3 bg-orange-100 items-center justify-center rounded-full">
              <Ionicons name="shield-checkmark-outline" size={28} color="#f97316" />
            </View>
          </View>
          <Text className="text-2xl font-extrabold text-slate-800 tracking-tight">Verify Your Account</Text>
          <Text className="mt-2 text-slate-500 text-sm font-medium text-center px-4">
            We sent a 6-digit code to{"\n"}
            <Text className="text-orange-600 font-bold">{email}</Text>
          </Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }} className="border border-white/60 bg-white/85 p-6 rounded-3xl shadow-xl shadow-orange-100/30">
          <Text className="text-slate-700 text-sm font-bold mb-5 text-center">Enter the 6-digit OTP</Text>

          {/* OTP Boxes */}
          <View className="flex-row justify-between mb-4">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="numeric"
                maxLength={1}
                className={`w-12 h-14 rounded-2xl text-center text-xl font-black border-2 bg-white ${
                  digit ? "border-orange-400 text-orange-600" : "border-slate-200 text-slate-800"
                } ${error ? "border-rose-300" : ""}`}
                style={{ fontSize: 22 }}
              />
            ))}
          </View>

          {error ? (
            <View className="flex-row items-center mb-3 bg-rose-50 rounded-xl px-3 py-2">
              <Ionicons name="alert-circle-outline" size={16} color="#f43f5e" />
              <Text className="text-rose-500 text-xs font-semibold ml-2 flex-1">{error}</Text>
            </View>
          ) : null}

          {/* Verify Button */}
          <Pressable onPress={handleVerify} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isLoading} className="mt-2 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/30">
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <LinearGradient colors={["#f97316", "#ea580c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-4 items-center justify-center flex-row gap-2">
                {isLoading ? (
                  <Text className="text-white text-base font-bold tracking-wide">Verifying...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text className="text-white text-base font-bold tracking-wide uppercase">Verify OTP</Text>
                  </>
                )}
              </LinearGradient>
            </Animated.View>
          </Pressable>

          {/* Resend */}
          <View className="mt-5 items-center">
            {countdown > 0 ? (
              <Text className="text-slate-400 text-xs font-medium">
                Resend OTP in <Text className="text-orange-500 font-bold">{countdown}s</Text>
              </Text>
            ) : (
              <Pressable onPress={handleResend} disabled={resending} className="p-2 active:opacity-60">
                <Text className="text-orange-600 text-sm font-bold">
                  {resending ? "Resending..." : "Resend OTP"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Back to Register */}
          <Pressable onPress={() => router.replace("/(auth)/register")} className="mt-3 items-center p-2 active:opacity-60">
            <Text className="text-slate-400 text-xs font-medium">← Back to Register</Text>
          </Pressable>
        </Animated.View>
      </View>

      <View className="absolute bottom-6 left-0 right-0 items-center">
        <Text className="text-slate-400 text-xs font-medium tracking-wide">Powered by <Text className="text-orange-600 font-bold">Fillosoft</Text></Text>
      </View>
    </LinearGradient>
  );
}
