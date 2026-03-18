import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto";

const DATA_DIR = join(process.cwd(), "data");
const PODCASTS_DIR = join(DATA_DIR, "podcasts");
const SETTINGS_DIR = join(DATA_DIR, "settings");
const KEY_FILE = join(DATA_DIR, ".key");

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

// ── Encryption (AES-256-GCM) ──────────────────────────────────────────────

/** Get or create a 32-byte encryption key. Prefers DROP_ENCRYPTION_KEY env var. */
async function getEncryptionKey(): Promise<Buffer> {
  // Env var takes precedence — derive a 32-byte key from it
  const envKey = process.env.DROP_ENCRYPTION_KEY;
  if (envKey) {
    return scryptSync(envKey, "drop-salt", 32);
  }

  // Auto-generated key file
  await ensureDir(DATA_DIR);
  if (existsSync(KEY_FILE)) {
    const hex = await readFile(KEY_FILE, "utf-8");
    return Buffer.from(hex.trim(), "hex");
  }

  const key = randomBytes(32);
  await writeFile(KEY_FILE, key.toString("hex"), { mode: 0o600 });
  return key;
}

/** Encrypt a string → "iv:authTag:ciphertext" (all hex). */
async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt an "iv:authTag:ciphertext" string. */
async function decrypt(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const [ivHex, tagHex, ctHex] = data.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(ctHex, "hex", "utf-8") + decipher.final("utf-8");
}

// ── Podcasts ───────────────────────────────────────────────────────────────

export type PodcastMeta = {
  id: string;
  title: string;
  input: string;
  scriptLines: { speaker: "ALEX" | "SAM"; text: string }[];
  scriptBackend: string;
  alexVoice: string;
  samVoice: string;
  createdAt: string;
};

export async function listPodcasts(): Promise<PodcastMeta[]> {
  await ensureDir(PODCASTS_DIR);
  const files = await readdir(PODCASTS_DIR);
  const metas: PodcastMeta[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(PODCASTS_DIR, f), "utf-8");
      metas.push(JSON.parse(raw));
    } catch {
      // skip corrupt files
    }
  }

  return metas.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getPodcast(id: string): Promise<PodcastMeta | null> {
  await ensureDir(PODCASTS_DIR);
  const file = join(PODCASTS_DIR, `${id}.json`);
  try {
    const raw = await readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePodcast(
  meta: Omit<PodcastMeta, "id" | "createdAt">,
  audioBase64: string
): Promise<PodcastMeta> {
  await ensureDir(PODCASTS_DIR);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const podcast: PodcastMeta = {
    ...meta,
    id,
    createdAt: new Date().toISOString(),
  };

  await writeFile(join(PODCASTS_DIR, `${id}.json`), JSON.stringify(podcast, null, 2));
  await writeFile(join(PODCASTS_DIR, `${id}.wav`), Buffer.from(audioBase64, "base64"));

  return podcast;
}

export async function deletePodcast(id: string): Promise<boolean> {
  await ensureDir(PODCASTS_DIR);
  try {
    await unlink(join(PODCASTS_DIR, `${id}.json`));
  } catch {
    return false;
  }
  try {
    await unlink(join(PODCASTS_DIR, `${id}.wav`));
  } catch {
    // audio may not exist
  }
  return true;
}

export async function getPodcastAudio(id: string): Promise<Buffer | null> {
  await ensureDir(PODCASTS_DIR);
  try {
    return await readFile(join(PODCASTS_DIR, `${id}.wav`));
  } catch {
    return null;
  }
}

// ── Settings Profiles ──────────────────────────────────────────────────────

export type SettingsProfile = {
  name: string;
  openrouterKey: string;
  openrouterModel: string;
  featherlessKey: string;
  anthropicKey: string;
  needleKey: string;
  ollamaUrl: string;
  ollamaModel: string;
};

const KEY_FIELDS = ["openrouterKey", "featherlessKey", "anthropicKey", "needleKey"] as const;

function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••" : "";
  return key.slice(0, 5) + "•••" + key.slice(-4);
}

/** Return a copy of the profile with secret keys masked. */
export function maskProfile(profile: SettingsProfile): SettingsProfile {
  const masked = { ...profile };
  for (const field of KEY_FIELDS) {
    masked[field] = maskKey(masked[field]);
  }
  return masked;
}

function profileSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function listProfiles(): Promise<SettingsProfile[]> {
  await ensureDir(SETTINGS_DIR);
  const files = await readdir(SETTINGS_DIR);
  const profiles: SettingsProfile[] = [];

  for (const f of files) {
    if (!f.endsWith(".enc")) continue;
    try {
      const raw = await readFile(join(SETTINGS_DIR, f), "utf-8");
      const json = await decrypt(raw);
      profiles.push(JSON.parse(json));
    } catch {
      // skip corrupt/undecryptable files
    }
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

/** Get a profile with full (unmasked) keys — only for server-side use. */
export async function getProfile(name: string): Promise<SettingsProfile | null> {
  await ensureDir(SETTINGS_DIR);
  const slug = profileSlug(name);
  try {
    const raw = await readFile(join(SETTINGS_DIR, `${slug}.enc`), "utf-8");
    return JSON.parse(await decrypt(raw));
  } catch {
    return null;
  }
}

export async function saveProfile(profile: SettingsProfile): Promise<void> {
  await ensureDir(SETTINGS_DIR);
  const slug = profileSlug(profile.name);
  if (!slug) throw new Error("Profile name is required");
  const encrypted = await encrypt(JSON.stringify(profile));
  await writeFile(join(SETTINGS_DIR, `${slug}.enc`), encrypted, { mode: 0o600 });
}

export async function deleteProfile(name: string): Promise<boolean> {
  await ensureDir(SETTINGS_DIR);
  const slug = profileSlug(name);
  try {
    await unlink(join(SETTINGS_DIR, `${slug}.enc`));
    return true;
  } catch {
    return false;
  }
}
