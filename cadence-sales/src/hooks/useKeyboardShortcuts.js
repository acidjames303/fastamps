import { useEffect, useRef } from "react";

// Keyboard shortcuts for the Dialer calling workflow.
// Shortcuts are disabled while typing in input/textarea/select fields,
// unless a shortcut explicitly sets ignoreTyping: true.
//
// Usage:
//   useKeyboardShortcuts([
//     { key: 'Enter', meta: true, action: () => saveAndNext() },
//     { key: 'n', action: () => focusNotes() },
//   ], { enabled: isDialerActive });

export function useKeyboardShortcuts(shortcuts, options = {}) {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        if (!shortcut.ignoreTyping && isTyping) continue;

        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;

        const metaMatch = !!shortcut.meta === (e.metaKey || e.ctrlKey);
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const altMatch = !!shortcut.alt === e.altKey;
        if (!metaMatch || !shiftMatch || !altMatch) continue;

        e.preventDefault();
        shortcut.action(e);
        break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}