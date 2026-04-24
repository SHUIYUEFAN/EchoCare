import express from "express";
import type { ChatMessagePayload } from "@echocare/shared";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "15mb" }));

type OtpRecord = { codeHash: string; expiresAt: number; attempts: number };
const otpStore = new Map<string, OtpRecord>();
const counterStore = new Map<string, { count: number; expiresAt: number }>();
const OTP_TTL_SEC = Number(process.env.OTP_TTL_SEC || 300);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60);
const OTP_DAILY_LIMIT_PER_PHONE = Number(process.env.OTP_DAILY_LIMIT_PER_PHONE || 10);
const OTP_MODE = (process.env.OTP_MODE || "mock").toLowerCase();
const OTP_SECRET = process.env.OTP_SECRET || "echocare-dev-secret";
const SMS_PROVIDER = (process.env.SMS_PROVIDER || "mock").toLowerCase();
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "EchoCare";
const OTP_EMAIL_TEMPLATE = process.env.OTP_EMAIL_TEMPLATE || "Your EchoCare verification code is {{code}}. It expires in {{ttl}} minutes.";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const AUTH_USER_TABLE = process.env.AUTH_USER_TABLE || "auth_users";
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const otpKey = (id: string) => `otp:${id}`;
const cooldownKey = (id: string) => `otp:cooldown:${id}`;
const dailyKey = (id: string) => `otp:daily:${id}:${new Date().toISOString().slice(0, 10)}`;
const ipDailyKey = (ip: string) => `otp:ipdaily:${ip}:${new Date().toISOString().slice(0, 10)}`;

const hashOtp = (identifier: string, code: string) =>
  createHash("sha256")
    .update(`${OTP_SECRET}:${identifier}:${code}`)
    .digest("hex");

const randomCode = () => String(Math.floor(Math.random() * 900000) + 100000);

const getOtp = async (id: string) => {
  if (redis) {
    return (await redis.get<OtpRecord>(otpKey(id))) || null;
  }
  const data = otpStore.get(id) || null;
  if (data && data.expiresAt < Date.now()) {
    otpStore.delete(id);
    return null;
  }
  return data;
};

const setOtp = async (id: string, data: OtpRecord) => {
  if (redis) {
    await redis.set(otpKey(id), data, { ex: OTP_TTL_SEC });
    return;
  }
  otpStore.set(id, data);
};

const deleteOtp = async (id: string) => {
  if (redis) {
    await redis.del(otpKey(id));
    return;
  }
  otpStore.delete(id);
};

const bumpCounter = async (key: string, ttlSec: number) => {
  if (redis) {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, ttlSec);
    return count;
  }
  const now = Date.now();
  const current = counterStore.get(key);
  if (!current || current.expiresAt < now) {
    counterStore.set(key, { count: 1, expiresAt: now + ttlSec * 1000 });
    return 1;
  }
  const next = current.count + 1;
  counterStore.set(key, { ...current, count: next });
  return next;
};

const sendSmsCode = async (phone: string, code: string) => {
  if (SMS_PROVIDER === "mock") return { sent: false, reason: "provider_not_configured" as const };
  // Future providers: twilio / tencent / aliyun.
  console.log(`SMS provider=${SMS_PROVIDER}, to=${phone}, code=${code}`);
  return { sent: false, reason: "provider_not_implemented" as const };
};

const sendEmailCode = async (email: string, code: string) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { sent: false, reason: "resend_not_configured" as const };
  }
  const ttlMinutes = Math.max(1, Math.floor(OTP_TTL_SEC / 60));
  const text = OTP_EMAIL_TEMPLATE.replace("{{code}}", code).replace("{{ttl}}", String(ttlMinutes));
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [email],
        subject: "EchoCare verification code",
        text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { sent: false, reason: `resend_http_${response.status}:${body.slice(0, 120)}` as const };
    }
    return { sent: true as const };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "resend_request_failed" };
  }
};

const saveAuthUser = async (identifier: string, email?: string) => {
  if (!supabase) {
    return { saved: false, reason: "supabase_not_configured" as const };
  }
  const now = new Date().toISOString();
  const payload = {
    identifier,
    email: email || null,
    provider: email ? "email_otp" : "phone_otp",
    last_login_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from(AUTH_USER_TABLE).upsert(payload, { onConflict: "identifier" });
  if (error) return { saved: false, reason: error.message };
  return { saved: true as const };
};

const hashText = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "echocare-api" });
});

