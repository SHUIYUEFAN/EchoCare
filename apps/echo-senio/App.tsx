import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import * as Calendar from "expo-calendar";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { familyRoomChannel } from "@echocare/shared";

type AppTab = "陪伴" | "確認" | "提醒" | "相冊" | "社區" | "檔案";
type PhotoPreview = { id: string; uri: string; created?: string };
type ParsedAlarm = { triggerAt: Date; message: string };

const tabs: AppTab[] = ["陪伴", "確認", "提醒", "相冊", "社區", "檔案"];

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
  const [activeTab, setActiveTab] = useState<AppTab>("陪伴");
  const [info, setInfo] = useState("說「小美」來喚醒我");
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState("未註冊");
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);

  const [sourcePhotoUri, setSourcePhotoUri] = useState("");
  const [avatarUri, setAvatarUri] = useState("");

  const [alarmCommand, setAlarmCommand] = useState("明天下午3點提醒我吃降壓藥");
  const [alarmStatus, setAlarmStatus] = useState("尚未設定");
  const [reminderText, setReminderText] = useState("下午3:00 吃降壓藥！");
  const [reminderAcked, setReminderAcked] = useState(false);

  const [confirmStatus, setConfirmStatus] = useState("等待確認");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [albumIndex, setAlbumIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [communityChoice, setCommunityChoice] = useState("尚未決定");

  const [profileGender, setProfileGender] = useState<"男" | "女" | "">("");
  const [profileAge, setProfileAge] = useState("");
  const [hasCondition, setHasCondition] = useState<"有" | "沒有" | "">("");
  const [voiceCommand, setVoiceCommand] = useState("");
  const [showConfirmCard, setShowConfirmCard] = useState(true);
  const [actionLog, setActionLog] = useState("等待操作");

  const unsupportedOnWeb = Platform.OS === "web";
  const apiBase =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    (Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001");

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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const feedback = (message: string, title = "提示") => {
    setInfo(message);
    setActionLog(message);
    Alert.alert(title, message);
  };

  const recordClip = async (durationMs: number) => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) throw new Error("未授予麥克風權限");
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    await sleep(durationMs);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) throw new Error("錄音失敗");
    return uri;
  };

  const parseAlarmCommand = (raw: string): ParsedAlarm => {
    const text = raw.replace(/\s+/g, "");
    const now = new Date();
    const hmMatch = text.match(/(\d{1,2})(?:[:：]|點)([0-5]?\d|半)?(?:分)?/);
    if (!hmMatch) throw new Error("沒聽懂時間，請說「明天早上7點半提醒我吃藥」");
    let hour = Number(hmMatch[1]);
    let minute = hmMatch[2] === "半" ? 30 : hmMatch[2] ? Number(hmMatch[2]) : 0;
    if (/下午|晚上/.test(text) && hour < 12) hour += 12;
    if (/凌晨/.test(text) && hour === 12) hour = 0;
    const dayOffset = /後天/.test(text) ? 2 : /明天/.test(text) ? 1 : 0;
    const triggerAt = new Date(now);
    triggerAt.setDate(now.getDate() + dayOffset);
    triggerAt.setHours(hour, minute, 0, 0);
    if (dayOffset === 0 && triggerAt <= now) triggerAt.setDate(triggerAt.getDate() + 1);
    const message = text.match(/提醒(?:我)?(.+)/)?.[1] || "時間到囉";
    return { triggerAt, message };
  };

  const scheduleAlarm = async () => {
    if (unsupportedOnWeb) {
      feedback("Web 不支援本地提醒，請用 Android/iOS");
      return;
    }
    try {
      setBusy(true);
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) throw new Error("未授予通知權限");
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
      feedback("提醒已建立成功");
      setActiveTab("提醒");
    } catch (error) {
      const message = error instanceof Error ? error.message : "設定提醒失敗";
      setAlarmStatus(`設定失敗：${message}`);
      feedback(message, "提醒設定失敗");
    } finally {
      setBusy(false);
    }
  };

  const pickAvatarSource = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        feedback("未授予相簿權限，無法選擇照片");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        base64: false,
      });
      if (!result.canceled) {
        setSourcePhotoUri(result.assets[0].uri);
        feedback("已選擇照片，可以生成形象");
      }
    } catch (error) {
      feedback(error instanceof Error ? error.message : "打開相冊失敗");
    }
  };

  const generateAvatar = async () => {
    if (!sourcePhotoUri) {
      setInfo("請先上傳人物照片");
      return;
    }
    try {
      setBusy(true);
      const imageBase64 = await FileSystem.readAsStringAsync(sourcePhotoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await fetch(`${apiBase}/v1/avatar/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const payload = (await response.json()) as { imageDataUrl?: string };
      if (!response.ok || !payload.imageDataUrl) throw new Error("卡通形象生成失敗");
      setAvatarUri(payload.imageDataUrl);
      feedback("已生成 AI 2D 形象");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "生成失敗", "生成失敗");
    } finally {
      setBusy(false);
    }
  };

  const registerVoice = async () => {
    if (unsupportedOnWeb) {
      feedback("Web 不支援麥克風錄音");
      return;
    }
    try {
      setBusy(true);
      setVoiceState("註冊中...");
      const clipUri = await recordClip(3500);
      const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await fetch(`${apiBase}/v1/voice/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId: "demo-family", profileId: "elder-main", audioBase64 }),
      });
      const payload = (await response.json()) as { success?: boolean };
      if (!response.ok || !payload.success) throw new Error("聲紋註冊失敗");
      setVoiceState("已註冊");
      feedback("聲紋註冊成功");
    } catch (error) {
      setVoiceState("註冊失敗");
      feedback(error instanceof Error ? error.message : "聲紋註冊失敗", "註冊失敗");
    } finally {
      setBusy(false);
    }
  };

  const startVoiceMonitoring = async () => {
    if (unsupportedOnWeb) {
      feedback("Web 不支援麥克風錄音");
      return;
    }
    if (voiceState !== "已註冊") {
      feedback("請先註冊聲紋再開啟監聽");
      return;
    }
    listeningRef.current = true;
    setListening(true);
    setActionLog("監聽已開啟");
    while (listeningRef.current) {
      try {
        const clipUri = await recordClip(3000);
        const audioBase64 = await FileSystem.readAsStringAsync(clipUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const response = await fetch(`${apiBase}/v1/voice/verify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ familyId: "demo-family", profileId: "elder-main", audioBase64 }),
        });
        const payload = (await response.json()) as { matched: boolean; score: number };
        if (payload.matched) {
          setInfo(`已識別註冊用戶（${payload.score.toFixed(2)}）`);
          setActionLog(`識別成功（${payload.score.toFixed(2)}）`);
        } else {
          setInfo(`未匹配（${payload.score.toFixed(2)}）`);
          setActionLog(`未匹配（${payload.score.toFixed(2)}）`);
        }
      } catch {
        feedback("監聽中斷", "監聽");
        break;
      }
    }
    listeningRef.current = false;
    setListening(false);
    setActionLog("監聽已停止");
  };

  const readLatestPhotos = async () => {
    if (unsupportedOnWeb) {
      feedback("Web 不支援相冊 API");
      return;
    }
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) throw new Error("未授予相冊權限");
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
      setAlbumIndex(0);
      feedback(`已載入 ${mapped.length} 張照片`);
      setActiveTab("相冊");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "讀取相冊失敗", "相冊");
    }
  };

  const loadTodayEventAsReminder = async () => {
    if (unsupportedOnWeb) {
      feedback("Web 不支援日曆 API");
      return;
    }
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (!permission.granted) throw new Error("未授予日曆權限");
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
      if (!first) throw new Error("今天沒有日程");
      setReminderText(first.title || "行程提醒");
      setReminderAcked(false);
      setActiveTab("提醒");
      feedback("已從日曆生成提醒");
    } catch (error) {
      feedback(error instanceof Error ? error.message : "讀取日曆失敗", "日曆");
    }
  };

  const handleConfirmOrder = async () => {
    setConfirmStatus("已確認，準備下單");
    setShowConfirmCard(false);
    feedback("已為您確認商品，正在提交代購訂單");
    setActiveTab("陪伴");
  };

  const handleCancelOrder = () => {
    setConfirmStatus("已取消");
    setShowConfirmCard(false);
    feedback("已取消本次代購");
    setActiveTab("陪伴");
  };

  const saveProfile = () => {
    if (!profileGender || !profileAge || !hasCondition) {
      feedback("請先完成基本資料");
      return;
    }
    feedback(`資料已保存：${profileGender} / ${profileAge} / 基礎病${hasCondition}`);
    setActiveTab("陪伴");
  };

  const executeVoiceCommand = async () => {
    const cmd = voiceCommand.trim();
    if (!cmd) return;
    if (cmd.includes("確認")) return handleConfirmOrder();
    if (cmd.includes("取消")) return handleCancelOrder();
    if (cmd.includes("提醒") || cmd.includes("鬧鐘")) return scheduleAlarm();
    if (cmd.includes("相冊") || cmd.includes("照片")) return readLatestPhotos();
    if (cmd.includes("日曆")) return loadTodayEventAsReminder();
    if (cmd.includes("加入")) {
      setCommunityChoice("已加入他們");
      setInfo("已幫您加入活動");
      return;
    }
    if (cmd.includes("下次")) {
      setCommunityChoice("稍後再說");
      setInfo("好的，下次再提醒您");
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
    feedback(`未識別指令：「${cmd}」`);
  };

  const activePhoto = photos[albumIndex];

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
              <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === "陪伴" && (
        <View style={styles.sceneContainer}>
          <ScrollView contentContainerStyle={styles.companionWrap}>
            <View style={styles.avatarShell}>
              <Image
                source={{ uri: avatarUri || "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800" }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.avatarName}>小美</Text>
            <Text style={styles.wakeHint}>說「小美」來喚醒我</Text>

            <View style={styles.chatPanel}>
              <View style={styles.leftBubble}>
                <Text style={styles.leftBubbleText}>爸，今天降溫了，記得多穿件衣服。</Text>
              </View>
              <View style={styles.rightBubble}>
                <Text style={styles.rightBubbleText}>好的，我知道了。</Text>
              </View>
              <View style={styles.leftBubble}>
                <Text style={styles.leftBubbleText}>下午三點要吃降壓藥，我會提醒您的。</Text>
              </View>
              <Text style={styles.centerHint}>•••• 隨時可以開始說話 ••••</Text>
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
          </ScrollView>
          <View style={styles.bottomTools}>
            <View style={styles.row}>
              <Pressable style={styles.darkBtn} onPress={pickAvatarSource}>
                <Text style={styles.darkBtnText}>上傳照片</Text>
              </Pressable>
              <Pressable style={[styles.greenBtn, busy && styles.btnDisabled]} onPress={generateAvatar} disabled={busy}>
                <Text style={styles.greenBtnText}>生成形象</Text>
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.darkBtn, busy && styles.btnDisabled]} onPress={registerVoice} disabled={busy}>
                <Text style={styles.darkBtnText}>註冊聲紋</Text>
              </Pressable>
              {listening ? (
                <Pressable
                  style={styles.redBtn}
                  onPress={() => {
                    listeningRef.current = false;
                    setListening(false);
                  }}
                >
                  <Text style={styles.redBtnText}>停止監聽</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.greenBtn, (voiceState !== "已註冊" || busy) && styles.btnDisabled]}
                  onPress={startVoiceMonitoring}
                  disabled={voiceState !== "已註冊" || busy}
                >
                  <Text style={styles.greenBtnText}>開啟監聽</Text>
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
          <Text style={styles.reminderTop}>用藥提醒</Text>
          <Text style={styles.reminderBig}>下午 3:00</Text>
          <Text style={styles.reminderBig}>{reminderText}</Text>
          <View style={styles.reminderInputPanel}>
            <TextInput
              value={alarmCommand}
              onChangeText={setAlarmCommand}
              style={styles.reminderInput}
              placeholder="明天下午3點提醒我吃降壓藥"
              placeholderTextColor="#8b5c00"
            />
            <Pressable style={[styles.reminderSetBtn, busy && styles.btnDisabled]} onPress={scheduleAlarm} disabled={busy}>
              <Text style={styles.reminderSetText}>設定提醒</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.ackBtn, reminderAcked && styles.ackBtnDone]}
            onPress={() => {
              setReminderAcked(true);
              setInfo("已確認提醒");
            }}
          >
            <Text style={styles.ackText}>{reminderAcked ? "✓ 我知道了" : "✓ 我知道了"}</Text>
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
          <Text style={styles.albumCaption}>
            「這是 {activePhoto?.created || "1990 年"} 在老家的合影，那時候您剛退休...」
          </Text>
          <View style={styles.albumActions}>
            <Pressable
              onPress={() => setAlbumIndex((idx) => Math.max(idx - 1, 0))}
              disabled={albumIndex === 0}
              style={styles.albumActionBtn}
            >
              <Text style={styles.albumActionText}>‹ 上一張</Text>
            </Pressable>
            <Pressable onPress={() => setZoomed((v) => !v)} style={styles.albumActionBtn}>
              <Text style={styles.albumActionText}>{zoomed ? "縮小" : "放大"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setAlbumIndex((idx) => Math.min(idx + 1, Math.max(photos.length - 1, 0)))}
              disabled={albumIndex >= photos.length - 1}
              style={styles.albumActionBtn}
            >
              <Text style={styles.albumActionText}>下一張 ›</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            <Pressable style={styles.darkBtn} onPress={readLatestPhotos}>
              <Text style={styles.darkBtnText}>讀取相冊</Text>
            </Pressable>
            <Pressable style={styles.darkBtn} onPress={loadTodayEventAsReminder}>
              <Text style={styles.darkBtnText}>讀取日曆</Text>
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
          <Text style={styles.profileTitle}>基本資料</Text>
          <Text style={styles.profileLabel}>性別</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.profileOption, profileGender === "男" && styles.profileOptionActive]}
              onPress={() => setProfileGender("男")}
            >
              <Text style={[styles.profileOptionText, profileGender === "男" && styles.profileOptionTextActive]}>男</Text>
            </Pressable>
            <Pressable
              style={[styles.profileOption, profileGender === "女" && styles.profileOptionActive]}
              onPress={() => setProfileGender("女")}
            >
              <Text style={[styles.profileOptionText, profileGender === "女" && styles.profileOptionTextActive]}>女</Text>
            </Pressable>
          </View>

          <Text style={styles.profileLabel}>年齡</Text>
          <View style={styles.wrapRow}>
            {["60-70歲", "70-80歲", "80-90歲", "90+歲"].map((age) => (
              <Pressable
                key={age}
                style={[styles.ageChip, profileAge === age && styles.profileOptionActive]}
                onPress={() => setProfileAge(age)}
              >
                <Text style={[styles.profileOptionText, profileAge === age && styles.profileOptionTextActive]}>{age}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.profileLabel}>是否有基礎病？</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.profileOption, hasCondition === "有" && styles.profileOptionActive]}
              onPress={() => setHasCondition("有")}
            >
              <Text style={[styles.profileOptionText, hasCondition === "有" && styles.profileOptionTextActive]}>有</Text>
            </Pressable>
            <Pressable
              style={[styles.profileOption, hasCondition === "沒有" && styles.profileOptionActive]}
              onPress={() => setHasCondition("沒有")}
            >
              <Text style={[styles.profileOptionText, hasCondition === "沒有" && styles.profileOptionTextActive]}>沒有</Text>
            </Pressable>
          </View>

          <Pressable style={styles.nextBtn} onPress={saveProfile}>
            <Text style={styles.nextBtnText}>下一步</Text>
          </Pressable>
        </ScrollView>
      )}

      <Text style={styles.bottomStatus}>頻道：{channel} · 聲紋：{voiceState}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eae7dd" },
  devBar: {
    marginTop: 10,
    marginHorizontal: 8,
    backgroundColor: "#1a2540",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 20,
  },
  devBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  devMode: { color: "#8d97ab", fontWeight: "700", fontSize: 19 },
  closeIcon: { color: "#8d97ab", fontWeight: "700", fontSize: 18 },
  tabRow: { flexDirection: "row", gap: 8 },
  tabPill: {
    backgroundColor: "#2d3a57",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  tabPillActive: { backgroundColor: "#f4f5f7" },
  tabPillText: { color: "#f1f5f9", fontWeight: "700", fontSize: 16 },
  tabPillTextActive: { color: "#1f2937" },

  sceneContainer: { flex: 1 },
  companionWrap: { paddingBottom: 220 },
  avatarShell: {
    width: 208,
    height: 208,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#e8eef8",
    alignSelf: "center",
    marginTop: 12,
  },
  avatar: { width: "100%", height: "100%" },
  avatarName: { textAlign: "center", marginTop: 10, color: "#1d3563", fontSize: 24, fontWeight: "700" },
  wakeHint: { textAlign: "center", marginTop: 6, color: "#6380ad", fontSize: 18 },
  chatPanel: {
    marginTop: 20,
    backgroundColor: "#000b2e",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    minHeight: 500,
    paddingHorizontal: 22,
    paddingTop: 26,
  },
  leftBubble: {
    backgroundColor: "#283753",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: "flex-start",
    maxWidth: "88%",
  },
  leftBubbleText: { color: "#f1f5f9", fontSize: 20, lineHeight: 28, fontWeight: "600" },
  rightBubble: {
    backgroundColor: "#12b980",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  rightBubbleText: { color: "#f2fff9", fontSize: 20, lineHeight: 28, fontWeight: "700" },
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
    backgroundColor: "#0b1d3a",
    padding: 12,
    borderRadius: 16,
  },
  row: { flexDirection: "row", gap: 12, marginBottom: 10 },
  darkBtn: { flex: 1, backgroundColor: "#34415c", borderRadius: 16, alignItems: "center", paddingVertical: 13 },
  darkBtnText: { color: "#eef2ff", fontSize: 15, fontWeight: "700" },
  greenBtn: { flex: 1, backgroundColor: "#10b981", borderRadius: 16, alignItems: "center", paddingVertical: 13 },
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
