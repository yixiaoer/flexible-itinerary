import { useSettings } from '../store/settings'
import { t } from '../i18n/messages'
import type { Locale } from '../types'
import { Drawer, FormSection, SegmentedControl } from './ui'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDrawer({ open, onClose }: Props) {
  const { locale, setLocale } = useSettings()
  const aiPlaceholder = locale === 'zh' ? 'AI 配置即将支持' : 'AI configuration coming soon'

  return (
    <Drawer open={open} title={t(locale, 'settings')} onClose={onClose}>
      <div className="space-y-6">
        <FormSection label={t(locale, 'language')}>
          <SegmentedControl
            options={[
              { value: 'zh' as Locale, label: '中文' },
              { value: 'en' as Locale, label: 'English' },
            ]}
            value={locale}
            onChange={setLocale}
            itemClassName="px-3"
          />
        </FormSection>

        <FormSection label={t(locale, 'apiBaseUrl')} hint={t(locale, 'apiKeyHint')}>
          <input
            className="input"
            value=""
            disabled
            placeholder={aiPlaceholder}
          />
        </FormSection>

        <FormSection label={t(locale, 'apiKey')} hint={t(locale, 'apiKeyStored')}>
          <input
            className="input font-mono"
            value=""
            disabled
            type="password"
            placeholder={aiPlaceholder}
            autoComplete="off"
          />
        </FormSection>

        <FormSection label={t(locale, 'model')}>
          <input
            className="input"
            value=""
            disabled
            placeholder={aiPlaceholder}
          />
        </FormSection>

        <FormSection label={t(locale, 'temperature')}>
          <input
            className="input"
            value=""
            disabled
            placeholder={aiPlaceholder}
          />
        </FormSection>

        <FormSection label={t(locale, 'extraSystem')}>
          <textarea
            className="input min-h-[88px] resize-y"
            value=""
            disabled
            placeholder={aiPlaceholder}
          />
        </FormSection>
      </div>
    </Drawer>
  )
}