/** Stub: later wire to Supabase + LLM + MiniMax (Sprint 2). */
app.post("/v1/messages/echo", (req, res) => {
  const body = req.body as Partial<ChatMessagePayload>;
  if (!body.body || !body.familyId) {
    res.status(400).json({ error: "familyId and body required" });
    return;
  }
  res.json({
    echoed: body.body,
    hint: "Replace with Supabase insert + Realtime broadcast in Sprint 1.",
  });
});

type VoiceProfile = { signature: number[] };
const voiceProfiles = new Map<string, VoiceProfile>();

const buildSignature = (audioBase64: string) => {
  const signature = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < audioBase64.length; i += 53) {
    const code = audioBase64.charCodeAt(i);
    signature[i % signature.length] += code;
  }
  return signature.map((n) => n / Math.max(audioBase64.length, 1));
};

const similarity = (a: number[], b: number[]) => {
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

app.post("/v1/voice/register", (req, res) => {
  const { familyId, profileId, audioBase64 } = req.body as {
    familyId?: string;
    profileId?: string;
    audioBase64?: string;
  };
  if (!familyId || !profileId || !audioBase64) {
    res.status(400).json({ error: "familyId, profileId, audioBase64 required" });
    return;
  }
  const key = `${familyId}:${profileId}`;
  voiceProfiles.set(key, { signature: buildSignature(audioBase64) });
  res.json({ success: true, key });
});

app.post("/v1/voice/verify", (req, res) => {
  const { familyId, profileId, audioBase64 } = req.body as {
    familyId?: string;
    profileId?: string;
    audioBase64?: string;
  };
  if (!familyId || !profileId || !audioBase64) {
    res.status(400).json({ error: "familyId, profileId, audioBase64 required" });
    return;
  }
  const key = `${familyId}:${profileId}`;
  const profile = voiceProfiles.get(key);
  if (!profile) {
    res.status(404).json({ error: "voice profile not found, register first" });
    return;
  }
  const current = buildSignature(audioBase64);
  const score = similarity(profile.signature, current);
  res.json({ matched: score > 0.82, score: Number(score.toFixed(4)) });
});

app.post("/v1/avatar/generate", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }

  try {
    const clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const input = Buffer.from(clean, "base64");

    // Lightweight 2D/cartoon-ish stylization placeholder.
    const output = await sharp(input)
      .resize(512, 512, { fit: "cover", position: "attention" })
      .median(2)
      .modulate({ saturation: 1.45, brightness: 1.05 })
      .sharpen({ sigma: 1.5, m1: 1.2, m2: 2.2, x1: 2, y2: 10, y3: 20 })
      .png({ quality: 92 })
      .toBuffer();

    res.json({
      imageDataUrl: `data:image/png;base64,${output.toString("base64")}`,
      style: "cartoon-2d-v1",
    });
  } catch {
    res.status(500).json({ error: "avatar generation failed" });
  }
});

app.post("/v1/auth/send-code", async (req, res) => {
  const { phone, email } = req.body as { phone?: string; email?: string };
  const normalizedEmail = email?.trim().toLowerCase();
  const identifier = phone?.trim() || normalizedEmail;
  const isPhone = Boolean(phone?.trim());
  const isEmail = Boolean(normalizedEmail);
  if (!identifier) {
    res.status(400).json({ error: "phone or email required" });
    return;
  }
  if (isPhone && !/^\+\d{6,15}$/.test(identifier)) {
    res.status(400).json({ error: "valid phone required" });
    return;
  }
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    res.status(400).json({ error: "valid email required" });
    return;
  }
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const cooldownCount = await bumpCounter(cooldownKey(identifier), OTP_RESEND_COOLDOWN_SEC);
  if (cooldownCount > 1) {
    res.status(429).json({ error: "please wait before requesting another code", cooldownSec: OTP_RESEND_COOLDOWN_SEC });
    return;
  }
  const phoneDailyCount = await bumpCounter(dailyKey(identifier), 24 * 60 * 60);
  if (phoneDailyCount > OTP_DAILY_LIMIT_PER_PHONE) {
    res.status(429).json({ error: "daily send limit reached" });
    return;
  }
  const ipDailyCount = await bumpCounter(ipDailyKey(ip), 24 * 60 * 60);
  if (ipDailyCount > OTP_DAILY_LIMIT_PER_PHONE * 3) {
    res.status(429).json({ error: "ip daily send limit reached" });
    return;
  }

  const code = randomCode();
  const expiresAt = Date.now() + OTP_TTL_SEC * 1000;
  await setOtp(identifier, { codeHash: hashOtp(identifier, code), expiresAt, attempts: 0 });

  if (OTP_MODE === "live") {
    if (isEmail) {
      const sent = await sendEmailCode(identifier, code);
      if (!sent.sent) {
        res.status(503).json({ error: `email send failed (${sent.reason})` });
        return;
      }
    } else if (isPhone) {
      const sent = await sendSmsCode(identifier, code);
      if (!sent.sent) {
        res.status(503).json({ error: `sms send failed (${sent.reason})` });
        return;
      }
    }
  }

  res.json({
    success: true,
    expiresInSec: OTP_TTL_SEC,
    cooldownSec: OTP_RESEND_COOLDOWN_SEC,
    debugCode: OTP_MODE === "mock" && process.env.NODE_ENV !== "production" ? code : undefined,
    mode: OTP_MODE,
    redisEnabled: Boolean(redis),
  });
});

