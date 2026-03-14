import { Needle } from "@needle-ai/needle/v1";

type NeedleFileLike = {
  id?: string;
  name?: string;
  status?: string;
  indexing_status?: string;
};

type NeedleSearchResultLike = {
  content?: string;
  text?: string;
};

const SEARCH_PROMPT =
  "Summarize the main ideas, key claims, evidence, conclusions, and the most important details from this source.";

const INDEX_POLL_MS = 3000;
const INDEX_MAX_POLLS = 40;
const MAX_RETRIEVED_CHARS = 12000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyUrl(input: string) {
  return /^https?:\/\//i.test(input.trim());
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function tryVariants<T>(variants: Array<() => Promise<T>>): Promise<T> {
  let lastError: unknown;

  for (const fn of variants) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Needle call failed");
}

function toFilesArray(raw: unknown): NeedleFileLike[] {
  if (Array.isArray(raw)) return raw as NeedleFileLike[];

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.files)) return obj.files as NeedleFileLike[];
    if (Array.isArray(obj.items)) return obj.items as NeedleFileLike[];
    if (Array.isArray(obj.data)) return obj.data as NeedleFileLike[];
    if (Array.isArray(obj.results)) return obj.results as NeedleFileLike[];
  }

  return [];
}

function toSearchResultsArray(raw: unknown): NeedleSearchResultLike[] {
  if (Array.isArray(raw)) return raw as NeedleSearchResultLike[];

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.results)) return obj.results as NeedleSearchResultLike[];
    if (Array.isArray(obj.references)) return obj.references as NeedleSearchResultLike[];
    if (Array.isArray(obj.data)) return obj.data as NeedleSearchResultLike[];
    if (Array.isArray(obj.items)) return obj.items as NeedleSearchResultLike[];
  }

  return [];
}

function extractResultText(result: NeedleSearchResultLike) {
  return normalizeWhitespace(result.content || result.text || "");
}

function dedupeAndJoinChunks(chunks: string[]) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const chunk of chunks) {
    const normalized = normalizeWhitespace(chunk);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    cleaned.push(normalized);
  }

  return cleaned.join("\n\n").slice(0, MAX_RETRIEVED_CHARS);
}

async function createCollection(needle: Needle, name: string) {
  const client = needle as any;

  const collection = await tryVariants<any>([
    () => client.collections.create({ name }),
    () => client.collections.create(name),
  ]);

  const collectionId = safeString(collection?.id || collection?.collection_id);
  if (!collectionId) {
    throw new Error("Needle collection created but no collection id was returned.");
  }

  return {
    raw: collection,
    id: collectionId,
  };
}

async function addUrlToCollection(needle: Needle, collectionId: string, url: string) {
  const client = needle as any;

  await tryVariants([
    () =>
      client.collections.files.add({
        collection_id: collectionId,
        files: [
          {
            name: `drop-source-${Date.now()}`,
            url,
          },
        ],
      }),
    () =>
      client.collections.files.add(collectionId, [
        {
          name: `drop-source-${Date.now()}`,
          url,
        },
      ]),
  ]);
}

async function listCollectionFiles(needle: Needle, collectionId: string): Promise<NeedleFileLike[]> {
  const client = needle as any;

  const raw = await tryVariants<any>([
    () => client.collections.files.list({ collection_id: collectionId }),
    () => client.collections.files.list(collectionId),
  ]);

  return toFilesArray(raw);
}

async function waitForIndexing(needle: Needle, collectionId: string) {
  for (let i = 0; i < INDEX_MAX_POLLS; i += 1) {
    const files = await listCollectionFiles(needle, collectionId);

    if (files.length > 0) {
      const statuses = files.map((file) =>
        safeString(file.status || file.indexing_status).toLowerCase()
      );

      if (statuses.some((status) => status.includes("fail") || status.includes("error"))) {
        throw new Error(`Needle indexing failed. File statuses: ${statuses.join(", ")}`);
      }

      const allReady = statuses.every(
        (status) =>
          status.includes("indexed") ||
          status === "ready" ||
          status === "completed" ||
          status === "complete"
      );

      if (allReady) return;
    }

    await sleep(INDEX_POLL_MS);
  }

  throw new Error("Needle indexing timed out. Try a smaller/faster URL or try again.");
}

async function searchCollection(needle: Needle, collectionId: string, text: string) {
  const client = needle as any;

  const raw = await tryVariants<any>([
    () =>
      client.collections.search({
        collection_id: collectionId,
        text,
      }),
    () =>
      client.collections.search(collectionId, {
        text,
      }),
    () => client.collections.search(collectionId, text),
  ]);

  return toSearchResultsArray(raw);
}

export async function extractContent(input: string): Promise<string> {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Input is required.");
  }

  if (!isLikelyUrl(trimmed)) {
    return trimmed;
  }

  if (!process.env.NEEDLE_API_KEY) {
    throw new Error("Missing NEEDLE_API_KEY in .env.local");
  }

  const needle = new Needle();

  try {
    const collection = await createCollection(needle, `drop-${Date.now()}`);

    await addUrlToCollection(needle, collection.id, trimmed);
    await waitForIndexing(needle, collection.id);

    const results = await searchCollection(needle, collection.id, SEARCH_PROMPT);

    const text = dedupeAndJoinChunks(results.map(extractResultText));

    if (!text) {
      throw new Error("Needle returned no useful content for this URL.");
    }

    return text;
  } catch (error) {
    throw new Error(`Needle extraction failed: ${errorMessage(error)}`);
  }
}