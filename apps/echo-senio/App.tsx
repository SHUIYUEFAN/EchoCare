import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { familyRoomChannel } from "@echocare/shared";

type AppTab = "陪伴" | "確認" | "提醒" | "相冊" | "社區" | "檔案";
type PhotoPreview = { id: string; uri: string; created?: string };
type ParsedAlarm = { triggerAt: Date; message: string };
type Locale = "zh" | "en" | "ja";
type ChatRecord = { id: string; role: "assistant" | "user"; text: string; createdAt: number };

const tabs: AppTab[] = ["陪伴", "確認", "提醒", "相冊", "社區", "檔案"];
const localeByPhone = (phone: string): Locale => {
  if (phone.startsWith("+86")) return "zh";
  if (phone.startsWith("+81")) return "ja";
  return "en";
};

const I18N = {
  zh: {
    loginTitle: "EchoCare 登录",
    loginHint: "请输入手机号（含国家区号）与密码",
    phonePlaceholder: "手机号，例如 +8613812345678",
    passwordPlaceholder: "密码",
    loginBtn: "登录",
    loginError: "请输入有效手机号和密码",
    localeTip: "已根据手机号切换语言",
    tabCompanion: "陪伴",
    tabConfirm: "确认",
    tabReminder: "提醒",
    tabAlbum: "相册",
    tabCommunity: "社区",
    tabProfile: "档案",
    waitingAction: "等待操作",
    wakeupHint: "说“小美”来唤醒我",
    uploadPhoto: "上传照片",
    genAvatar: "生成形象",
    voiceRegister: "注册声纹",
    voiceStart: "开启监听",
    voiceStop: "停止监听",
    alarmSet: "设定提醒",
    reminderTitle: "用药提醒",
    reminderDefaultTime: "下午 3:00",
    reminderInputPlaceholder: "明天下午3点提醒我吃降压药",
    reminderAckButton: "✓ 我知道了",
    alarmUnset: "尚未設定",
    profileNext: "下一步",
    tipTitle: "提示",
    errorTitle: "错误",
    micPermissionDenied: "未授予麦克风权限",
    recordFailed: "录音失败",
    timeNotUnderstood: "没听懂时间，请说“明天早上7点半提醒我吃药”",
    webNoReminder: "Web 不支持本地提醒，请用 Android/iOS",
    notificationPermissionDenied: "未授予通知权限",
    reminderCreated: "提醒已建立成功",
    reminderSetFailedTitle: "提醒设定失败",
    albumPermissionDenied: "未授予相簿权限，无法选择照片",
    albumPicked: "已选择照片，可以生成形象",
    albumOpenFailed: "打开相册失败",
    uploadPhotoFirst: "请先上传人物照片",
    avatarCloudFailed: "卡通形象生成失败",
    avatarCloudSuccess: "已生成 AI 2D 形象（云端）",
    avatarLocalFailed: "本地形象生成失败",
    avatarOfflineFallback: "网络不可用，已改用本地模式生成形象",
    avatarFailed: "生成失败",
    avatarFailedTitle: "生成失败",
    webNoMic: "Web 不支持麦克风录音",
    voiceRegistering: "注册中...",
    voiceRegisterFailed: "声纹注册失败",
    voiceRegistered: "已注册",
    voiceRegisterSuccess: "声纹注册成功",
    voiceRegisterOfflineSuccess: "网络异常，已切换为本地声纹模式",
    voiceRegisterFailedTitle: "注册失败",
    registerFirstBeforeListen: "请先注册声纹再开启监听",
    listeningStarted: "监听已开启",
    recognized: "已识别注册用户",
    unmatched: "未匹配",
    recognizedLog: "识别成功",
    listeningInterrupted: "监听中断",
    listeningTitle: "监听",
    listeningStopped: "监听已停止",
    webNoAlbum: "Web 不支持相册 API",
    albumReadFailed: "读取相册失败",
    albumLoaded: "已载入照片",
    albumCaptionLoading: "正在识别照片内容...",
    albumCaptionFallback: "这是一张珍贵的生活照片，记录了温暖时刻。",
    albumCaptionError: "图片识别失败，已使用默认描述。",
    albumPrev: "‹ 上一张",
    albumNext: "下一张 ›",
    albumZoomIn: "放大",
    albumZoomOut: "缩小",
    webNoCalendar: "Web 不支持日历 API",
    calendarPermissionDenied: "未授予日历权限",
    noEventToday: "今天没有日程",
    calendarToReminderSuccess: "已从日历生成提醒",
    calendarReadFailed: "读取日历失败",
    confirmApproved: "已确认，准备下单",
    confirmApprovedFeedback: "已为您确认商品，正在提交代购订单",
    confirmCancelled: "已取消",
    confirmCancelledFeedback: "已取消本次代购",
    completeProfileFirst: "请先完成基本资料",
    profileSaved: "资料已保存",
    communityJoined: "已帮您加入活动",
    communityLater: "好的，下次再提醒您",
    unknownCommand: "未识别指令",
    reminderAcked: "已确认提醒",
    localeSwitched: "已根据手机号切换语言",
    voiceUnregistered: "未注册",
    apiSwitched: "API 已切换到",
    noHistory: "暂无历史对话，开始说话后会记录在这里",
    profileTitle: "基本资料",
    profileGenderLabel: "性别",
    profileAgeLabel: "年龄",
    profileConditionLabel: "是否有基础病？",
    genderMale: "男",
    genderFemale: "女",
    conditionYes: "有",
    conditionNo: "没有",
    ageRange60_70: "60-70岁",
    ageRange70_80: "70-80岁",
    ageRange80_90: "80-90岁",
    ageRange90Plus: "90+岁",
  },
  en: {
    loginTitle: "EchoCare Sign In",
    loginHint: "Enter phone number (with country code) and password",
    phonePlaceholder: "Phone number, e.g. +14155550123",
    passwordPlaceholder: "Password",
    loginBtn: "Sign In",
    loginError: "Please enter a valid phone number and password",
    localeTip: "Language switched by phone number",
    tabCompanion: "Companion",
    tabConfirm: "Confirm",
    tabReminder: "Reminder",
    tabAlbum: "Album",
    tabCommunity: "Community",
    tabProfile: "Profile",
    waitingAction: "Waiting for action",
    wakeupHint: 'Say "Xiaomei" to wake me',
    uploadPhoto: "Upload Photo",
    genAvatar: "Generate Avatar",
    voiceRegister: "Register Voice",
    voiceStart: "Start Listening",
    voiceStop: "Stop Listening",
    alarmSet: "Set Reminder",
    reminderTitle: "Medication Reminder",
    reminderDefaultTime: "3:00 PM",
    reminderInputPlaceholder: "Remind me tomorrow at 3 PM to take medicine",
    reminderAckButton: "✓ Got it",
    alarmUnset: "Not set yet",
    profileNext: "Next",
    tipTitle: "Tip",
    errorTitle: "Error",
    micPermissionDenied: "Microphone permission denied",
    recordFailed: "Recording failed",
    timeNotUnderstood: 'Could not parse time, try "Remind me at 7:30 tomorrow morning"',
    webNoReminder: "Local reminders are not supported on Web. Use Android/iOS.",
    notificationPermissionDenied: "Notification permission denied",
    reminderCreated: "Reminder created successfully",
    reminderSetFailedTitle: "Reminder setup failed",
    albumPermissionDenied: "Photo permission denied",
    albumPicked: "Photo selected, ready to generate avatar",
    albumOpenFailed: "Failed to open gallery",
    uploadPhotoFirst: "Please upload a portrait first",
    avatarCloudFailed: "Avatar generation failed",
    avatarCloudSuccess: "AI 2D avatar generated (cloud)",
    avatarLocalFailed: "Local avatar generation failed",
    avatarOfflineFallback: "Network unavailable, generated avatar in local mode",
    avatarFailed: "Generation failed",
    avatarFailedTitle: "Generation Failed",
    webNoMic: "Microphone recording is not supported on Web",
    voiceRegistering: "Registering...",
    voiceRegisterFailed: "Voice registration failed",
    voiceRegistered: "Registered",
    voiceRegisterSuccess: "Voice registered successfully",
    voiceRegisterOfflineSuccess: "Network unavailable. Switched to local voice mode.",
    voiceRegisterFailedTitle: "Registration Failed",
    registerFirstBeforeListen: "Please register voice before listening",
    listeningStarted: "Listening started",
    recognized: "Registered user recognized",
    unmatched: "Not matched",
    recognizedLog: "Recognized",
    listeningInterrupted: "Listening interrupted",
    listeningTitle: "Listening",
    listeningStopped: "Listening stopped",
    webNoAlbum: "Album API is not supported on Web",
    albumReadFailed: "Failed to read album",
    albumLoaded: "Photos loaded",
    albumCaptionLoading: "Analyzing photo content...",
    albumCaptionFallback: "This is a precious life photo capturing a warm moment.",
    albumCaptionError: "Image recognition failed. Using fallback description.",
    albumPrev: "‹ Previous",
    albumNext: "Next ›",
    albumZoomIn: "Zoom In",
    albumZoomOut: "Zoom Out",
    webNoCalendar: "Calendar API is not supported on Web",
    calendarPermissionDenied: "Calendar permission denied",
    noEventToday: "No events today",
    calendarToReminderSuccess: "Reminder generated from calendar",
    calendarReadFailed: "Failed to read calendar",
    confirmApproved: "Confirmed, placing order",
    confirmApprovedFeedback: "Order confirmed and submitting",
    confirmCancelled: "Cancelled",
    confirmCancelledFeedback: "Order cancelled",
    completeProfileFirst: "Please complete profile information",
    profileSaved: "Profile saved",
    communityJoined: "Joined the group",
    communityLater: "Okay, remind me next time",
    unknownCommand: "Unknown command",
    reminderAcked: "Reminder acknowledged",
    localeSwitched: "Language switched by phone number",
    voiceUnregistered: "Not registered",
    apiSwitched: "API switched to",
    noHistory: "No conversation history yet. Start speaking to create records.",
    profileTitle: "Basic Profile",
    profileGenderLabel: "Gender",
    profileAgeLabel: "Age",
    profileConditionLabel: "Underlying condition?",
    genderMale: "Male",
    genderFemale: "Female",
    conditionYes: "Yes",
    conditionNo: "No",
    ageRange60_70: "60-70",
    ageRange70_80: "70-80",
    ageRange80_90: "80-90",
    ageRange90Plus: "90+",
  },
  ja: {
    loginTitle: "EchoCare ログイン",
    loginHint: "国番号付きの電話番号とパスワードを入力してください",
    phonePlaceholder: "電話番号 例: +819012345678",
    passwordPlaceholder: "パスワード",
    loginBtn: "ログイン",
    loginError: "有効な電話番号とパスワードを入力してください",
    localeTip: "電話番号に基づいて言語を切り替えました",
    tabCompanion: "会話",
    tabConfirm: "確認",
    tabReminder: "通知",
    tabAlbum: "アルバム",
    tabCommunity: "コミュニティ",
    tabProfile: "プロフィール",
    waitingAction: "操作待機中",
    wakeupHint: "「シャオメイ」と話しかけて起動",
    uploadPhoto: "写真を選ぶ",
    genAvatar: "アバター生成",
    voiceRegister: "音声登録",
    voiceStart: "監聴開始",
    voiceStop: "監聴停止",
    alarmSet: "通知を設定",
    reminderTitle: "服薬リマインド",
    reminderDefaultTime: "午後 3:00",
    reminderInputPlaceholder: "明日の午後3時に薬を飲むように知らせて",
    reminderAckButton: "✓ わかりました",
    alarmUnset: "未設定",
    profileNext: "次へ",
    tipTitle: "ヒント",
    errorTitle: "エラー",
    micPermissionDenied: "マイク権限がありません",
    recordFailed: "録音に失敗しました",
    timeNotUnderstood: "時間を解析できません。「明日の朝7時半に薬を通知して」のように入力してください",
    webNoReminder: "Web ではローカル通知を利用できません。Android/iOS を使用してください",
    notificationPermissionDenied: "通知権限がありません",
    reminderCreated: "通知を作成しました",
    reminderSetFailedTitle: "通知設定失敗",
    albumPermissionDenied: "写真権限がありません",
    albumPicked: "写真を選択しました。アバター生成できます",
    albumOpenFailed: "アルバムを開けませんでした",
    uploadPhotoFirst: "先に人物写真をアップロードしてください",
    avatarCloudFailed: "アバター生成に失敗しました",
    avatarCloudSuccess: "AI 2D アバター生成完了（クラウド）",
    avatarLocalFailed: "ローカル生成に失敗しました",
    avatarOfflineFallback: "ネットワーク不可のためローカル生成に切り替えました",
    avatarFailed: "生成失敗",
    avatarFailedTitle: "生成失敗",
    webNoMic: "Web ではマイク録音を利用できません",
    voiceRegistering: "登録中...",
    voiceRegisterFailed: "音声登録に失敗しました",
    voiceRegistered: "登録済み",
    voiceRegisterSuccess: "音声登録に成功しました",
    voiceRegisterOfflineSuccess: "ネットワーク不安定のため、ローカル音声モードに切り替えました",
    voiceRegisterFailedTitle: "登録失敗",
    registerFirstBeforeListen: "先に音声登録してください",
    listeningStarted: "監聴を開始しました",
    recognized: "登録ユーザーを認識",
    unmatched: "不一致",
    recognizedLog: "認識成功",
    listeningInterrupted: "監聴が中断されました",
    listeningTitle: "監聴",
    listeningStopped: "監聴を停止しました",
    webNoAlbum: "Web ではアルバム API を利用できません",
    albumReadFailed: "アルバム読み込み失敗",
    albumLoaded: "写真を読み込みました",
    albumCaptionLoading: "写真内容を認識中...",
    albumCaptionFallback: "あたたかい瞬間を記録した大切な日常写真です。",
    albumCaptionError: "画像認識に失敗したため、既定の説明を表示します。",
    albumPrev: "‹ 前へ",
    albumNext: "次へ ›",
    albumZoomIn: "拡大",
    albumZoomOut: "縮小",
    webNoCalendar: "Web ではカレンダー API を利用できません",
    calendarPermissionDenied: "カレンダー権限がありません",
    noEventToday: "本日の予定はありません",
    calendarToReminderSuccess: "カレンダーから通知を作成しました",
    calendarReadFailed: "カレンダー読み込み失敗",
    confirmApproved: "確認済み、注文処理中",
    confirmApprovedFeedback: "商品を確認し、注文処理を開始しました",
    confirmCancelled: "キャンセル済み",
    confirmCancelledFeedback: "今回の注文をキャンセルしました",
    completeProfileFirst: "プロフィールを先に入力してください",
    profileSaved: "プロフィールを保存しました",
    communityJoined: "活動に参加しました",
    communityLater: "了解です。次回またお知らせします",
    unknownCommand: "未認識コマンド",
    reminderAcked: "通知を確認しました",
    localeSwitched: "電話番号に基づいて言語を切り替えました",
    voiceUnregistered: "未登録",
    apiSwitched: "API を切り替え:",
    noHistory: "会話履歴はまだありません。話し始めるとここに記録されます。",
    profileTitle: "基本情報",
    profileGenderLabel: "性別",
    profileAgeLabel: "年齢",
    profileConditionLabel: "基礎疾患はありますか？",
    genderMale: "男性",
    genderFemale: "女性",
    conditionYes: "ある",
    conditionNo: "ない",
    ageRange60_70: "60-70歳",
    ageRange70_80: "70-80歳",
    ageRange80_90: "80-90歳",
    ageRange90Plus: "90歳以上",
  },
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const channel = useMemo(() => familyRoomChannel("demo-family"), []);
  const [locale, setLocale] = useState<Locale>("en");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [countryCode, setCountryCode] = useState("+86");
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [smsCodeInput, setSmsCodeInput] = useState("");
  const [debugCodeHint, setDebugCodeHint] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("陪伴");
  const t = I18N[locale];
  const tabLabel = (tab: AppTab) => {
    if (tab === "陪伴") return t.tabCompanion;
    if (tab === "確認") return t.tabConfirm;
    if (tab === "提醒") return t.tabReminder;
    if (tab === "相冊") return t.tabAlbum;
    if (tab === "社區") return t.tabCommunity;
    return t.tabProfile;
  };
  const [info, setInfo] = useState<string>(t.wakeupHint);
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<string>(t.voiceUnregistered);
  const localVoiceSignatureRef = useRef<number[] | null>(null);
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);

  const [sourcePhotoUri, setSourcePhotoUri] = useState("");
  const [avatarUri, setAvatarUri] = useState("");

  const [alarmCommand, setAlarmCommand] = useState("明天下午3點提醒我吃降壓藥");
  const [alarmStatus, setAlarmStatus] = useState<string>(t.alarmUnset);
  const [reminderText, setReminderText] = useState("下午3:00 吃降壓藥！");
  const [reminderAcked, setReminderAcked] = useState(false);

  const [confirmStatus, setConfirmStatus] = useState("等待確認");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [albumIndex, setAlbumIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [albumCaption, setAlbumCaption] = useState("");
  const [albumCaptionLoading, setAlbumCaptionLoading] = useState(false);
  const [communityChoice, setCommunityChoice] = useState("尚未決定");

  const [profileGender, setProfileGender] = useState<"male" | "female" | "">("");
  const [profileAge, setProfileAge] = useState<"60-70" | "70-80" | "80-90" | "90+" | "">("");
  const [hasCondition, setHasCondition] = useState<"yes" | "no" | "">("");
  const [voiceCommand, setVoiceCommand] = useState("");
  const [showConfirmCard, setShowConfirmCard] = useState(true);
  const [actionLog, setActionLog] = useState<string>(t.waitingAction);
  const [chatHistory, setChatHistory] = useState<ChatRecord[]>([]);
  const chatHistoryPath = `${FileSystem.documentDirectory ?? ""}echocare-chat-history.json`;
  const avatarFloat = useRef(new Animated.Value(0)).current;
  const companionScrollY = useRef(new Animated.Value(0)).current;
  const speakingRipple = useRef(new Animated.Value(0)).current;
  const autoAlbumLoadingRef = useRef(false);

  const unsupportedOnWeb = Platform.OS === "web";
  const productionApiBase = "https://echocare-tc2e.onrender.com";
  const configuredApiBase =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Platform.OS === "android" ? productionApiBase : productionApiBase);
  const [resolvedApiBase, setResolvedApiBase] = useState(configuredApiBase);
  const apiCandidates = useMemo(() => {
    const defaults =
      Platform.OS === "android"
        ? [productionApiBase, "http://10.0.2.2:3001", "http://10.0.3.2:3001", "http://127.0.0.1:3001", "http://localhost:3001"]
        : [productionApiBase, "http://localhost:3001", "http://127.0.0.1:3001"];
    return Array.from(new Set([configuredApiBase, ...defaults]));
  }, [configuredApiBase, productionApiBase]);

  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("alarm", {
        name: "EchoCare Alarm",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      }).catch(() => undefined);
    }
    return () => {
      listeningRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        if (!FileSystem.documentDirectory) return;
        const info = await FileSystem.getInfoAsync(chatHistoryPath);
        if (!info.exists) return;
        const raw = await FileSystem.readAsStringAsync(chatHistoryPath);
        const parsed = JSON.parse(raw) as ChatRecord[];
        if (Array.isArray(parsed)) setChatHistory(parsed.slice(-50));
      } catch {
        // ignore corrupted history
      }
    };
    void loadHistory();
  }, [chatHistoryPath]);

  const persistHistory = async (records: ChatRecord[]) => {
    try {
      if (!FileSystem.documentDirectory) return;
      await FileSystem.writeAsStringAsync(chatHistoryPath, JSON.stringify(records));
    } catch {
      // best effort persistence only
    }
  };

  const appendHistory = (role: ChatRecord["role"], text: string) => {
    const item: ChatRecord = { id: `${Date.now()}-${Math.random()}`, role, text, createdAt: Date.now() };
    setChatHistory((prev) => {
      const next = [...prev, item].slice(-50);
      void persistHistory(next);
      return next;
    });
  };

  useEffect(() => {
    setAlarmStatus((prev) => (prev === I18N.zh.alarmUnset || prev === I18N.en.alarmUnset || prev === I18N.ja.alarmUnset ? t.alarmUnset : prev));
  }, [locale, t.alarmUnset]);

  useEffect(() => {
    if (activeTab === "相冊" && photos.length) {
      const randomIdx = Math.floor(Math.random() * photos.length);
      setAlbumIndex(randomIdx);
    }
  }, [activeTab, photos]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(avatarFloat, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(avatarFloat, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [avatarFloat]);

  useEffect(() => {
    const rippleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(speakingRipple, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(speakingRipple, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    rippleLoop.start();
    return () => rippleLoop.stop();
  }, [speakingRipple]);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const buildLocalSignature = (audioBase64: string) => {
    const signature = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < audioBase64.length; i += 53) {
      const code = audioBase64.charCodeAt(i);
      signature[i % signature.length] += code;
    }
    return signature.map((n) => n / Math.max(audioBase64.length, 1));
  };
  const localSimilarity = (a: number[], b: number[]) => {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-6);
  };
  const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 20000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  const requestApi = async (path: string, init?: RequestInit) => {
    const ordered = [resolvedApiBase, ...apiCandidates.filter((b) => b !== resolvedApiBase)];
    let lastError: unknown;
    for (const base of ordered) {
      try {
        const res = await fetchWithTimeout(`${base}${path}`, init);
        if (res.status < 500) {
          if (base !== resolvedApiBase) {
            setResolvedApiBase(base);
            setActionLog(`${t.apiSwitched} ${base}`);
          }
          return res;
        }
        lastError = new Error(`HTTP ${res.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? new Error(`Network request failed: ${lastError.message}`)
      : new Error("Network request failed");
  };

  const feedback = (message: string, title = "提示") => {
    setInfo(message);
    setActionLog(message);
    appendHistory("assistant", message);
    Alert.alert(title, message);
  };

  const fullPhone = `${countryCode}${phoneInput.trim()}`;
  const sendSmsCode = async () => {
    if (!/^\d{5,14}$/.test(phoneInput.trim())) {
      Alert.alert("Invalid Phone", "Please enter a valid phone number.");
      return;
    }
    // SMS sending is temporarily disabled for local demo.
    // try {
    //   setBusy(true);
    //   const response = await requestApi("/v1/auth/send-code", {
    //     method: "POST",
    //     headers: { "content-type": "application/json" },
    //     body: JSON.stringify({ phone: fullPhone }),
    //   });
    //   const payload = (await response.json()) as { success?: boolean; debugCode?: string; error?: string };
    //   if (!response.ok || !payload.success) throw new Error(payload.error || "Failed to send verification code.");
    //   setCodeSent(true);
    //   setDebugCodeHint(payload.debugCode ? `Dev code: ${payload.debugCode}` : "");
    //   Alert.alert("Code Sent", "Verification code sent. Please check your messages.");
    // } catch (error) {
    //   Alert.alert("Send Failed", error instanceof Error ? error.message : "Failed to send verification code.");
    // } finally {
    //   setBusy(false);
    // }
    setCodeSent(true);
    setDebugCodeHint("Demo mode: enter any 6-digit code to sign in.");
    Alert.alert("Demo Mode", "SMS sending is disabled. Enter any 6-digit code to continue.");
  };

  const handleLogin = async () => {
    if (!codeSent || !/^\d{6}$/.test(smsCodeInput.trim())) {
      Alert.alert("Invalid Code", "Please enter the verification code.");
      return;
    }
    // Verification API is temporarily disabled for local demo.
    // try {
    //   setBusy(true);
    //   const response = await requestApi("/v1/auth/verify-code", {
    //     method: "POST",
    //     headers: { "content-type": "application/json" },
    //     body: JSON.stringify({ phone: fullPhone, code: smsCodeInput.trim() }),
    //   });
    //   const payload = (await response.json()) as { success?: boolean; error?: string };
    //   if (!response.ok || !payload.success) throw new Error(payload.error || "Verification failed.");
    // } catch (error) {
    //   Alert.alert("Login Failed", error instanceof Error ? error.message : "Verification failed.");
    //   return;
    // } finally {
    //   setBusy(false);
    // }
    const detected = localeByPhone(fullPhone);
    setLocale(detected);
    setIsLoggedIn(true);
    const nextT = I18N[detected];
    setInfo(nextT.wakeupHint);
    setActionLog(nextT.localeSwitched);
  };

  const recordClip = async (durationMs: number) => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) throw new Error(t.micPermissionDenied);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    await sleep(durationMs);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) throw new Error(t.recordFailed);
    return uri;
  };

  const parseAlarmCommand = (raw: string): ParsedAlarm => {
    const normalizeChineseTime = (input: string) => {
      const digitMap: Record<string, string> = {
        零: "0",
        一: "1",
        二: "2",
        两: "2",
        兩: "2",
        三: "3",
        四: "4",
        五: "5",
        六: "6",
        七: "7",
        八: "8",
        九: "9",
      };
      let out = input;
      out = out.replace(/十([一二两兩三四五六七八九])/g, (_, a: string) => `1${digitMap[a]}`);
      out = out.replace(/([二三四五六七八九])十/g, (_, a: string) => `${digitMap[a]}0`);
      out = out.replace(/十/g, "10");
      out = out.replace(/[零一二两兩三四五六七八九]/g, (m) => digitMap[m] ?? m);
      return out;
    };

    const text = normalizeChineseTime(raw.replace(/\s+/g, ""));
    const now = new Date();
    const hmMatch = text.match(/(\d{1,2})(?:[:：]|點|点)([0-5]?\d|半)?(?:分)?/);
    if (!hmMatch) throw new Error(t.timeNotUnderstood);
    let hour = Number(hmMatch[1]);
    let minute = hmMatch[2] === "半" ? 30 : hmMatch[2] ? Number(hmMatch[2]) : 0;
    if (/下午|晚上/.test(text) && hour < 12) hour += 12;
    if (/凌晨/.test(text) && hour === 12) hour = 0;
    const dayOffset = /後天|后天/.test(text) ? 2 : /明天/.test(text) ? 1 : 0;
    const triggerAt = new Date(now);
    triggerAt.setDate(now.getDate() + dayOffset);
    triggerAt.setHours(hour, minute, 0, 0);
    if (dayOffset === 0 && triggerAt <= now) triggerAt.setDate(triggerAt.getDate() + 1);
    const message =
      text.match(/提醒(?:我)?(.+)/)?.[1] ||
      text.match(/叫(?:我)?(.+)/)?.[1] ||
      text.match(/通知(?:我)?(.+)/)?.[1] ||
      "時間到囉";
    return { triggerAt, message };
  };

  const scheduleAlarm = async () => {
    if (unsupportedOnWeb) {
      feedback(t.webNoReminder, t.tipTitle);
      return;
    }
    try {
      setBusy(true);
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) throw new Error(t.notificationPermissionDenied);
      const parsed = parseAlarmCommand(alarmCommand);
      await Notifications.scheduleNotificationAsync({
        content: { title: "EchoCare 用藥提醒", body: parsed.message, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: parsed.triggerAt,
          channelId: "alarm",
        },
      });
      setReminderText(parsed.message);
      setReminderAcked(false);
      setAlarmStatus(`${parsed.triggerAt.toLocaleString()} · ${parsed.message}`);
      feedback(t.reminderCreated, t.tipTitle);
      setActiveTab("提醒");
    } catch (error) {
      const message = error instanceof Error ? error.message : t.reminderSetFailedTitle;
      setAlarmStatus(`${t.reminderSetFailedTitle}: ${message}`);
      feedback(message, t.reminderSetFailedTitle);
    } finally {
      setBusy(false);
    }
  };

  const pickAvatarSource = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        feedback(t.albumPermissionDenied, t.tipTitle);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        base64: false,
      });
      if (!result.canceled) {
        setSourcePhotoUri(result.assets[0].uri);
        feedback(t.albumPicked, t.tipTitle);
      }
    } catch (error) {
      feedback(error instanceof Error ? error.message : t.albumOpenFailed, t.tipTitle);
    }
  };

  const generateAvatar = async () => {
    if (!sourcePhotoUri) {
      setInfo(t.uploadPhotoFirst);
      return;
    }
    try {
      setBusy(true);
      const imageBase64 = await FileSystem.readAsStringAsync(sourcePhotoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      try {
        const response = await requestApi("/v1/avatar/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64 }),
        });
        const payload = (await response.json()) as { imageDataUrl?: string };
        if (!response.ok || !payload.imageDataUrl) throw new Error(t.avatarCloudFailed);
        setAvatarUri(payload.imageDataUrl);
        feedback(t.avatarCloudSuccess, t.tipTitle);
      } catch {
        // Offline fallback: local stylization so users can continue even when API is unreachable.
        const local = await ImageManipulator.manipulateAsync(
          sourcePhotoUri,
          [{ resize: { width: 512 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.PNG, base64: true }
        );
        if (!local.base64) throw new Error(t.avatarLocalFailed);
        setAvatarUri(`data:image/png;base64,${local.base64}`);
        feedback(t.avatarOfflineFallback, t.tipTitle);
      }
    } catch (error) {
      feedback(error instanceof Error ? error.message : t.avatarFailed, t.avatarFailedTitle);
    } finally {
      setBusy(false);
    }
  };

  const registerVoice = async () => {
    if (unsupportedOnWeb) {
      feedback(t.webNoMic, t.tipTitle);
      return;
    }
    try {
      setBusy(true);
      setVoiceState(t.voiceRegistering);
      const clipUri = await recordClip(3500);
      const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await requestApi("/v1/voice/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId: "demo-family", profileId: "elder-main", audioBase64 }),
      });
      const payload = (await response.json()) as { success?: boolean };
      if (!response.ok || !payload.success) throw new Error(t.voiceRegisterFailed);
      setVoiceState(t.voiceRegistered);
      localVoiceSignatureRef.current = buildLocalSignature(audioBase64);
      feedback(t.voiceRegisterSuccess, t.tipTitle);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.voiceRegisterFailed;
      if (/Network request failed/i.test(message)) {
        try {
          const clipUri = await recordClip(2200);
          const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          localVoiceSignatureRef.current = buildLocalSignature(audioBase64);
          setVoiceState(t.voiceRegistered);
          feedback(t.voiceRegisterOfflineSuccess, t.tipTitle);
        } catch {
          setVoiceState(t.voiceRegisterFailed);
          feedback(message, t.voiceRegisterFailedTitle);
        }
      } else {
        setVoiceState(t.voiceRegisterFailed);
        feedback(message, t.voiceRegisterFailedTitle);
      }
    } finally {
      setBusy(false);
    }
  };

  const startVoiceMonitoring = async () => {
    if (unsupportedOnWeb) {
      feedback(t.webNoMic, t.tipTitle);
      return;
    }
    if (voiceState !== t.voiceRegistered && !localVoiceSignatureRef.current) {
      feedback(t.registerFirstBeforeListen, t.tipTitle);
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setActionLog(t.listeningStarted);
    while (listeningRef.current) {
      try {
        const clipUri = await recordClip(3000);
        const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const response = await requestApi("/v1/voice/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ familyId: "demo-family", profileId: "elder-main", audioBase64 }),
        });
        const payload = (await response.json()) as { matched: boolean; score: number };
        if (payload.matched) {
          setInfo(`${t.recognized} (${payload.score.toFixed(2)})`);
          setActionLog(`${t.recognizedLog} (${payload.score.toFixed(2)})`);
        } else {
          setInfo(`${t.unmatched} (${payload.score.toFixed(2)})`);
          setActionLog(`${t.unmatched} (${payload.score.toFixed(2)})`);
        }
      } catch {
        if (!localVoiceSignatureRef.current) {
          feedback(t.listeningInterrupted, t.listeningTitle);
          break;
        }
        const clipUri = await recordClip(2400);
        const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const score = localSimilarity(localVoiceSignatureRef.current, buildLocalSignature(audioBase64));
        if (score > 0.82) {
          setInfo(`${t.recognized} (${score.toFixed(2)})`);
          setActionLog(`${t.recognizedLog} (${score.toFixed(2)})`);
        } else {
          setInfo(`${t.unmatched} (${score.toFixed(2)})`);
          setActionLog(`${t.unmatched} (${score.toFixed(2)})`);
        }
      }
    }
    listeningRef.current = false;
    setListening(false);
    setActionLog(t.listeningStopped);
  };

  const readLatestPhotos = async (switchToAlbum = true, showToast = true) => {
    if (unsupportedOnWeb) {
      feedback(t.webNoAlbum, t.tipTitle);
      return;
    }
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error(t.albumPermissionDenied);
      const res = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 12,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const mapped = res.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        created: asset.creationTime ? new Date(asset.creationTime).toLocaleDateString() : undefined,
      }));
      setPhotos(mapped);
      const randomIdx = mapped.length ? Math.floor(Math.random() * mapped.length) : 0;
      setAlbumIndex(randomIdx);
      if (showToast) feedback(`${t.albumLoaded} ${mapped.length}`, t.tipTitle);
      if (switchToAlbum) setActiveTab("相冊");
    } catch (error) {
      feedback(error instanceof Error ? error.message : t.albumReadFailed, t.tabAlbum);
    }
  };

  const describePhoto = async (photo?: PhotoPreview) => {
    if (!photo) {
      setAlbumCaption(t.albumCaptionFallback);
      return;
    }
    setAlbumCaptionLoading(true);
    try {
      const imageBase64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await requestApi("/v1/vision/describe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64, locale }),
      });
      const payload = (await response.json()) as { description?: string };
      if (!response.ok || !payload.description) throw new Error(t.albumCaptionError);
      setAlbumCaption(payload.description);
    } catch {
      setAlbumCaption(t.albumCaptionFallback);
    } finally {
      setAlbumCaptionLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || unsupportedOnWeb || photos.length > 0 || autoAlbumLoadingRef.current) return;
    autoAlbumLoadingRef.current = true;
    void readLatestPhotos(false, false).finally(() => {
      autoAlbumLoadingRef.current = false;
    });
  }, [isLoggedIn, photos.length, unsupportedOnWeb]);

  useEffect(() => {
    if (activeTab !== "相冊" || unsupportedOnWeb || photos.length > 0 || autoAlbumLoadingRef.current) return;
    autoAlbumLoadingRef.current = true;
    void readLatestPhotos(false, false).finally(() => {
      autoAlbumLoadingRef.current = false;
    });
  }, [activeTab, photos.length, unsupportedOnWeb]);

  const activePhoto = photos[albumIndex];

  useEffect(() => {
    if (!activePhoto) {
      setAlbumCaption(t.albumCaptionFallback);
      return;
    }
    void describePhoto(activePhoto);
  }, [activePhoto?.id, locale]);

  const loadTodayEventAsReminder = async () => {
    if (unsupportedOnWeb) {
      feedback(t.webNoCalendar, t.tipTitle);
      return;
    }
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (!permission.granted) throw new Error(t.calendarPermissionDenied);
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const start = new Date();
      const end = new Date(start.getTime() + 1000 * 60 * 60 * 24);
      const events = calendars.length
        ? await Calendar.getEventsAsync(
            calendars.map((c) => c.id),
            start,
            end
          )
        : [];
      const first = events[0];
      if (!first) throw new Error(t.noEventToday);
      setReminderText(first.title || "行程提醒");
      setReminderAcked(false);
      setActiveTab("提醒");
      feedback(t.calendarToReminderSuccess, t.tipTitle);
    } catch (error) {
      feedback(error instanceof Error ? error.message : t.calendarReadFailed, t.tabReminder);
    }
  };

  const handleConfirmOrder = async () => {
    setConfirmStatus(t.confirmApproved);
    setShowConfirmCard(false);
    feedback(t.confirmApprovedFeedback, t.tipTitle);
    setActiveTab("陪伴");
  };

  const handleCancelOrder = () => {
    setConfirmStatus(t.confirmCancelled);
    setShowConfirmCard(false);
    feedback(t.confirmCancelledFeedback, t.tipTitle);
    setActiveTab("陪伴");
  };

  const saveProfile = () => {
    if (!profileGender || !profileAge || !hasCondition) {
      feedback(t.completeProfileFirst, t.tipTitle);
      return;
    }
    const genderLabel = profileGender === "male" ? t.genderMale : t.genderFemale;
    const conditionLabel = hasCondition === "yes" ? t.conditionYes : t.conditionNo;
    const ageLabel =
      profileAge === "60-70"
        ? t.ageRange60_70
        : profileAge === "70-80"
          ? t.ageRange70_80
          : profileAge === "80-90"
            ? t.ageRange80_90
            : t.ageRange90Plus;
    feedback(`${t.profileSaved}: ${genderLabel} / ${ageLabel} / ${conditionLabel}`, t.tipTitle);
    setActiveTab("陪伴");
  };

  const executeVoiceCommand = async () => {
    const cmd = voiceCommand.trim();
    if (!cmd) return;
    appendHistory("user", cmd);
    const looksLikeAlarm =
      /(提醒|鬧鐘|闹钟|叫我|通知我)/.test(cmd) &&
      /(明天|後天|后天|今天|早上|上午|下午|晚上|凌晨|\d|[零一二两兩三四五六七八九十]+[點点]|[零一二两兩三四五六七八九十]+:)/.test(cmd);
    if (looksLikeAlarm) {
      setAlarmCommand(cmd);
      return scheduleAlarm();
    }
    if (cmd.includes("確認")) return handleConfirmOrder();
    if (cmd.includes("取消")) return handleCancelOrder();
    if (cmd.includes("提醒") || cmd.includes("鬧鐘")) return scheduleAlarm();
    if (cmd.includes("相冊") || cmd.includes("照片")) return readLatestPhotos();
    if (cmd.includes("日曆")) return loadTodayEventAsReminder();
    if (cmd.includes("加入")) {
      setCommunityChoice("已加入他們");
      setInfo(t.communityJoined);
      return;
    }
    if (cmd.includes("下次")) {
      setCommunityChoice("稍後再說");
      setInfo(t.communityLater);
      return;
    }
    if (cmd.includes("下一張")) {
      setAlbumIndex((idx) => Math.min(idx + 1, Math.max(photos.length - 1, 0)));
      return;
    }
    if (cmd.includes("上一張")) {
      setAlbumIndex((idx) => Math.max(idx - 1, 0));
      return;
    }
    if (cmd.includes("放大")) {
      setZoomed(true);
      return;
    }
    if (cmd.includes("縮小")) {
      setZoomed(false);
      return;
    }
    feedback(`${t.unknownCommand}: ${cmd}`, t.tipTitle);
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.loginPage}>
        <StatusBar style="light" />
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>{t.loginTitle}</Text>
          <Text style={styles.loginHint}>Choose country code, enter phone, and sign in with SMS verification.</Text>
          <View style={styles.phoneRow}>
            <Pressable style={styles.countrySelector} onPress={() => setShowCountryMenu((v) => !v)}>
              <Text style={styles.countrySelectorText}>{countryCode} ▾</Text>
            </Pressable>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="Phone number"
              placeholderTextColor="#8fa1bf"
              style={[styles.loginInput, styles.phoneInput]}
              keyboardType="phone-pad"
            />
          </View>
          {showCountryMenu && (
            <View style={styles.countryMenu}>
              {["+86", "+81", "+1", "+44", "+65"].map((code) => (
                <Pressable
                  key={code}
                  style={styles.countryOption}
                  onPress={() => {
                    setCountryCode(code);
                    setShowCountryMenu(false);
                  }}
                >
                  <Text style={styles.countryOptionText}>{code}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable style={[styles.loginBtn, busy && styles.btnDisabled]} onPress={sendSmsCode} disabled={busy}>
            <Text style={styles.loginBtnText}>{codeSent ? "Resend Code" : "Send Code"}</Text>
          </Pressable>
          <TextInput
            value={smsCodeInput}
            onChangeText={setSmsCodeInput}
            placeholder="SMS verification code"
            placeholderTextColor="#8fa1bf"
            style={styles.loginInput}
            keyboardType="number-pad"
          />
          {!!debugCodeHint && <Text style={styles.loginDevHint}>{debugCodeHint}</Text>}
          <Pressable style={[styles.loginBtn, busy && styles.btnDisabled]} onPress={handleLogin} disabled={busy}>
            <Text style={styles.loginBtnText}>Verify & Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  const avatarFloatY = avatarFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [5, -7],
  });
  const avatarParallaxY = companionScrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [0, -42],
    extrapolate: "clamp",
  });
  const avatarTranslateY = Animated.add(avatarParallaxY, avatarFloatY);
  const rippleScale = speakingRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const rippleOpacity = speakingRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.02],
  });

  return (
    <View style={styles.page}>
      <StatusBar style="light" />

      <View style={styles.devBar}>
        <View style={styles.devBarHeader}>
          <Text style={styles.devMode}>DEV MODE</Text>
          <Text style={styles.closeIcon}>X</Text>
        </View>
        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text numberOfLines={1} style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>
                {tabLabel(tab)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "陪伴" && (
        <View style={styles.sceneContainer}>
          <Animated.ScrollView
            contentContainerStyle={styles.companionWrap}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: companionScrollY } } }], {
              useNativeDriver: true,
            })}
            scrollEventThrottle={16}
          >
            <Animated.View style={[styles.avatarShell, { transform: [{ translateY: avatarTranslateY }] }]}>
              <Image
                source={{ uri: avatarUri || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800" }}
                style={styles.avatar}
              />
            </Animated.View>
            <Text style={styles.avatarName}>小美</Text>
            <Text style={styles.wakeHint}>{t.wakeupHint}</Text>

            <View style={styles.chatPanel}>
              {chatHistory.length === 0 ? (
                <View style={styles.leftBubble}>
                  <Text style={styles.leftBubbleText}>{t.noHistory}</Text>
                </View>
              ) : (
                chatHistory.map((item) => (
                  <View key={item.id} style={item.role === "user" ? styles.rightBubble : styles.leftBubble}>
                    <Text style={item.role === "user" ? styles.rightBubbleText : styles.leftBubbleText}>{item.text}</Text>
                  </View>
                ))
              )}
              <View style={styles.speakingHintWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.speakingRipple,
                    { transform: [{ scale: rippleScale }], opacity: rippleOpacity },
                  ]}
                />
                <Text style={styles.centerHint}>•••• 隨時可以開始說話 ••••</Text>
              </View>
              <Text style={styles.centerHintSmall}>{info}</Text>
              <Text style={styles.actionLog}>{actionLog}</Text>
              <View style={styles.commandBar}>
                <TextInput
                  value={voiceCommand}
                  onChangeText={setVoiceCommand}
                  placeholder="輸入語音指令，例如：明天3點提醒我吃藥"
                  placeholderTextColor="#95a5c7"
                  style={styles.commandInput}
                />
                <Pressable style={styles.commandExecBtn} onPress={executeVoiceCommand}>
                  <Text style={styles.commandExecText}>執行</Text>
                </Pressable>
              </View>
            </View>
          </Animated.ScrollView>
          <View style={styles.bottomTools}>
            <View style={styles.row}>
              <Pressable style={styles.darkBtn} onPress={pickAvatarSource}>
                <Text style={styles.darkBtnText}>{t.uploadPhoto}</Text>
              </Pressable>
              <Pressable style={[styles.greenBtn, busy && styles.btnDisabled]} onPress={generateAvatar} disabled={busy}>
                <Text style={styles.greenBtnText}>{t.genAvatar}</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.darkBtn, busy && styles.btnDisabled]} onPress={registerVoice} disabled={busy}>
                <Text style={styles.darkBtnText}>{t.voiceRegister}</Text>
              </Pressable>
              {listening ? (
                <Pressable
                  style={styles.redBtn}
                  onPress={() => {
                    listeningRef.current = false;
                    setListening(false);
                  }}
                >
                  <Text style={styles.redBtnText}>{t.voiceStop}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.greenBtn, (voiceState !== t.voiceRegistered || busy) && styles.btnDisabled]}
                  onPress={startVoiceMonitoring}
                  disabled={voiceState !== t.voiceRegistered || busy}
                >
                  <Text style={styles.greenBtnText}>{t.voiceStart}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {activeTab === "確認" && (
        <View style={styles.confirmScene}>
          {showConfirmCard ? (
            <View style={styles.confirmSheet}>
              <Text style={styles.confirmLabel}>購物確認</Text>
              <Text style={styles.confirmTitle}>【十月稻田 大米 10斤】</Text>
              <Text style={styles.confirmPrice}>¥39.9</Text>
              <View style={styles.confirmActions}>
                <Pressable style={styles.confirmCancel} onPress={handleCancelOrder}>
                  <Text style={styles.confirmSymbol}>✕</Text>
                </Pressable>
                <Pressable style={styles.confirmAccept} onPress={handleConfirmOrder}>
                  <Text style={styles.confirmSymbol}>✓</Text>
                </Pressable>
              </View>
              <Text style={styles.confirmHint}>您可以說：「確認」或「取消」 · {confirmStatus}</Text>
            </View>
          ) : (
            <View style={styles.confirmDoneBox}>
              <Text style={styles.confirmDoneText}>{confirmStatus}</Text>
              <Pressable style={styles.greenBtn} onPress={() => setShowConfirmCard(true)}>
                <Text style={styles.greenBtnText}>重置確認卡</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {activeTab === "提醒" && (
        <View style={styles.reminderScene}>
          <Text style={styles.reminderTop}>{t.reminderTitle}</Text>
          <Text style={styles.reminderBig}>{t.reminderDefaultTime}</Text>
          <Text style={styles.reminderBig}>{reminderText}</Text>
          <View style={styles.reminderInputPanel}>
            <TextInput
              value={alarmCommand}
              onChangeText={setAlarmCommand}
              style={styles.reminderInput}
              placeholder={t.reminderInputPlaceholder}
              placeholderTextColor="#8b5c00"
            />
            <Pressable style={[styles.reminderSetBtn, busy && styles.btnDisabled]} onPress={scheduleAlarm} disabled={busy}>
              <Text style={styles.reminderSetText}>{t.alarmSet}</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.ackBtn, reminderAcked && styles.ackBtnDone]}
            onPress={() => {
              setReminderAcked(true);
              setInfo(t.reminderAcked);
            }}
          >
            <Text style={styles.ackText}>{t.reminderAckButton}</Text>
          </Pressable>
          <Text style={styles.reminderStatus}>{alarmStatus}</Text>
        </View>
      )}

      {activeTab === "相冊" && (
        <View style={styles.albumScene}>
          <View style={styles.albumFrame}>
            {activePhoto ? (
              <Image source={{ uri: activePhoto.uri }} style={[styles.albumImage, zoomed && styles.albumImageZoom]} />
            ) : (
              <Text style={styles.albumEmpty}>請先讀取相冊</Text>
            )}
          </View>
          <Text style={styles.albumCaption}>{albumCaptionLoading ? t.albumCaptionLoading : albumCaption}</Text>
          <View style={styles.albumActions}>
            <Pressable
              onPress={() => setAlbumIndex((idx) => Math.max(idx - 1, 0))}
              disabled={albumIndex === 0}
              style={styles.albumActionBtn}
            >
              <Text style={styles.albumActionText}>{t.albumPrev}</Text>
            </Pressable>
            <Pressable onPress={() => setZoomed((v) => !v)} style={styles.albumActionBtn}>
              <Text style={styles.albumActionText}>{zoomed ? t.albumZoomOut : t.albumZoomIn}</Text>
            </Pressable>
            <Pressable
              onPress={() => setAlbumIndex((idx) => Math.min(idx + 1, Math.max(photos.length - 1, 0)))}
              disabled={albumIndex >= photos.length - 1}
              style={styles.albumActionBtn}
            >
              <Text style={styles.albumActionText}>{t.albumNext}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {activeTab === "社區" && (
        <View style={styles.communityScene}>
          <View style={styles.communityCard}>
            <Text style={styles.communityTag}>附近活動</Text>
            <Text style={styles.communityTitle}>「快樂太極拳」群組正在活動</Text>
            <Text style={styles.communitySub}>要打個招呼嗎？</Text>
            <Pressable style={styles.joinBtn} onPress={() => setCommunityChoice("已加入他們")}>
              <Text style={styles.joinBtnText}>✓ 加入他們</Text>
            </Pressable>
            <Pressable style={styles.laterBtn} onPress={() => setCommunityChoice("稍後再說")}>
              <Text style={styles.laterBtnText}>下次再說</Text>
            </Pressable>
            <Text style={styles.communityHint}>您可以說：「加入」或「下次」 · {communityChoice}</Text>
          </View>
        </View>
      )}

      {activeTab === "檔案" && (
        <ScrollView style={styles.profileScene} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text style={styles.profileTitle}>{t.profileTitle}</Text>
          <Text style={styles.profileLabel}>{t.profileGenderLabel}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.profileOption, profileGender === "male" && styles.profileOptionActive]}
              onPress={() => setProfileGender("male")}
            >
              <Text style={[styles.profileOptionText, profileGender === "male" && styles.profileOptionTextActive]}>
                {t.genderMale}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.profileOption, profileGender === "female" && styles.profileOptionActive]}
              onPress={() => setProfileGender("female")}
            >
              <Text style={[styles.profileOptionText, profileGender === "female" && styles.profileOptionTextActive]}>
                {t.genderFemale}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.profileLabel}>{t.profileAgeLabel}</Text>
          <View style={styles.wrapRow}>
            {[
              { id: "60-70", label: t.ageRange60_70 },
              { id: "70-80", label: t.ageRange70_80 },
              { id: "80-90", label: t.ageRange80_90 },
              { id: "90+", label: t.ageRange90Plus },
            ].map((age) => (
              <Pressable
                key={age.id}
                style={[styles.ageChip, profileAge === age.id && styles.profileOptionActive]}
                onPress={() => setProfileAge(age.id as "60-70" | "70-80" | "80-90" | "90+")}
              >
                <Text style={[styles.profileOptionText, profileAge === age.id && styles.profileOptionTextActive]}>
                  {age.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.profileLabel}>{t.profileConditionLabel}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.profileOption, hasCondition === "yes" && styles.profileOptionActive]}
              onPress={() => setHasCondition("yes")}
            >
              <Text style={[styles.profileOptionText, hasCondition === "yes" && styles.profileOptionTextActive]}>
                {t.conditionYes}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.profileOption, hasCondition === "no" && styles.profileOptionActive]}
              onPress={() => setHasCondition("no")}
            >
              <Text style={[styles.profileOptionText, hasCondition === "no" && styles.profileOptionTextActive]}>
                {t.conditionNo}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.nextBtn} onPress={saveProfile}>
            <Text style={styles.nextBtnText}>{t.profileNext}</Text>
          </Pressable>
        </ScrollView>
      )}

      {false ? <Text style={styles.bottomStatus}>頻道：{channel} · 聲紋：{voiceState} · API：{resolvedApiBase}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loginPage: { flex: 1, backgroundColor: "#0f1b35", justifyContent: "center", padding: 20 },
  loginCard: { backgroundColor: "#1c2b4a", borderRadius: 18, padding: 18 },
  loginTitle: { color: "#f8fafc", fontSize: 26, fontWeight: "700", marginBottom: 8 },
  loginHint: { color: "#9fb0cf", fontSize: 14, marginBottom: 14 },
  phoneRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  countrySelector: {
    height: 44,
    width: 108,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33496f",
    backgroundColor: "#13233f",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  countrySelectorText: { color: "#f8fafc", fontSize: 14, fontWeight: "600" },
  countryMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33496f",
    backgroundColor: "#13233f",
    marginBottom: 10,
    overflow: "hidden",
  },
  countryOption: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#213556" },
  countryOptionText: { color: "#d8e6ff", fontSize: 14 },
  loginInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#33496f",
    backgroundColor: "#13233f",
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 0,
    textAlignVertical: "center",
    marginBottom: 10,
  },
  phoneInput: { flex: 1, minWidth: 0, marginBottom: 0 },
  loginBtn: { backgroundColor: "#19b889", borderRadius: 12, alignItems: "center", paddingVertical: 12 },
  loginBtnText: { color: "#ecfffa", fontSize: 16, fontWeight: "700" },
  loginDevHint: { color: "#facc15", fontSize: 12, marginBottom: 10 },
  page: { flex: 1, backgroundColor: "#ece9df" },
  devBar: {
    marginTop: 10,
    marginHorizontal: 8,
    backgroundColor: "#1b2745",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 20,
  },
  devBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  devMode: { color: "#8d97ab", fontWeight: "700", fontSize: 19 },
  closeIcon: { color: "#8d97ab", fontWeight: "700", fontSize: 18 },
  tabRow: { flexDirection: "row", gap: 6 },
  tabPill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#2a3858",
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 14,
    alignItems: "center",
  },
  tabPillActive: { backgroundColor: "#f4f5f7" },
  tabPillText: { color: "#f1f5f9", fontWeight: "700", fontSize: 13 },
  tabPillTextActive: { color: "#1f2937" },

  sceneContainer: { flex: 1 },
  companionWrap: { paddingBottom: 220 },
  avatarShell: {
    width: 208,
    height: 208,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#e4edf9",
    alignSelf: "center",
    marginTop: 12,
    shadowColor: "#2f5ea4",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  avatar: { width: "100%", height: "100%" },
  avatarName: { textAlign: "center", marginTop: 10, color: "#1d3563", fontSize: 24, fontWeight: "700" },
  wakeHint: { textAlign: "center", marginTop: 6, color: "#6380ad", fontSize: 18 },
  chatPanel: {
    marginTop: 20,
    backgroundColor: "#08142d",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    minHeight: 500,
    paddingHorizontal: 22,
    paddingTop: 26,
  },
  leftBubble: {
    backgroundColor: "#2b3d5f",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: "flex-start",
    maxWidth: "88%",
  },
  leftBubbleText: { color: "#f1f5f9", fontSize: 20, lineHeight: 28, fontWeight: "600" },
  rightBubble: {
    backgroundColor: "#14b989",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  rightBubbleText: { color: "#f2fff9", fontSize: 20, lineHeight: 28, fontWeight: "700" },
  speakingHintWrap: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
    minWidth: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  speakingRipple: {
    position: "absolute",
    width: "100%",
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#6f8bb8",
    backgroundColor: "rgba(94, 122, 168, 0.12)",
  },
  centerHint: { color: "#7e90b4", textAlign: "center", marginTop: 10, fontSize: 15, fontWeight: "700" },
  centerHintSmall: { color: "#7e90b4", textAlign: "center", marginTop: 8, marginBottom: 14, fontSize: 13 },
  actionLog: { color: "#c6d4f4", textAlign: "center", marginBottom: 8, fontSize: 12 },
  commandBar: { marginTop: 6 },
  commandInput: {
    backgroundColor: "#16284f",
    borderColor: "#2b3e6e",
    borderWidth: 1,
    color: "#f8fafc",
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 8,
  },
  commandExecBtn: { backgroundColor: "#3b82f6", borderRadius: 10, alignItems: "center", paddingVertical: 8 },
  commandExecText: { color: "#eff6ff", fontSize: 14, fontWeight: "700" },
  bottomTools: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    backgroundColor: "#0f1f3e",
    padding: 12,
    borderRadius: 16,
  },
  row: { flexDirection: "row", gap: 12, marginBottom: 10 },
  darkBtn: { flex: 1, backgroundColor: "#3a4865", borderRadius: 16, alignItems: "center", paddingVertical: 13 },
  darkBtnText: { color: "#eef2ff", fontSize: 15, fontWeight: "700" },
  greenBtn: { flex: 1, backgroundColor: "#18b888", borderRadius: 16, alignItems: "center", paddingVertical: 13 },
  greenBtnText: { color: "#edfff8", fontSize: 15, fontWeight: "700" },
  redBtn: { flex: 1, backgroundColor: "#ff2c3c", borderRadius: 16, alignItems: "center", paddingVertical: 13 },
  redBtnText: { color: "#fff3f3", fontSize: 15, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },

  confirmScene: { flex: 1, backgroundColor: "#e8e6dd" },
  confirmSheet: {
    marginTop: 220,
    backgroundColor: "#f0f0f1",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 22,
    flex: 1,
  },
  confirmLabel: { textAlign: "center", color: "#6f7f95", fontSize: 22, fontWeight: "600" },
  confirmTitle: { textAlign: "center", color: "#0f2344", fontSize: 34, fontWeight: "800", marginTop: 18 },
  confirmPrice: {
    alignSelf: "center",
    marginTop: 20,
    backgroundColor: "#eedfe0",
    color: "#ec0018",
    fontSize: 46,
    fontWeight: "900",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  confirmActions: { flexDirection: "row", gap: 20, marginTop: 30 },
  confirmCancel: { flex: 1, backgroundColor: "#ff2c3c", borderRadius: 24, alignItems: "center", paddingVertical: 22 },
  confirmAccept: { flex: 1, backgroundColor: "#10b981", borderRadius: 24, alignItems: "center", paddingVertical: 22 },
  confirmSymbol: { color: "#f8fafc", fontSize: 44, fontWeight: "700" },
  confirmHint: { textAlign: "center", color: "#8da0c0", fontSize: 16, marginTop: 16 },
  confirmDoneBox: { marginTop: 240, padding: 20, alignItems: "center", gap: 14 },
  confirmDoneText: { color: "#0f2344", fontSize: 24, fontWeight: "700" },

  reminderScene: { flex: 1, backgroundColor: "#f7ac00", alignItems: "center", paddingTop: 120, paddingHorizontal: 20 },
  reminderTop: { fontSize: 30, color: "#fff5dc", fontWeight: "600", marginBottom: 18 },
  reminderBig: { fontSize: 48, color: "#ffffff", fontWeight: "900", textAlign: "center", marginBottom: 8 },
  reminderInputPanel: { width: "100%", marginTop: 40, marginBottom: 20 },
  reminderInput: {
    backgroundColor: "#ffd46a",
    borderRadius: 18,
    height: 62,
    paddingHorizontal: 16,
    color: "#3d2a00",
    fontSize: 15,
    marginBottom: 12,
  },
  reminderSetBtn: { backgroundColor: "#ffe9b5", borderRadius: 18, paddingVertical: 14, alignItems: "center" },
  reminderSetText: { color: "#3d2a00", fontSize: 18, fontWeight: "700" },
  ackBtn: {
    marginTop: "auto",
    marginBottom: 24,
    width: "100%",
    backgroundColor: "#efefef",
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 20,
    borderWidth: 8,
    borderColor: "#f8c96f",
  },
  ackBtnDone: { backgroundColor: "#e6fff5" },
  ackText: { color: "#0f2d58", fontSize: 30, fontWeight: "900" },
  reminderStatus: { color: "#553000", fontSize: 14, marginBottom: 8 },

  albumScene: { flex: 1, backgroundColor: "#050608", paddingTop: 120, paddingHorizontal: 20, alignItems: "center" },
  albumFrame: {
    width: "92%",
    height: 320,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: "#2c313a",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 34,
  },
  albumImage: { width: "100%", height: "100%" },
  albumImageZoom: { transform: [{ scale: 1.18 }] },
  albumEmpty: { color: "#7d8593", fontSize: 20 },
  albumCaption: { color: "#d8dde4", fontSize: 24, lineHeight: 34, textAlign: "center", marginTop: 22 },
  albumActions: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 16 },
  albumActionBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  albumActionText: { color: "#9ca3af", fontSize: 18 },

  communityScene: { flex: 1, backgroundColor: "#e8e6dd", justifyContent: "flex-end" },
  communityCard: {
    backgroundColor: "#f0f0f1",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  communityTag: {
    alignSelf: "center",
    backgroundColor: "#d4f5e9",
    color: "#1a8163",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 18,
    fontWeight: "700",
  },
  communityTitle: { textAlign: "center", color: "#0f2344", fontSize: 30, fontWeight: "800", lineHeight: 40, marginTop: 16 },
  communitySub: { textAlign: "center", color: "#62748e", fontSize: 24, marginTop: 12 },
  joinBtn: { marginTop: 22, backgroundColor: "#10b981", borderRadius: 22, alignItems: "center", paddingVertical: 18 },
  joinBtnText: { color: "#f4fffc", fontSize: 28, fontWeight: "800" },
  laterBtn: { marginTop: 14, backgroundColor: "#d9dee5", borderRadius: 22, alignItems: "center", paddingVertical: 18 },
  laterBtnText: { color: "#586b86", fontSize: 26, fontWeight: "700" },
  communityHint: { textAlign: "center", color: "#8da0c0", fontSize: 16, marginTop: 16 },

  profileScene: { flex: 1, backgroundColor: "#efeff0", paddingHorizontal: 14, paddingTop: 16 },
  profileTitle: { textAlign: "center", fontSize: 34, color: "#0f2344", fontWeight: "800", marginVertical: 18 },
  profileLabel: { color: "#274063", fontSize: 24, marginBottom: 10, marginTop: 8 },
  profileOption: {
    flex: 1,
    backgroundColor: "#d9dee5",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 70,
    paddingHorizontal: 10,
  },
  profileOptionActive: { backgroundColor: "#10b981" },
  profileOptionText: { color: "#1c365b", fontSize: 24, fontWeight: "700" },
  profileOptionTextActive: { color: "#f2fffb" },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  ageChip: {
    width: "48%",
    backgroundColor: "#d9dee5",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 66,
  },
  nextBtn: { marginTop: 28, backgroundColor: "#10b981", borderRadius: 18, alignItems: "center", paddingVertical: 18 },
  nextBtnText: { color: "#f2fffb", fontSize: 28, fontWeight: "800" },

  bottomStatus: {
    position: "absolute",
    bottom: 4,
    left: 8,
    right: 8,
    textAlign: "center",
    color: "#8290a8",
    fontSize: 18,
  },
});
