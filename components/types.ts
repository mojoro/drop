export type Voice = { id: string; name: string; type: 'builtin' | 'custom' }
export type Stage = 'idle' | 'extracting' | 'writing' | 'audio' | 'done' | 'error'
export type ScriptLine = { speaker: 'ALEX' | 'SAM'; text: string }
export type Result = { scriptLines: ScriptLine[]; audio: string | null; scriptBackend?: 'ollama' | 'openrouter' | 'featherless' | 'claude' }

export type SavedPodcast = {
  id: string; title: string; input: string
  scriptLines: ScriptLine[]; scriptBackend: string
  alexVoice: string; samVoice: string; createdAt: string
  monologue?: boolean; hostA?: string; hostB?: string
}

export type MaskedProfile = {
  name: string
  openrouterKey: string
  openrouterModel: string
  featherlessKey: string
  anthropicKey: string
  needleKey: string
  ollamaUrl: string
  ollamaModel: string
}

export type ServerStatus = {
  ollama: boolean
  openrouter: boolean
  featherless: boolean
  anthropic: boolean
  needle: boolean
  ollamaUrl?: string
  ollamaModel?: string
  ttsUrl?: string
  qwenTtsUrl?: string
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
