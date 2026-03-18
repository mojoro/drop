import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const DATA_DIR = join(process.cwd(), "data");
const PODCASTS_DIR = join(DATA_DIR, "podcasts");
const SETTINGS_DIR = join(DATA_DIR, "settings");

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
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

export async function listProfiles(): Promise<SettingsProfile[]> {
  await ensureDir(SETTINGS_DIR);
  const files = await readdir(SETTINGS_DIR);
  const profiles: SettingsProfile[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(SETTINGS_DIR, f), "utf-8");
      profiles.push(JSON.parse(raw));
    } catch {
      // skip corrupt files
    }
  }

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveProfile(profile: SettingsProfile): Promise<void> {
  await ensureDir(SETTINGS_DIR);
  const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("Profile name is required");
  await writeFile(join(SETTINGS_DIR, `${slug}.json`), JSON.stringify(profile, null, 2));
}

export async function deleteProfile(name: string): Promise<boolean> {
  await ensureDir(SETTINGS_DIR);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    await unlink(join(SETTINGS_DIR, `${slug}.json`));
    return true;
  } catch {
    return false;
  }
}
