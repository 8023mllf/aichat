AI Roleplay / Aichat

一个「角色扮演 + 搜索筛选 + 小剧场」的中文聊天应用。
支持人物卡与分类检索、对话流式输出、语音输入（ASR）与语音回复（TTS）双轨消息气泡、可扩展的人设系统（后端内置 + 本地自定义）。

✨ 特性

人物卡与分类推荐：按 #动漫 / #游戏 / #历史人物 / … 展示推荐位与小剧场。

搜索：按名字、slug、标签（traits/background/style）检索。

对话：流式生成、消息列表可滚动查看历史。

语音聊天：麦克风一键录音 → 发送语音气泡；AI 会以语音 + 转写文字双轨回复（可点击重放）。

人设系统：

后端：personas.py 里定义 内置人设，并支持 custom_personas.json 热加载 自定义人设。

前端：promos.ts 里定义前台卡片元数据（标签、封面等），用于推荐与搜索。

小剧场·海龟汤：支持四个海龟汤题目的人格，点进对话即可自动出题，过程中只回答「是/否/无关」，猜中后给出汤底。
还包括多种待开发功能。

🚀 快速开始
0) 准备

Node.js ≥ 18（前端）

Python ≥ 3.10（后端）

（可选）在后端配置你的 大模型 / 语音服务 的环境变量（见下文「配置」）。

1) 启动后端（默认 8000 端口）
cd server
python -m venv .venv && source .venv/bin/activate   # Windows 用 .venv\Scripts\activate
pip install -r requirements.txt

# 开发启动
uvicorn main:app --reload --port 8000


前端以 /api/* 访问后端；开发期用 Vite 代理到 http://127.0.0.1:8000，生产可用 Nginx 反代。

2) 启动前端（默认 5173 端口）
cd web
npm i
npm run dev


开发地址：http://127.0.0.1:5173

若跨域，确保 vite.config.ts 含有：

// vite.config.ts（示例）
server: {
  proxy: { '/api': 'http://127.0.0.1:8000' }
}

3) 生产构建与部署
cd web
npm run build            # 产出 dist/
# 用 Nginx/静态服务托管 dist，同时将 /api 反代到后端 8000 端口


模块职责

server/main.py
创建 FastAPI 应用、CORS 配置、挂载 /api/* 路由。

server/api.py

POST /api/session：创建/恢复会话，返回 sessionId。

POST /api/chat/stream：流式对话（SSE 或 chunk），参数：sessionId、personaSlug、userMessage。

GET /api/tts / POST /api/tts：将文本合成音频（mp3/webm）。

GET /api/categories/meta：聚合 traits/background/style（供筛选器使用）。

POST /api/persona/custom（可选）：写入 custom_personas.json。

server/isi.py
封装对 LLM/TTS 的调用：

generate_stream(prompt)：yield token/片段

text_to_speech(text)：返回音频二进制
支持通过环境变量切换供应商/模型。

server/personas.py

PERSONAS：内置人设（含我们新增的 10 类 + 海龟汤 4 题）。

build_system_prompt(p)：把身份/目标/语气/规则拼成 system 指令。

get_persona(slug)：优先内置，再查 custom_personas.json。

get_taxonomies()：从所有人设收集标签，返回 traits/background/style。

server/db.py
简单会话存储 & 缓存（视实现可能是内存/SQLite/文件）。

web/src/pages/Chat.tsx

消息模型：

TextMsg { role, kind:"text", content, audioUrl? }

VoiceMsg { role, kind:"voice", audioUrl, asr? }

发送文本：streamChat() 持续更新最后一条助手消息。

发送语音：startRawRecording() 采集 blob → 语音气泡；ASR 文本仅用于喂给 LLM；助手回复生成 TTS 并把 audioUrl 与文本一起展示。

列表可滚动，底部自动滚动到新消息。

web/src/pages/Home.tsx / Theatre.tsx

fitsCategory() 根据 tags.background / tags.traits / tags.style 进行匹配。

小剧场的 海龟汤 栏仅展示 background: "海龟汤" 的人设。

web/src/pages/Categories.tsx

筛选：多选 traits/background/style + 时间范围 + 排序。

使用 fetchCategoriesMeta() 拉取后端聚合标签。

卡片纵向布局，点击整卡进入聊天。

web/src/promos.ts
人物卡元数据，字段：
name, promoSlug, file, personaSlug, tags{traits[], background, style[]}, updatedAt, classic

search：按 name / promoSlug / tags 分词匹配。

推荐/小剧场：按 tags.background 等筛选。

web/src/mic.ts

isSpeechSupported()：检测 Web Speech API。

startSpeechOnce(lang)：一次性语音识别（ASR）。

startRawRecording(mime)：原始录音，返回 stop() → Blob（用于语音消息气泡）。

web/src/audioQueue.ts
音频串行播放（避免多个音频重叠）。
