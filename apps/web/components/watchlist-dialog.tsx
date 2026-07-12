'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { ModalDialog as Dialog } from '@/components/ui/modal-dialog'
import { db } from '@/lib/services'

export function WatchlistDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t('common.enterName'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await db.createWatchlist(name.trim(), description.trim() || undefined, undefined, isShared)
      setName('')
      setDescription('')
      setIsShared(false)
      onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('common.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onClose={onClose} open={open} title={t('modals.newWatchlist')}>
      <div className="grid gap-4">
        <Field
          label={t('modals.name')}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <TextArea
          label={t('modals.descriptionOptional')}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-kino-text">
          <input
            checked={isShared}
            onChange={(event) => setIsShared(event.target.checked)}
            type="checkbox"
          />
          {t('modals.shareHint')}
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? t('common.loading') : t('modals.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
