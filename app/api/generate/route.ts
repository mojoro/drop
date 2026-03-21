import { extractContent } from "@/lib/scrape";
import { generateScriptOpenRouter } from "@/lib/openrouter";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { synthesizeLine, getDefaultVoices, type TtsBackend, type TtsConfig } from "@/lib/tts-router";
import { stitchWav } from "@/lib/wavStitching";
import { getProfile, type SettingsProfile } from "@/lib/storage";
import { DEFAULT_HOSTS, type ScriptLength, type ScriptLanguage, type PromptOptions, type HostNames } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 7200; // 2 hours — supports very long unlimited generations

type ScriptBackend = "ollama" | "openrouter" | "featherless" | "claude";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Resolve a config value: profile → env var → fallback. */
function cfg(profileVal: string | undefined, envKey: string, fallback = ""): string {
  return profileVal || process.env[envKey] || fallback;
}

export async function POST(req: Request) {
  const body = await req.json();
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return Response.json({ error: "Missing input" }, { status: 400 });
  }

  const length: ScriptLength = ["1m", "5m", "10m", "30m", "custom"].includes(body?.length) ? body.length : "1m";
  const customMinutes: number | undefined = typeof body?.customMinutes === "number" ? body.customMinutes : undefined;
  const language: ScriptLanguage | undefined = typeof body?.language === "string" && body.language ? body.language : undefined;
  const hostNames: HostNames = {
    a: typeof body?.hostA === "string" && body.hostA.trim() ? body.hostA.trim().toUpperCase() : DEFAULT_HOSTS.a,
    b: typeof body?.hostB === "string" && body.hostB.trim() ? body.hostB.trim().toUpperCase() : DEFAULT_HOSTS.b,
  };
  const customSystemPrompt = typeof body?.customSystemPrompt === "string" ? body.customSystemPrompt : undefined;
  const customUserPrompt = typeof body?.customUserPrompt === "string" ? body.customUserPrompt : undefined;
  const monologue = body?.monologue === true;
  const clientLlmOrder: string[] | undefined = Array.isArray(body?.llmOrder) ? body.llmOrder : undefined;
  const promptOpts: PromptOptions = { language, hosts: hostNames, customSystemPrompt, customUserPrompt, monologue };

  // Load active profile from server (keys never come from the client)
  let profile: SettingsProfile | null = null;
  if (typeof body?.profile === "string" && body.profile) {
    profile = await getProfile(body.profile);
  }

  // Resolve TTS backend and config
  const ttsBackend: TtsBackend = (["local", "elevenlabs", "openai", "qwen"].includes(body?.ttsBackend) ? body.ttsBackend
    : profile?.ttsBackend && ["local", "elevenlabs", "openai", "qwen"].includes(profile.ttsBackend) ? profile.ttsBackend
    : "local") as TtsBackend;

  const ttsConfig: TtsConfig = {
    backend: ttsBackend,
    elevenlabsKey: cfg(profile?.elevenlabsKey, "ELEVENLABS_API_KEY"),
    openaiKey: cfg(profile?.openaiKey, "OPENAI_API_KEY"),
    language,
  };

  const defaults = getDefaultVoices(ttsBackend);
  const alexVoice = typeof body?.alexVoice === "string" ? body.alexVoice : defaults.alex;
  const samVoice  = typeof body?.samVoice  === "string" ? body.samVoice  : defaults.sam;

  // LLM config
  const ollamaModel = cfg(profile?.ollamaModel, "OLLAMA_MODEL");
  const ollamaUrl   = cfg(profile?.ollamaUrl, "OLLAMA_URL", "http://localhost:11434");
  const orKey       = cfg(profile?.openrouterKey, "OPENROUTER_API_KEY");
  const orModel     = profile?.openrouterModel || "";
  const flKey       = cfg(profile?.featherlessKey, "FEATHERLESS_API_KEY");
  const aKey        = cfg(profile?.anthropicKey, "ANTHROPIC_API_KEY");
  const needleKey   = cfg(profile?.needleKey, "NEEDLE_API_KEY");

  const llmChoice = typeof body?.llmBackend === "string" ? body.llmBackend : "auto";

  // ── SSE streaming response ──────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Temporarily set env vars so downstream modules can read them
      const envOverrides: Record<string, string | undefined> = {};
      function setEnv(key: string, val: string) {
        if (val) {
          envOverrides[key] = process.env[key];
          process.env[key] = val;
        }
      }
      setEnv("OLLAMA_URL", ollamaUrl);
      setEnv("OLLAMA_MODEL", ollamaModel);
      setEnv("FEATHERLESS_API_KEY", flKey);
      setEnv("ANTHROPIC_API_KEY", aKey);
      setEnv("NEEDLE_API_KEY", needleKey);

      try {
        // Stage 1: Extract content
        send({ stage: "extracting" });
        const extracted = await extractContent(input);

        // Stage 2: Generate script
        send({ stage: "writing" });

        let script: string | undefined;
        let scriptBackend: ScriptBackend = "claude";

        async function tryOllama() {
          if (!ollamaModel) throw new Error("Ollama model not configured");
          script = await generateScriptOllama(extracted, length, language, promptOpts, customMinutes);
          scriptBackend = "ollama";
        }
        async function tryOpenRouter() {
          if (!orKey) throw new Error("OpenRouter API key not configured");
          script = await generateScriptOpenRouter(extracted, orKey, orModel, length, language, promptOpts, customMinutes);
          scriptBackend = "openrouter";
        }
        async function tryFeatherless() {
          if (!flKey) throw new Error("Featherless API key not configured");
          script = await generateScriptFeatherless(extracted, length, language, promptOpts, customMinutes);
          scriptBackend = "featherless";
        }
        async function tryClaude() {
          if (!aKey) throw new Error("Anthropic API key not configured");
          script = await generateScriptClaude(extracted, length, language, promptOpts, customMinutes);
          scriptBackend = "claude";
        }

        if (llmChoice !== "auto") {
          const backendMap: Record<string, () => Promise<void>> = { ollama: tryOllama, openrouter: tryOpenRouter, featherless: tryFeatherless, claude: tryClaude };
          const fn = backendMap[llmChoice];
          if (fn) await fn();
          else throw new Error(`Unknown LLM backend: ${llmChoice}`);
        } else {
          const allBackends: Record<string, { fn: () => Promise<void>; available: boolean; name: string }> = {
            ollama:      { fn: tryOllama, available: !!ollamaModel, name: "Ollama" },
            openrouter:  { fn: tryOpenRouter, available: !!orKey, name: "OpenRouter" },
            featherless: { fn: tryFeatherless, available: !!flKey, name: "Featherless" },
            claude:      { fn: tryClaude, available: !!aKey, name: "Claude" },
          };
          const order = clientLlmOrder?.filter(k => k in allBackends) ?? ["ollama", "openrouter", "featherless", "claude"];
          const cascade = order.map(k => allBackends[k]);

          for (const backend of cascade) {
            if (!backend.available || script !== undefined) continue;
            try { await backend.fn(); } catch (e) {
              console.warn(`${backend.name} failed, falling back:`, e);
            }
          }

          if (script === undefined) {
            throw new Error("No LLM backend available. Configure Ollama, OpenRouter, Featherless, or Anthropic in settings.");
          }
        }

        const scriptLines = parseScript(script!, hostNames);
        const stats = getScriptStats(scriptLines);

        // Send script as soon as it's ready (before TTS)
        send({ stage: "script", scriptLines, scriptBackend });

        // Stage 3: TTS synthesis with per-line progress
        send({ stage: "audio", progress: { current: 0, total: scriptLines.length } });

        const buffers: ArrayBuffer[] = [];
        for (let i = 0; i < scriptLines.length; i++) {
          const line = scriptLines[i];
          const voice = line.speaker === hostNames.a ? alexVoice : samVoice;
          const buf = await synthesizeLine(line.text, voice, ttsConfig);
          buffers.push(buf);
          send({ stage: "audio", progress: { current: i + 1, total: scriptLines.length } });
        }

        const stitched = stitchWav(buffers);
        const audio = Buffer.from(stitched).toString("base64");

        // Final result
        send({
          stage: "done",
          scriptLines,
          audio,
          scriptBackend,
          ttsBackend,
          debug: { extractedPreview: extracted.slice(0, 2500), rawScript: script, ...stats },
        });
      } catch (error) {
        send({ stage: "error", error: errorMessage(error) });
      } finally {
        for (const [key, val] of Object.entries(envOverrides)) {
          if (val === undefined) delete process.env[key];
          else process.env[key] = val;
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
