import express from "express";
import type { ChatMessagePayload } from "@echocare/shared";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "15mb" }));

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

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`EchoCare API listening on http://localhost:${port}`);
});
