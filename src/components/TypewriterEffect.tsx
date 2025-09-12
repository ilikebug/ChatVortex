"use client";

import { useState, useEffect, memo } from "react";
import { MessageRenderer } from "./MessageRenderer";

interface TypewriterEffectProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  disabled?: boolean; // 是否禁用打字机效果
  isStreaming?: boolean; // 是否正在流式接收
}

export const TypewriterEffect = memo(function TypewriterEffect({
  text,
  speed = 10, // 更快的速度适合流式输入
  className = "",
  onComplete,
  disabled = false,
  isStreaming = false
}: TypewriterEffectProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // 如果禁用打字机效果，直接显示全部文本
    if (disabled) {
      setDisplayedText(text);
      onComplete?.();
      return;
    }

    // 流式模式：直接显示最新文本，不需要打字机效果
    if (isStreaming) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }

    // 非流式模式：传统打字机效果
    if (!text) {
      setDisplayedText("");
      setCurrentIndex(0);
      return;
    }

    // 如果文本变长了，继续从当前位置打字
    if (text.length > currentIndex) {
      const timer = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          
          if (nextIndex >= text.length) {
            onComplete?.();
            clearInterval(timer);
            return prevIndex;
          }
          
          setDisplayedText(text.slice(0, nextIndex));
          return nextIndex;
        });
      }, speed);

      return () => clearInterval(timer);
    } else if (text.length < currentIndex) {
      // 如果文本变短了，重置
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }
  }, [text, speed, onComplete, disabled, isStreaming, currentIndex]);

  return (
    <div className="relative">
      <MessageRenderer 
        content={displayedText}
        className={className}
      />
      {/* 流式接收时显示光标 */}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" />
      )}
    </div>
  );
});