'use client'

import type { WatchlistVisibility } from '@kino/core'
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { LabeledField as Field, LabeledTextArea as TextArea } from '@/components/ui/labeled-field'
import { ModalDialog as Dialog } from '@/components/ui/modal-dialog'
import { db } from '@/lib/services'
import { WatchlistVisibilitySelector } from '@/components/watchlist-visibility-selector'

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
  const [visibility, setVisibility] = useState<WatchlistVisibility>('private')
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
      await db.createWatchlist(name.trim(), description.trim() || undefined, undefined, visibility)
      setName('')
      setDescription('')
      setVisibility('private')
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
        <WatchlistVisibilitySelector onChange={setVisibility} value={visibility} />
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
