/**
 * Forgot Password screen – matching the premium aesthetic of the auth flow.
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
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";

export default function ForgotPasswordScreen() {
  const { forgotPassword, isLoading } = useAuthStore();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});

  // ── Transition States ─────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const formOpacity = useRef(new Animated.Value(1)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;

  // ── Animation Values ──────────────────────────────────────────────────────
  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(20)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(35)).current;
  const footerFade = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.timing(formOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setIsSubmitting(true);
        Animated.timing(loaderOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    } else {
      Animated.timing(loaderOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setIsSubmitting(false);
        Animated.timing(formOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }
  }, [isLoading]);

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
      Animated.timing(footerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    let pulse;
    if (isSubmitting) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.88, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => pulse?.stop();
  }, [isSubmitting]);

  const handleEmailFocus = () => Animated.timing(emailFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const handleEmailBlur = () => Animated.timing(emailFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  const handlePressIn = () => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();

  function validate() {
    const next = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Enter a valid email.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;
    try {
      await forgotPassword(email.trim().toLowerCase());
      setIsSuccess(true);
    } catch (err) {
      Alert.alert(
        "Request Failed",
        err?.response?.data?.message || err?.message || "Please check your email and try again."
      );
    }
  }

  const emailBorderColor = emailFocus.interpolate({ inputRange: [0, 1], outputRange: ["#e2e8f0", "#f97316"] });
  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <LinearGradient colors={["#fffaf5", "#ffeae0", "#fffaf5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="flex-1 relative overflow-hidden">
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <Animated.View style={{ transform: [{ translateX: blob1X }, { translateY: blob1Y }] }} className="absolute top-12 -right-16 w-52 h-52 rounded-full bg-orange-200/35" />
      <Animated.View style={{ transform: [{ translateX: blob2X }, { translateY: blob2Y }] }} className="absolute bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-100/40" />

      <KeyboardAwareScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 64, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} enableOnAndroid={true} extraScrollHeight={120} extraHeight={120}>
        <Animated.View style={{ opacity: logoFade, transform: [{ translateY: logoSlide }] }} className="mb-8 items-center">
          <View className="mb-5 relative items-center justify-center h-24 w-24">
            <Animated.View style={{ transform: [{ rotate: spin }] }} className="absolute inset-0 border-2 border-dashed border-orange-500/50 rounded-full" />
            <View className="absolute inset-2 bg-orange-50 border border-orange-100 rounded-full shadow-sm" />
            <View className="absolute inset-3.5 items-center justify-center rounded-full bg-white shadow-md shadow-orange-500/30 overflow-hidden">
              <Image source={require("../../assets/icon.png")} style={{ width: '80%', height: '80%', resizeMode: 'contain' }} />
            </View>
          </View>
          <Text className="text-3xl font-extrabold text-slate-800 tracking-tight">StoreManage</Text>
          <Text className="mt-1.5 text-slate-500 text-sm font-medium tracking-wide">Account Recovery</Text>
        </Animated.View>

        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }} className={`rounded-3xl min-h-[300px] ${isSubmitting ? "bg-transparent border-transparent shadow-none" : "border border-white/60 bg-white/85 p-6 shadow-xl shadow-orange-100/30 backdrop-blur-md"}`}>
          {isSubmitting ? (
            <Animated.View style={{ opacity: loaderOpacity }} className="flex-1 items-center justify-center py-6">
              <View className="mb-4 items-center justify-center h-20 w-20 relative">
                <Animated.View style={{ transform: [{ rotate: spin }] }} className="absolute inset-0 border-4 border-t-orange-500 border-r-transparent border-b-orange-200 border-l-transparent rounded-full" />
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="absolute inset-3 bg-orange-500 items-center justify-center rounded-full shadow-md shadow-orange-500/20">
                  <Ionicons name="mail-unread-outline" size={20} color="#ffffff" />
                </Animated.View>
              </View>
              <Text className="text-base font-bold text-slate-800 mb-1">Sending Request</Text>
              <Text className="text-slate-400 text-xs font-medium">Please wait...</Text>
            </Animated.View>
          ) : isSuccess ? (
            <Animated.View style={{ opacity: formOpacity }} className="items-center py-6">
              <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              </View>
              <Text className="text-lg font-bold text-slate-800 text-center mb-2">Check your email</Text>
              <Text className="text-sm text-slate-500 text-center px-4 mb-8">We've sent a new password to your email address. Please use it to log in.</Text>
              
              <Link href="/login" asChild>
                <Pressable className="w-full">
                  <LinearGradient colors={["#f97316", "#ea580c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-4 rounded-2xl items-center justify-center">
                    <Text className="text-white text-base font-bold uppercase tracking-wide">Back to Login</Text>
                  </LinearGradient>
                </Pressable>
              </Link>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: formOpacity }}>
              <Text className="mb-2 text-xl font-bold text-slate-800">Forgot Password</Text>
              <Text className="mb-6 text-sm font-medium text-slate-500">Enter your email address and we'll send you a new password to get you back in.</Text>

              {/* Email Field */}
              <View className="mb-6">
                <Text className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email address</Text>
                <Animated.View style={{ borderColor: errors.email ? "#ef4444" : emailBorderColor }} className="flex-row items-center rounded-2xl border px-4 h-14 bg-white">
                  <View className="mr-3"><Ionicons name="mail-outline" size={20} color={errors.email ? "#ef4444" : "#64748b"} /></View>
                  <TextInput className="flex-1 text-slate-800 text-sm font-semibold h-full pt-0 pb-0" value={email} onChangeText={(val) => { setEmail(val); if (errors.email) setErrors((prev) => ({ ...prev, email: null })); }} onFocus={handleEmailFocus} onBlur={handleEmailBlur} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@company.com" placeholderTextColor="#cbd5e1" />
                </Animated.View>
                {errors.email ? <Text className="mt-1 ml-1 text-xs font-semibold text-rose-500">{errors.email}</Text> : null}
              </View>

              <Pressable onPress={handleReset} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isLoading} className="mt-2 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/30">
                <Animated.View style={{ transform: [{ scale: buttonScale }] }} className="w-full">
                  <LinearGradient colors={["#f97316", "#ea580c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-4 items-center justify-center">
                    <Text className="text-white text-base font-bold tracking-wide uppercase">Send New Password</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <View className="mt-6 flex-row justify-center items-center">
                <Text className="text-sm text-slate-500 font-medium">Remembered your password? </Text>
                <Link href="/login" asChild>
                  <Pressable className="p-1 active:opacity-60">
                    <Text className="text-sm text-orange-600 font-bold">Sign in</Text>
                  </Pressable>
                </Link>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>

      <Animated.View style={{ opacity: footerFade }} className="absolute bottom-6 left-0 right-0 items-center">
        <Text className="text-slate-400 text-xs font-medium tracking-wide">Powered by <Text className="text-orange-600 font-bold">Fillosoft</Text></Text>
      </Animated.View>
    </LinearGradient>
  );
}
