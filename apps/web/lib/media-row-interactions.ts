const MEDIA_ROW_INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="checkbox"], [role="combobox"], [role="link"], [role="radio"], [role="slider"], [role="switch"], [role="textbox"]'

const MEDIA_ROW_DRAG_BLOCKING_SELECTOR =
  'button, input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="checkbox"], [role="combobox"], [role="radio"], [role="slider"], [role="switch"], [role="textbox"]'

function targetMatches(target: EventTarget | null, selector: string) {
  if (!target || typeof (target as Element).closest !== 'function') return false
  return Boolean((target as Element).closest(selector))
}

export function isInteractiveMediaRowTarget(target: EventTarget | null) {
  return targetMatches(target, MEDIA_ROW_INTERACTIVE_SELECTOR)
}

export function shouldStartMediaRowDrag(event: {
  button: number
  pointerType: string
  target: EventTarget | null
}) {
  return (
    event.pointerType === 'mouse' &&
    event.button === 0 &&
    !targetMatches(event.target, MEDIA_ROW_DRAG_BLOCKING_SELECTOR)
  )
}
