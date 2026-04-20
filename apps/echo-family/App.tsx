import { StatusBar } from "expo-status-bar";
import * as Calendar from "expo-calendar";
import * as MediaLibrary from "expo-media-library";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { echoTokens, familyRoomChannel } from "@echocare/shared";

type PhotoPreview = { id: string; uri: string; created?: string };
type EventPreview = { id: string; title: string; start?: string };

export default function App() {
  const demoChannel = useMemo(() => familyRoomChannel("demo-family"), []);
  const [info, setInfo] = useState<string>("点击下面按钮开始读取");
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [events, setEvents] = useState<EventPreview[]>([]);

  const unsupportedOnWeb = Platform.OS === "web";

  const readLatestPhotos = async () => {
    if (unsupportedOnWeb) {
      setInfo("Web 端不支持相册原生 API，请在 Android/iOS 运行。");
      return;
    }

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      setInfo("未授予相册权限");
      return;
    }

    const res = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: 8,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    setPhotos(
      res.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        created: asset.creationTime ? new Date(asset.creationTime).toLocaleString() : undefined,
      }))
    );
    setInfo(`已读取 ${res.assets.length} 张照片`);
  };

  const readUpcomingEvents = async () => {
    if (unsupportedOnWeb) {
      setInfo("Web 端不支持日历原生 API，请在 Android/iOS 运行。");
      return;
    }

    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (!permission.granted) {
      setInfo("未授予日历权限");
      return;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) {
      setEvents([]);
      setInfo("没有可用日历");
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 14);
    const allEvents = await Calendar.getEventsAsync(
      calendars.map((c) => c.id),
      start,
      end
    );

    const sorted = allEvents
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      .slice(0, 8)
      .map((event) => ({
        id: event.id,
        title: event.title || "(无标题)",
        start: event.startDate ? new Date(event.startDate).toLocaleString() : undefined,
      }));

    setEvents(sorted);
    setInfo(`已读取未来 14 天 ${sorted.length} 个日历事件`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EchoCare</Text>
        <Text style={styles.headerSub}>家庭中枢</Text>
      </View>

      <ScrollView contentContainerStyle={styles.chatArea}>
        <View style={styles.botBubble}>
          <Text style={styles.bubbleLabel}>EchoCare</Text>
          <Text style={styles.botText}>可以从父母设备读取相册与日历，后续接入远程投喂与提醒编排。</Text>
        </View>

        <View style={styles.userBubble}>
          <Text style={styles.userText}>{info}</Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>同步状态</Text>
          <Text style={styles.statusMeta}>频道：{demoChannel}</Text>
          <Text style={styles.statusMeta}>相册条目：{photos.length}</Text>
          <Text style={styles.statusMeta}>日历条目：{events.length}</Text>
        </View>

        <Text style={styles.sectionTitle}>最近照片</Text>
        {photos.map((p) => (
          <View key={p.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{p.created || "未知时间"}</Text>
            <Text style={styles.itemDesc}>{p.uri}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>未来 14 天日历</Text>
        {events.map((e) => (
          <View key={e.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{e.title}</Text>
            <Text style={styles.itemDesc}>{e.start || "无时间"}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.toolPanel}>
        <View style={styles.row}>
          <Pressable style={styles.toolButton} onPress={readLatestPhotos}>
            <Text style={styles.toolButtonText}>读取相册</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={readUpcomingEvents}>
            <Text style={styles.primaryText}>读取日历</Text>
          </Pressable>
        </View>
      </View>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: echoTokens.colors.bg },
  header: {
    paddingTop: 60,
    paddingBottom: echoTokens.spacing.lg,
    paddingHorizontal: echoTokens.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: echoTokens.colors.surfaceMuted,
    backgroundColor: echoTokens.colors.surface,
  },
  headerTitle: { color: echoTokens.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  headerSub: { color: echoTokens.colors.textSecondary, fontSize: 13, marginTop: echoTokens.spacing.xs },
  chatArea: {
    padding: echoTokens.spacing.lg,
    paddingBottom: echoTokens.spacing.xxl,
  },
  botBubble: {
    maxWidth: "92%",
    backgroundColor: echoTokens.colors.surfaceMuted,
    borderRadius: echoTokens.radius.xl,
    paddingHorizontal: echoTokens.spacing.lg,
    paddingVertical: echoTokens.spacing.md,
    marginBottom: echoTokens.spacing.md,
  },
  bubbleLabel: { color: "#93c5fd", fontSize: 12, marginBottom: 4 },
  botText: { color: echoTokens.colors.textPrimary, fontSize: 15, lineHeight: 21 },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "92%",
    backgroundColor: echoTokens.colors.accent,
    borderRadius: echoTokens.radius.xl,
    paddingHorizontal: echoTokens.spacing.lg,
    paddingVertical: echoTokens.spacing.md,
    marginBottom: echoTokens.spacing.md,
  },
  userText: { color: echoTokens.colors.textOnAccent, fontSize: 15, lineHeight: 20 },
  statusCard: {
    backgroundColor: echoTokens.colors.surface,
    borderWidth: 1,
    borderColor: echoTokens.colors.border,
    borderRadius: echoTokens.radius.lg,
    padding: echoTokens.spacing.md,
    marginBottom: echoTokens.spacing.md,
  },
  statusTitle: { color: echoTokens.colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 6 },
  statusMeta: { color: echoTokens.colors.textSecondary, fontSize: 12 },
  sectionTitle: { marginTop: 8, marginBottom: 6, fontWeight: "700", color: "#e5e7eb" },
  itemCard: {
    backgroundColor: echoTokens.colors.surface,
    borderRadius: echoTokens.radius.md,
    borderWidth: 1,
    borderColor: echoTokens.colors.surfaceMuted,
    padding: echoTokens.spacing.sm,
    marginBottom: echoTokens.spacing.sm,
  },
  itemTitle: { color: echoTokens.colors.textPrimary, fontSize: 13, marginBottom: 3 },
  itemDesc: { fontSize: 12, lineHeight: 17, color: echoTokens.colors.textSecondary },
  toolPanel: {
    paddingHorizontal: echoTokens.spacing.lg,
    paddingTop: echoTokens.spacing.sm,
    paddingBottom: echoTokens.spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: echoTokens.colors.surfaceMuted,
    backgroundColor: "#0f172a",
  },
  row: { flexDirection: "row", gap: echoTokens.spacing.sm },
  toolButton: {
    backgroundColor: echoTokens.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: echoTokens.colors.border,
    borderRadius: echoTokens.radius.lg,
    paddingHorizontal: 22,
    height: echoTokens.button.heightMd,
    justifyContent: "center",
  },
  toolButtonText: { color: "#e5e7eb", fontWeight: "600", fontSize: 15 },
  primaryButton: {
    backgroundColor: echoTokens.colors.accent,
    borderRadius: echoTokens.radius.lg,
    paddingHorizontal: 18,
    height: echoTokens.button.heightMd,
    justifyContent: "center",
  },
  primaryText: { color: echoTokens.colors.textOnAccent, fontWeight: "700", fontSize: 15 },
});
