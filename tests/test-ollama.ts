import { generateScriptOllama } from "@/lib/ollama";

const topic = "The surprising history of coffee and how it changed Western civilization";

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

async function main() {
  console.log(`[${ts()}] Testing Ollama script generation...`);
  console.log(`[${ts()}] Topic: ${topic}`);
  console.log("---");

  const start = Date.now();
  try {
    const script = await generateScriptOllama(topic);
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[${ts()}] SUCCESS in ${elapsed}s\n`);
    console.log(script);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.error(`[${ts()}] FAILED after ${elapsed}s:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
