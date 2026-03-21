import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRepairPrompt,
  stripCodeFences,
  getContentSlice,
  getLengthConfig,
  DEFAULT_HOSTS,
  type ScriptLength,
  type ScriptLanguage,
  type PromptOptions,
} from "@/lib/prompt";
import { validatePodcastScript, extractValidLines } from "@/lib/featherless";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen3.5:4b";

/** Lines per chunk for sliding-window generation. */
const CHUNK_LINES = 50;
/** Target minutes threshold above which sliding-window kicks in. */
const SLIDING_WINDOW_THRESHOLD = 10;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function callOllama(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  timeoutMs = 300_000,
) {
  const baseUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(`Ollama error: ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty script.");
  }

  return stripCodeFences(content).trim();
}

/**
 * Generate a single chunk and extract valid lines.
 * Returns raw valid lines (not joined).
 */
async function generateChunk(
  systemPrompt: string,
  userPrompt: string,
  hostA: string,
  hostB: string | undefined,
  timeoutMs: number,
): Promise<string[]> {
  const raw = await callOllama([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], timeoutMs);

  return hostB ? extractValidLines(raw, hostA, hostB) : extractValidLines(raw, hostA);
}

/**
 * Sliding-window generation: chain multiple LLM calls to produce long scripts.
 * Each continuation call gets the last few lines as context.
 */
async function generateLongScript(
  content: string,
  length: ScriptLength,
  promptOpts: PromptOptions,
  customMinutes?: number,
): Promise<string> {
  const hosts = promptOpts.hosts ?? DEFAULT_HOSTS;
  const cfg = getLengthConfig(length, customMinutes);
  const targetLines = cfg.lines[0];
  const systemPrompt = buildSystemPrompt(promptOpts);
  const targetMin = parseInt(length) || (customMinutes && customMinutes > 0 ? customMinutes : 5);
  const chunkTimeoutMs = Math.max(300_000, 600_000); // 10 min per chunk

  // First chunk — use normal user prompt but ask for a partial script
  const firstPrompt = buildUserPrompt(content, length, promptOpts, customMinutes);
  const allLines: string[] = [];

  console.log(`Ollama sliding-window: targeting ${targetLines} lines in chunks of ~${CHUNK_LINES}`);

  const firstChunkLines = await generateChunk(
    systemPrompt, firstPrompt,
    hosts.a, promptOpts.monologue ? undefined : hosts.b,
    chunkTimeoutMs,
  );

  if (firstChunkLines.length === 0) {
    throw new Error("Ollama returned no valid lines in first chunk.");
  }

  allLines.push(...firstChunkLines);
  console.log(`Ollama chunk 1: ${firstChunkLines.length} lines (total: ${allLines.length}/${targetLines})`);

  // Continue generating chunks until we reach the target
  let chunkNum = 2;
  const maxChunks = Math.ceil(targetLines / 10) + 5; // safety cap

  while (allLines.length < targetLines && chunkNum <= maxChunks) {
    const contextLines = allLines.slice(-5).join("\n");
    const remaining = targetLines - allLines.length;
    const linesThisChunk = Math.min(remaining, CHUNK_LINES);

    const continuePrompt = promptOpts.monologue
      ? `Continue the podcast narration. Here is the script so far (last few lines):\n\n${contextLines}\n\nWrite the next ${linesThisChunk} lines, continuing naturally from where it left off. Every line must start with ${hosts.a}:. Do not repeat lines already written. Do not add introductions or conclusions yet${remaining > linesThisChunk ? "" : " — this is the final segment, end with a memorable closing line"}.`
      : `Continue the podcast dialogue. Here is the script so far (last few lines):\n\n${contextLines}\n\nWrite the next ${linesThisChunk} lines, continuing naturally from where it left off. Alternate between ${hosts.a}: and ${hosts.b}: lines. Do not repeat lines already written. Do not add introductions or conclusions yet${remaining > linesThisChunk ? "" : " — this is the final segment, end with a memorable takeaway from " + hosts.b}.`;

    try {
      const chunkLines = await generateChunk(
        systemPrompt, continuePrompt,
        hosts.a, promptOpts.monologue ? undefined : hosts.b,
        chunkTimeoutMs,
      );

      if (chunkLines.length === 0) {
        console.warn(`Ollama chunk ${chunkNum}: no valid lines returned, stopping`);
        break;
      }

      allLines.push(...chunkLines);
      console.log(`Ollama chunk ${chunkNum}: ${chunkLines.length} lines (total: ${allLines.length}/${targetLines})`);
    } catch (e) {
      console.warn(`Ollama chunk ${chunkNum} failed: ${errorMessage(e)}, stopping with ${allLines.length} lines`);
      break;
    }

    chunkNum++;
  }

  if (allLines.length < 4) {
    throw new Error("Ollama sliding-window produced too few lines.");
  }

  console.log(`Ollama sliding-window complete: ${allLines.length} lines across ${chunkNum - 1} chunks`);
  return allLines.join("\n");
}

export async function generateScriptOllama(content: string, length: ScriptLength = "1m", language?: ScriptLanguage, opts?: PromptOptions, customMinutes?: number): Promise<string> {
  const cleanedContent = getContentSlice(content, length, customMinutes);

  if (!cleanedContent) {
    throw new Error("No content was provided to Ollama.");
  }

  const promptOpts: PromptOptions = { ...opts, language: opts?.language ?? language };
  const hosts = promptOpts.hosts ?? DEFAULT_HOSTS;
  const cfg = getLengthConfig(length, customMinutes);
  const targetMin = parseInt(length) || (customMinutes && customMinutes > 0 ? customMinutes : 5);

  // For long episodes, use sliding-window approach
  if (targetMin > SLIDING_WINDOW_THRESHOLD) {
    return generateLongScript(cleanedContent, length, promptOpts, customMinutes);
  }

  // Short episodes — single-call approach
  const systemPrompt = buildSystemPrompt(promptOpts);
  const userPrompt = buildUserPrompt(cleanedContent, length, promptOpts, customMinutes);
  const timeoutMs = Math.max(300_000, targetMin * 60_000);

  try {
    const firstPass = await callOllama([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], timeoutMs);

    if (validatePodcastScript(firstPass, length, hosts.a, hosts.b, customMinutes, !!promptOpts.monologue)) {
      return firstPass;
    }

    // Accept whatever valid lines the model produces
    const minLines = Math.max(4, Math.min(cfg.lines[0] - 4, 40));
    const extracted = promptOpts.monologue ? extractValidLines(firstPass, hosts.a) : extractValidLines(firstPass, hosts.a, hosts.b);
    if (extracted.length >= minLines) {
      console.warn(`Ollama: first pass had ${extracted.length} valid lines out of mixed output, using them`);
      return extracted.join("\n");
    }

    console.warn("Ollama: first pass invalid, attempting repair. Raw output:", firstPass.slice(0, 500));

    const repaired = await callOllama([
      { role: "system", content: systemPrompt },
      { role: "user", content: buildRepairPrompt(firstPass, length, promptOpts, customMinutes) },
    ], timeoutMs);

    if (validatePodcastScript(repaired, length, hosts.a, hosts.b, customMinutes)) {
      return repaired;
    }

    const repairedLines = promptOpts.monologue ? extractValidLines(repaired, hosts.a) : extractValidLines(repaired, hosts.a, hosts.b);
    if (repairedLines.length >= minLines) {
      console.warn(`Ollama: repair had ${repairedLines.length} valid lines, using them`);
      return repairedLines.join("\n");
    }

    throw new Error("Ollama returned invalid script format after retry.");
  } catch (error) {
    throw new Error(`Ollama script generation failed: ${errorMessage(error)}`);
  }
}
