"use client";

import { memo } from "react";
import { ImageData } from "@/types/chat";

interface MessageRendererProps {
  content: string;
  className?: string;
  images?: ImageData[]; // 添加图片数据支持
}

// 简单的Markdown渲染器（不依赖外部库）
function SimpleMarkdownRenderer({
  content,
  className = "",
  images = [],
}: MessageRendererProps) {
  // 处理代码块
  const renderCodeBlocks = (text: string) => {
    return text.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
      return `<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-4"><code class="language-${lang || "text"}">${code.trim()}</code></pre>`;
    });
  };

  // 处理内联代码
  const renderInlineCode = (text: string) => {
    return text.replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-200 text-gray-800 px-2 py-1 rounded text-sm">$1</code>'
    );
  };

  // 处理标题
  const renderHeaders = (text: string) => {
    return text
      .replace(
        /^### (.*$)/gm,
        '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>'
      )
      .replace(
        /^## (.*$)/gm,
        '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>'
      )
      .replace(
        /^# (.*$)/gm,
        '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>'
      );
  };

  // 处理列表
  const renderLists = (text: string) => {
    // 无序列表
    text = text.replace(/^[\s]*[-*+]\s(.+)$/gm, '<li class="ml-4">• $1</li>');
    // 有序列表
    text = text.replace(/^[\s]*\d+\.\s(.+)$/gm, '<li class="ml-4">$1</li>');

    // 包装连续的li标签
    text = text.replace(/(<li[^>]*>.*<\/li>\s*)+/g, '<ul class="my-2">$&</ul>');

    return text;
  };

  // 处理粗体和斜体
  const renderTextStyles = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/__(.*?)__/g, '<strong class="font-bold">$1</strong>')
      .replace(/_(.*?)_/g, '<em class="italic">$1</em>');
  };

  // 处理链接
  const renderLinks = (text: string) => {
    return text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  };

  // 处理数学公式（简单的LaTeX语法）
  const renderMath = (text: string) => {
    // 行内数学公式 $...$
    text = text.replace(
      /\$([^$]+)\$/g,
      '<span class="math-inline bg-blue-50 px-2 py-1 rounded font-mono text-blue-800">$1</span>'
    );
    // 块级数学公式 $$...$$
    text = text.replace(
      /\$\$([\s\S]+?)\$\$/g,
      '<div class="math-block bg-blue-50 p-4 rounded-lg my-4 text-center font-mono text-blue-800">$1</div>'
    );
    return text;
  };

  // 处理换行
  const renderLineBreaks = (text: string) => {
    return text.replace(/\n/g, "<br>");
  };

  // 渲染管道
  let processedContent = content;
  processedContent = renderCodeBlocks(processedContent);
  processedContent = renderHeaders(processedContent);
  processedContent = renderLists(processedContent);
  processedContent = renderTextStyles(processedContent);
  processedContent = renderLinks(processedContent);
  processedContent = renderMath(processedContent);
  processedContent = renderInlineCode(processedContent);
  processedContent = renderLineBreaks(processedContent);

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {/* 图片显示区域 */}
      {images && images.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.url}
                alt={image.name}
                className="max-w-xs max-h-64 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // 点击图片可以放大查看
                  const newWindow = window.open();
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>${image.name}</title></head>
                        <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                          <img src="${image.url}" alt="${image.name}" style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.1);" />
                        </body>
                      </html>
                    `);
                  }
                }}
              />
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 文本内容 */}
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
}

export const MessageRenderer = memo(SimpleMarkdownRenderer);