app.post("/v1/auth/verify-code", async (req, res) => {
  const { phone, email, code } = req.body as { phone?: string; email?: string; code?: string };
  const identifier = phone?.trim() || email?.trim().toLowerCase();
  if (!identifier || !code) {
    res.status(400).json({ error: "phone/email and code required" });
    return;
  }
  const record = await getOtp(identifier);
  if (!record) {
    res.status(404).json({ error: "code not sent or expired" });
    return;
  }
  const now = Date.now();
  if (record.expiresAt < now) {
    await deleteOtp(identifier);
    res.status(410).json({ error: "code expired" });
    return;
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await deleteOtp(identifier);
    res.status(429).json({ error: "too many attempts" });
    return;
  }
  if (record.codeHash !== hashOtp(identifier, code)) {
    const next = { ...record, attempts: record.attempts + 1 };
    await setOtp(identifier, next);
    res.status(401).json({ error: "invalid code" });
    return;
  }
  await deleteOtp(identifier);
  const save = await saveAuthUser(identifier, email?.trim().toLowerCase());
  if (!save.saved) {
    res.status(500).json({ error: `login succeeded but user save failed (${save.reason})` });
    return;
  }
  res.json({ success: true, token: `demo-token-${Buffer.from(identifier).toString("base64")}` });
});

app.post("/v1/vision/describe", (req, res) => {
  const { imageBase64, locale } = req.body as { imageBase64?: string; locale?: "zh" | "en" | "ja" };
  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 required" });
    return;
  }
  const lang = locale === "en" || locale === "ja" ? locale : "zh";
  const seed = hashText(imageBase64.slice(0, 2000));
  const subjectByLang = {
    zh: ["一位长者", "一组家人", "一处熟悉街景", "一次日常生活瞬间"],
    en: ["an elder", "a family group", "a familiar street scene", "an everyday life moment"],
    ja: ["ご高齢の方", "家族のグループ", "見慣れた街の風景", "日常のひとコマ"],
  };
  const moodByLang = {
    zh: ["温暖", "平静", "轻松", "充满回忆"],
    en: ["warm", "calm", "relaxed", "memory-rich"],
    ja: ["温かい", "穏やか", "落ち着いた", "思い出深い"],
  };
  const detailByLang = {
    zh: ["画面光线柔和", "人物位置居中", "色调偏明亮", "场景层次清晰"],
    en: ["with soft lighting", "framed around the center", "with bright tones", "with clear scene depth"],
    ja: ["光がやわらかく", "中央に構図があり", "明るめの色調で", "奥行きが感じられる"],
  };
  const subject = subjectByLang[lang][seed % subjectByLang[lang].length];
  const mood = moodByLang[lang][(seed >> 3) % moodByLang[lang].length];
  const detail = detailByLang[lang][(seed >> 6) % detailByLang[lang].length];
  const description =
    lang === "zh"
      ? `识别结果：照片里像是${subject}，整体氛围${mood}，并且${detail}。`
      : lang === "en"
        ? `Detected scene: This looks like ${subject}, the mood feels ${mood}, ${detail}.`
        : `認識結果：写真には${subject}が写っているように見え、雰囲気は${mood}で、${detail}です。`;
  res.json({ description });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`EchoCare API listening on http://localhost:${port}`);
});
