import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, Locale, LLMSettings } from '../types'

interface SettingsState extends AppSettings {
  setLocale: (l: Locale) => void
  setLLM: (patch: Partial<LLMSettings>) => void
}

const DEFAULTS: AppSettings = {
  locale: 'zh',
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    extraSystem: '',
    temperature: 0.4,
  },
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setLocale: (l) => set({ locale: l }),
      setLLM: (patch) => set((s) => ({ llm: { ...s.llm, ...patch } })),
    }),
    {
      name: 'fi.settings.v1',
      version: 1,
    },
  ),
)
