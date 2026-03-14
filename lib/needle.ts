import { Needle } from "@needle-ai/needle/v1";

const SEARCH_PROMPT =
  "Summarize the main ideas, key claims, evidence, conclusions, and the most important details from this source.";

const INDEX_POLL_MS  = 2000;
const INDEX_MAX_POLLS = 12;   // 24s max — stays within Vercel timeout
const MAX_CHARS       = 12000;

function isUrl(input: string) {
  return /^https?:\/\//i.test(input.trim());
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Direct HTML fetch fallback ─────────────────────────────────────────────
// Used when Needle is unavailable or times out.
async function fetchAndStripHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Drop/1.0)" },
    signal: AbortSignal.timeout(10_000),
  });
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);
}

// ── Needle extraction ──────────────────────────────────────────────────────
async function extractWithNeedle(url: string): Promise<string> {
  const apiKey = process.env.NEEDLE_API_KEY;
  if (!apiKey) throw new Error("Missing NEEDLE_API_KEY");

  // Constructor requires { apiKey } — does NOT auto-read from env
  const client = new Needle({ apiKey });

  // Create collection
  const collection = await client.collections.create({ name: `drop-${Date.now()}`, model: "basilikum-minima" });
  const collectionId: string = (collection as any).id ?? (collection as any).collection_id;
  if (!collectionId) throw new Error("Needle: no collection ID returned");

  // Add URL file
  await client.collections.files.add({
    collection_id: collectionId,
    files: [{ name: `source-${Date.now()}`, url }],
  });

  // Poll for indexing
  for (let i = 0; i < INDEX_MAX_POLLS; i++) {
    await sleep(INDEX_POLL_MS);

    const filesRaw = await client.collections.files.list({ collection_id: collectionId });
    const files: any[] = Array.isArray(filesRaw)
      ? filesRaw
      : (filesRaw as any)?.files ?? (filesRaw as any)?.data ?? [];

    if (files.length === 0) continue;

    const statuses: string[] = files.map((f: any) =>
      String(f.status ?? f.indexing_status ?? "").toLowerCase()
    );

    if (statuses.some(s => s.includes("fail") || s.includes("error"))) {
      throw new Error(`Needle indexing failed: ${statuses.join(", ")}`);
    }

    const ready = statuses.every(s =>
      s.includes("indexed") || s === "ready" || s === "completed" || s === "complete"
    );
    if (ready) break;
  }

  // Search
  const searchRaw = await client.collections.search({
    collection_id: collectionId,
    text: SEARCH_PROMPT,
    top_k: 8,
  });

  const results: any[] = Array.isArray(searchRaw)
    ? searchRaw
    : (searchRaw as any)?.results ?? (searchRaw as any)?.data ?? [];

  const text = results
    .map((r: any) => String(r.content ?? r.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_CHARS);

  if (!text) throw new Error("Needle returned no content");
  return text;
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function extractContent(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Input is required");

  // Plain text — pass straight through
  if (!isUrl(trimmed)) return trimmed;

  // Try Needle first, fall back to direct HTML fetch
  try {
    return await extractWithNeedle(trimmed);
  } catch (needleErr) {
    console.warn("Needle failed, falling back to direct fetch:", needleErr);
    try {
      const text = await fetchAndStripHtml(trimmed);
      if (!text) throw new Error("Empty response from URL");
      return text;
    } catch (fetchErr) {
      // Last resort: just pass the URL as the topic
      console.warn("Direct fetch also failed:", fetchErr);
      return `Content from: ${trimmed}`;
    }
  }
}
