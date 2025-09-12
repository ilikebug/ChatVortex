import { useEffect, useCallback, useRef } from 'react'
import type { KeyboardShortcut, ShortcutsConfig } from '@/types/chat'

// 快捷键动作类型
export type ShortcutActions = {
  openHistory: () => void
  newChat: () => void
  openSettings: () => void
  focusInput: () => void
  closeModal: () => void
  selectPrevSession: () => void
  selectNextSession: () => void
  deleteCurrentSession: () => void
}

// 解析快捷键组合字符串
function parseShortcutKeys(keys: string): {
  ctrl: boolean
  cmd: boolean
  shift: boolean
  alt: boolean
  key: string
} {
  const parts = keys.toLowerCase().split('+')
  const result = {
    ctrl: false,
    cmd: false,
    shift: false,
    alt: false,
    key: ''
  }

  for (const part of parts) {
    switch (part.trim()) {
      case 'ctrl':
        result.ctrl = true
        break
      case 'cmd':
      case 'command':
        result.cmd = true
        break
      case 'shift':
        result.shift = true
        break
      case 'alt':
      case 'option':
        result.alt = true
        break
      default:
        result.key = part.trim()
        break
    }
  }

  return result
}

// 检查事件是否匹配快捷键
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const parsed = parseShortcutKeys(shortcut.keys)
  const isMac = /macintosh|mac os x/i.test(navigator.userAgent)

  // 检查修饰键
  const ctrlMatch = parsed.ctrl ? event.ctrlKey : !event.ctrlKey
  const cmdMatch = parsed.cmd ? (isMac ? event.metaKey : event.ctrlKey) : (!event.metaKey && !event.ctrlKey)
  const shiftMatch = parsed.shift ? event.shiftKey : !event.shiftKey
  const altMatch = parsed.alt ? event.altKey : !event.altKey

  // 检查主键
  let keyMatch = false
  if (parsed.key === 'escape') {
    keyMatch = event.key === 'Escape'
  } else if (parsed.key === 'arrowup') {
    keyMatch = event.key === 'ArrowUp'
  } else if (parsed.key === 'arrowdown') {
    keyMatch = event.key === 'ArrowDown'
  } else if (parsed.key === 'arrowleft') {
    keyMatch = event.key === 'ArrowLeft'
  } else if (parsed.key === 'arrowright') {
    keyMatch = event.key === 'ArrowRight'
  } else if (parsed.key === 'enter') {
    keyMatch = event.key === 'Enter'
  } else if (parsed.key === 'backspace') {
    keyMatch = event.key === 'Backspace'
  } else if (parsed.key === 'space') {
    keyMatch = event.key === ' '
  } else {
    keyMatch = event.key.toLowerCase() === parsed.key.toLowerCase()
  }

  return ctrlMatch && cmdMatch && shiftMatch && altMatch && keyMatch
}

// 判断是否应该忽略快捷键（在输入框中时）
function shouldIgnoreShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const target = event.target as HTMLElement
  const tagName = target.tagName.toLowerCase()
  const isInputField = tagName === 'input' || tagName === 'textarea' || target.contentEditable === 'true'

  // 在输入框中时，只允许特定快捷键
  if (isInputField) {
    const allowedInInput = ['closeModal', 'openHistory', 'openSettings', 'newChat']
    return !allowedInInput.includes(shortcut.action)
  }

  // 检查是否在模态框中 - 如果在模态框中，某些导航快捷键应该被模态框处理
  const isInModal = document.querySelector('[data-modal-active]') !== null
  if (isInModal) {
    // 在模态框中时，ArrowUp/ArrowDown 应该由模态框处理，而不是全局快捷键
    if (['selectPrevSession', 'selectNextSession'].includes(shortcut.action)) {
      return true
    }
  }

  return false
}

export function useKeyboardShortcuts(
  shortcutsConfig: ShortcutsConfig | undefined,
  actions: ShortcutActions
) {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!shortcutsConfig?.enabled) return

    for (const shortcut of shortcutsConfig.shortcuts) {
      if (!shortcut.enabled) continue

      if (matchesShortcut(event, shortcut) && !shouldIgnoreShortcut(event, shortcut)) {
        event.preventDefault()
        event.stopPropagation()

        // 执行相应的动作
        const action = actionsRef.current[shortcut.action]
        if (action) {
          action()
        }
        break
      }
    }
  }, [shortcutsConfig])

  useEffect(() => {
    if (!shortcutsConfig?.enabled) return

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown, shortcutsConfig?.enabled])

  // 返回一些实用的辅助函数
  return {
    // 获取快捷键的显示文本
    getShortcutDisplay: (shortcutId: string): string => {
      const shortcut = shortcutsConfig?.shortcuts.find(s => s.id === shortcutId)
      if (!shortcut) return ''

      const isMac = /macintosh|mac os x/i.test(navigator.userAgent)
      return shortcut.keys
        .replace(/Cmd/g, isMac ? '⌘' : 'Ctrl')
        .replace(/Ctrl/g, isMac ? '⌃' : 'Ctrl')
        .replace(/Shift/g, isMac ? '⇧' : 'Shift')
        .replace(/Alt/g, isMac ? '⌥' : 'Alt')
        .replace(/ArrowUp/g, '↑')
        .replace(/ArrowDown/g, '↓')
        .replace(/ArrowLeft/g, '←')
        .replace(/ArrowRight/g, '→')
        .replace(/Escape/g, 'Esc')
        .replace(/Backspace/g, isMac ? '⌫' : 'Backspace')
    },

    // 检查快捷键是否启用
    isShortcutEnabled: (shortcutId: string): boolean => {
      const shortcut = shortcutsConfig?.shortcuts.find(s => s.id === shortcutId)
      return shortcut?.enabled ?? false
    },

    // 获取所有快捷键
    getAllShortcuts: (): KeyboardShortcut[] => {
      return shortcutsConfig?.shortcuts ?? []
    }
  }
}

// 导出快捷键相关的工具函数
export { parseShortcutKeys, matchesShortcut }