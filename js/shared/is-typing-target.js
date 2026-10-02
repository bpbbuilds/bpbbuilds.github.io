/**
 * True when keyboard events should stay in a text field (not board/scrubber).
 * @param {EventTarget | null} t
 */
export function isTypingTarget(t) {
  if (!(t instanceof HTMLElement)) return false;
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (t.isContentEditable) return true;
  return Boolean(t.closest('[contenteditable="true"]'));
}
