import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractContent as extractWithNeedle } from "./needle";

const MAX_CHARS = 12_000;
const FETCH_TIMEOUT_MS = 10_000;

function isUrl(input: string) {
  return /^https?:\/\//i.test(input.trim());
}

/**
 * Fetch a URL and extract its main article text using Readability + linkedom.
 */
async function extractFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Drop/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // linkedom provides a spec-compliant DOM that Readability works with directly
  const { document } = parseHTML(html);

  // Remove noise before Readability scores the page
  for (const sel of ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"]) {
    for (const el of document.querySelectorAll(sel)) {
      el.remove();
    }
  }

  const reader = new Readability(document);
  const article = reader.parse();

  if (article?.textContent) {
    return article.textContent.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  }

  // Fallback: full body text
  const text = document.body?.textContent?.replace(/\s+/g, " ").trim();
  if (!text) throw new Error("Could not extract text from URL");
  return text.slice(0, MAX_CHARS);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract content from a URL or pass through plain text.
 * Uses Needle when NEEDLE_API_KEY is set, otherwise built-in Readability scraper.
 */
export async function extractContent(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Input is required");

  // Plain text topic — pass straight through
  if (!isUrl(trimmed)) return trimmed;

  // If Needle is configured, use it with built-in scraper as fallback
  if (process.env.NEEDLE_API_KEY) {
    try {
      return await extractWithNeedle(trimmed);
    } catch (err) {
      console.warn("Needle failed, falling back to built-in scraper:", err);
    }
  }

  try {
    return await extractFromUrl(trimmed);
  } catch (err) {
    console.warn("Scrape failed, passing URL as topic:", err);
    return `Content from: ${trimmed}`;
  }
}
