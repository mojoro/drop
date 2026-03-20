import { extractContent } from "../lib/scrape";

async function main() {
  // Test 1: plain text passthrough
  const plain = await extractContent("The history of quantum computing");
  console.log("✓ Plain text:", plain.slice(0, 80));

  // Test 2: URL extraction
  const url = "https://en.wikipedia.org/wiki/Podcast";
  console.log(`\nFetching ${url}...`);
  const extracted = await extractContent(url);
  console.log("✓ Extracted length:", extracted.length);
  console.log("✓ Preview:", extracted.slice(0, 300));

  // Test 3: bad URL graceful fallback
  const bad = await extractContent("https://thisdomaindoesnotexist.invalid/page");
  console.log("\n✓ Bad URL fallback:", bad);
}

main().catch(console.error);
