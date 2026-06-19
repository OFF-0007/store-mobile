/**
 * Register screen – premium modernized design with orange theme,
 * perfectly centered input alignment, custom transition,
 * and high-fidelity authentication loading animations.
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

export default function RegisterScreen() {
  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Transition States ─────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const storeFocus = useRef(new Animated.Value(0)).current;
  const emailFocus = useRef(new Animated.Value(0)).current;
  const phoneFocus = useRef(new Animated.Value(0)).current;
  const passwordFocus = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Smooth Form/Loader Cross-fade Transition ──────────────────────────────
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

  // ── Start Animations on Mount ──────────────────────────────────────────────
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

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(blob1X, { toValue: 25, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob1Y, { toValue: -15, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(blob1X, { toValue: -15, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob1Y, { toValue: 20, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(blob1X, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob1Y, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(blob2X, { toValue: -20, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob2Y, { toValue: 25, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(blob2X, { toValue: 15, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob2Y, { toValue: -15, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(blob2X, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(blob2Y, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
    ).start();
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

  // ── Input Focus/Blur Handlers ──────────────────────────────────────────────
  const handleStoreFocus = () => Animated.timing(storeFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const handleStoreBlur = () => Animated.timing(storeFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  const handleEmailFocus = () => Animated.timing(emailFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const handleEmailBlur = () => Animated.timing(emailFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  const handlePhoneFocus = () => Animated.timing(phoneFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const handlePhoneBlur = () => Animated.timing(phoneFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  const handlePasswordFocus = () => Animated.timing(passwordFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const handlePasswordBlur = () => Animated.timing(passwordFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  const handlePressIn = () => Animated.spring(buttonScale, { toValue: 0.95, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    const next = {};
    if (!storeName.trim()) next.storeName = "Store Name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = "Enter a valid email.";
    if (!phone.trim()) next.phone = "Phone number is required.";
    else if (!/^[0-9]{10}$/.test(phone.replace(/[\s\-+]/g, ""))) next.phone = "Enter exactly 10 digits.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Minimum 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!validate()) return;
    try {
      const data = await register(storeName.trim(), email.trim().toLowerCase(), password, phone.replace(/[\s\-]/g, ""));
      // Redirect to OTP verification screen
      router.push({ pathname: "/(auth)/verify-otp", params: { email: data.email } });
    } catch (err) {
      Alert.alert(
        "Registration Failed",
        err?.response?.data?.message || err?.message || "Please check your details and try again."
      );
    }
  }

  const storeBorderColor = storeFocus.interpolate({ inputRange: [0, 1], outputRange: ["#e2e8f0", "#f97316"] });
  const emailBorderColor = emailFocus.interpolate({ inputRange: [0, 1], outputRange: ["#e2e8f0", "#f97316"] });
  const phoneBorderColor = phoneFocus.interpolate({ inputRange: [0, 1], outputRange: ["#e2e8f0", "#f97316"] });
  const passwordBorderColor = passwordFocus.interpolate({ inputRange: [0, 1], outputRange: ["#e2e8f0", "#f97316"] });
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
          <Text className="mt-1.5 text-slate-500 text-sm font-medium tracking-wide">ERP & POS Mobile Companion</Text>
        </Animated.View>

        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }} className={`rounded-3xl min-h-[420px] ${isSubmitting ? "bg-transparent border-transparent shadow-none" : "border border-white/60 bg-white/85 p-6 shadow-xl shadow-orange-100/30 backdrop-blur-md"}`}>
          {isSubmitting ? (
            <Animated.View style={{ opacity: loaderOpacity }} className="flex-1 items-center justify-center py-6">
              <View className="mb-4 items-center justify-center h-20 w-20 relative">
                <Animated.View style={{ transform: [{ rotate: spin }] }} className="absolute inset-0 border-4 border-t-orange-500 border-r-transparent border-b-orange-200 border-l-transparent rounded-full" />
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }} className="absolute inset-3 bg-orange-500 items-center justify-center rounded-full shadow-md shadow-orange-500/20">
                  <Ionicons name="lock-open-outline" size={20} color="#ffffff" />
                </Animated.View>
              </View>
              <Text className="text-base font-bold text-slate-800 mb-1">Creating Account</Text>
              <Text className="text-slate-400 text-xs font-medium">Please wait...</Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: formOpacity }}>
              <Text className="mb-6 text-xl font-bold text-slate-800">Create a New Store</Text>

              {/* Store Name Field */}
              <View className="mb-4">
                <Text className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Store Name</Text>
                <Animated.View style={{ borderColor: errors.storeName ? "#ef4444" : storeBorderColor }} className="flex-row items-center rounded-2xl border px-4 h-14 bg-white">
                  <View className="mr-3"><Ionicons name="storefront-outline" size={20} color={errors.storeName ? "#ef4444" : "#64748b"} /></View>
                  <TextInput className="flex-1 text-slate-800 text-sm font-semibold h-full pt-0 pb-0" value={storeName} onChangeText={(val) => { setStoreName(val); if (errors.storeName) setErrors((prev) => ({ ...prev, storeName: null })); }} onFocus={handleStoreFocus} onBlur={handleStoreBlur} placeholder="My Awesome Store" placeholderTextColor="#cbd5e1" />
                </Animated.View>
                {errors.storeName ? <Text className="mt-1 ml-1 text-xs font-semibold text-rose-500">{errors.storeName}</Text> : null}
              </View>

              {/* Email Field */}
              <View className="mb-4">
                <Text className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email address</Text>
                <Animated.View style={{ borderColor: errors.email ? "#ef4444" : emailBorderColor }} className="flex-row items-center rounded-2xl border px-4 h-14 bg-white">
                  <View className="mr-3"><Ionicons name="mail-outline" size={20} color={errors.email ? "#ef4444" : "#64748b"} /></View>
                  <TextInput className="flex-1 text-slate-800 text-sm font-semibold h-full pt-0 pb-0" value={email} onChangeText={(val) => { setEmail(val); if (errors.email) setErrors((prev) => ({ ...prev, email: null })); }} onFocus={handleEmailFocus} onBlur={handleEmailBlur} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@company.com" placeholderTextColor="#cbd5e1" />
                </Animated.View>
                {errors.email ? <Text className="mt-1 ml-1 text-xs font-semibold text-rose-500">{errors.email}</Text> : null}
              </View>

              {/* Phone Field */}
              <View className="mb-4">
                <Text className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number (OTP will be sent)</Text>
                <Animated.View style={{ borderColor: errors.phone ? "#ef4444" : phoneBorderColor }} className="flex-row items-center rounded-2xl border px-4 h-14 bg-white">
                  <View className="mr-3"><Ionicons name="call-outline" size={20} color={errors.phone ? "#ef4444" : "#64748b"} /></View>
                  <TextInput className="flex-1 text-slate-800 text-sm font-semibold h-full pt-0 pb-0" value={phone} onChangeText={(val) => { setPhone(val); if (errors.phone) setErrors((prev) => ({ ...prev, phone: null })); }} onFocus={handlePhoneFocus} onBlur={handlePhoneBlur} keyboardType="phone-pad" placeholder="10-digit mobile number" placeholderTextColor="#cbd5e1" maxLength={10} />
                </Animated.View>
                {errors.phone ? <Text className="mt-1 ml-1 text-xs font-semibold text-rose-500">{errors.phone}</Text> : null}
              </View>

              {/* Password Field */}
              <View className="mb-6">
                <Text className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</Text>
                <Animated.View style={{ borderColor: errors.password ? "#ef4444" : passwordBorderColor }} className="flex-row items-center rounded-2xl border px-4 h-14 bg-white">
                  <View className="mr-3"><Ionicons name="lock-closed-outline" size={20} color={errors.password ? "#ef4444" : "#64748b"} /></View>
                  <TextInput className="flex-1 text-slate-800 text-sm font-semibold h-full pt-0 pb-0" value={password} onChangeText={(val) => { setPassword(val); if (errors.password) setErrors((prev) => ({ ...prev, password: null })); }} onFocus={handlePasswordFocus} onBlur={handlePasswordBlur} secureTextEntry={!showPassword} placeholder="••••••••" placeholderTextColor="#cbd5e1" />
                  <Pressable onPress={() => setShowPassword((v) => !v)} className="ml-3 p-1 active:opacity-60"><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></Pressable>
                </Animated.View>
                {errors.password ? <Text className="mt-1 ml-1 text-xs font-semibold text-rose-500">{errors.password}</Text> : null}
              </View>

              <Pressable onPress={handleRegister} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isLoading} className="mt-2 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/30">
                <Animated.View style={{ transform: [{ scale: buttonScale }] }} className="w-full">
                  <LinearGradient colors={["#f97316", "#ea580c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-4 items-center justify-center">
                    <Text className="text-white text-base font-bold tracking-wide uppercase">Register</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <View className="mt-6 flex-row justify-center items-center">
                <Text className="text-sm text-slate-500 font-medium">Already have an account? </Text>
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
