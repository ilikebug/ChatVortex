# 🔐 安全配置说明

## API Key 安全配置

### ⚠️ 重要提醒
**绝对不要将 API Key 硬编码在源代码中！**

### 🔧 配置方法

#### 方法1：环境变量（推荐）
1. 复制 `env.example` 为 `.env.local`
2. 在 `.env.local` 中填入您的配置：
```bash
NEXT_PUBLIC_DEFAULT_API_KEY=your-api-key-here
NEXT_PUBLIC_DEFAULT_BASE_URL=https://api.gpt.ge/v1
NEXT_PUBLIC_DEFAULT_MODEL=gpt-3.5-turbo
```

#### 方法2：应用内设置
1. 启动应用后点击设置按钮
2. 在"API 配置"部分输入您的 API Key
3. 配置会安全存储在浏览器本地存储中

### 📁 文件说明
- `.env.local` - 本地环境变量（已添加到 .gitignore，不会被提交）
- `env.example` - 配置模板（可以安全提交）
- `.gitignore` - 确保敏感文件不被提交

### 🛡️ 安全最佳实践
1. ✅ 使用环境变量存储敏感信息
2. ✅ 定期更换 API Key
3. ✅ 不要在截图或日志中暴露 API Key
4. ✅ 确保 .env.local 在 .gitignore 中
5. ❌ 不要将 API Key 硬编码在代码中
6. ❌ 不要将包含 API Key 的文件提交到 git

### 🔍 如何检查
运行以下命令确保没有敏感信息被意外提交：
```bash
git log --all --grep="sk-" --oneline
git log --all -S "sk-" --oneline
```

如果发现任何 API Key 被提交，请立即：
1. 撤销相关的 API Key
2. 生成新的 API Key
3. 使用 git 清理历史记录