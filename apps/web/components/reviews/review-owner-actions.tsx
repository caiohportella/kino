import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/localization/i18n'

export function ReviewOwnerActions({
  disabled,
  onDelete,
  onEdit,
}: {
  disabled: boolean
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()

  return (
    <TooltipProvider delay={180}>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t('reviews.edit')}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit()
                }}
                size="icon-xs"
                variant="ghost"
              >
                <Pencil aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>{t('reviews.edit')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t('reviews.delete')}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                size="icon-xs"
                variant="destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>{t('reviews.delete')}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
