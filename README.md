# BoxChat - 炫酷的AI聊天应用

一个基于 Next.js 构建的现代化AI聊天应用，具有炫酷的界面设计和流畅的交互体验。

## ✨ 特性

- 🎨 **炫酷界面设计** - 现代化的玻璃态效果、渐变背景和流畅动画
- 🤖 **多模型支持** - 支持 GPT-3.5、GPT-4、Claude 3 等多种AI模型
- 💬 **智能对话** - 支持上下文记忆的连续对话
- 📱 **响应式设计** - 完美适配桌面端和移动端
- 🎭 **丰富动效** - Framer Motion 驱动的流畅动画效果
- 💾 **本地存储** - 聊天记录和设置本地保存
- ⚙️ **灵活配置** - 可自定义API Key、模型参数等设置
- 🎯 **高性能** - 基于 Next.js 14 和 React 18 构建

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
npm start
```

## ⚙️ 配置

1. 点击左下角的"设置"按钮
2. 输入您的API Key
3. 选择合适的AI模型
4. 调整温度和最大Token等参数
5. 保存设置

### 支持的API

- **V-API** (默认): `https://api-gpt-ge.apifox.cn/5069242m0/v1`
- **OpenAI**: `https://api.openai.com/v1`
- **其他兼容OpenAI格式的API**

### 支持的模型

- GPT-3.5 Turbo
- GPT-4
- GPT-4 Turbo  
- Claude 3 Haiku
- Claude 3 Sonnet
- Claude 3 Opus

## 🎨 界面特色

### 炫酷效果
- 玻璃态（Glassmorphism）设计
- 动态渐变背景
- 粒子动画效果
- 霓虹灯发光效果
- 流体动画交互

### 交互体验
- 打字机效果
- 消息气泡动画
- 悬浮效果
- 加载动画
- 响应式布局

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **图标**: Lucide React
- **UI组件**: Radix UI
- **状态管理**: React Hooks

## 📁 项目结构

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css     # 全局样式
│   ├── layout.tsx      # 根布局
│   └── page.tsx        # 主页面
├── components/         # React组件
│   ├── ChatInput.tsx   # 聊天输入框
│   ├── ChatList.tsx    # 消息列表
│   ├── ChatMessage.tsx # 消息气泡
│   ├── Sidebar.tsx     # 侧边栏
│   └── SettingsModal.tsx # 设置模态框
├── lib/                # 工具库
│   ├── api.ts          # API服务
│   └── utils.ts        # 工具函数
└── types/              # 类型定义
    └── chat.ts         # 聊天相关类型
```

## 🔧 自定义配置

### 样式定制

编辑 `src/app/globals.css` 来自定义颜色主题和动画效果。

### API集成

修改 `src/lib/api.ts` 来集成不同的AI服务提供商。

### 添加新功能

在 `src/components/` 目录下创建新组件，并在主页面中引用。

## 📱 移动端支持

应用完全响应式设计，支持：
- 触摸手势
- 移动端优化布局
- 自适应字体大小
- 移动端专用交互

## 🎯 性能优化

- 懒加载组件
- 图片优化
- 代码分割
- 缓存策略
- 压缩资源

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看控制台错误信息
2. 检查API Key配置
3. 确认网络连接
4. 提交Issue描述问题

---

**享受与AI的炫酷对话体验！** ✨
# ChatVortex
