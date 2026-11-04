import express from 'express';
import multer from 'multer';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import ollama from "ollama";
import fs from "fs";
import path from "path";
import crypto from 'crypto';

let historyLlava = [];
let historyMood = [];
let historyQwen = [];

const app = express();
app.use(express.static('public'));
app.use('/generated', express.static('generated'));
app.use(express.json());

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('generated')) fs.mkdirSync('generated');
const upload = multer({ dest: 'uploads/' });

const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp-server.js"],
    env: process.env
});
const mcpClient = new Client({ name: "web-client", version: "1.0.0" }, { capabilities: {} });
await mcpClient.connect(transport);

const moodColors = {
    happy: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    sad: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    angry: 'linear-gradient(135deg, #ff9a9e 0%, #c73d4b 100%)',
    scared: 'linear-gradient(135deg, #4b134f 0%, #9771d6 100%)',
    calm: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
    neutral: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)'
};

app.post('/api/generate', upload.single('image'), async (req, res) => {
    const traceId = crypto.randomUUID();
    console.log(`\n[${traceId}] ▶ Начало обработки запроса`);
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const userImagePath = req.file.path;
    
    const characterFile = req.body.character; 
    const characterPath = path.join(process.cwd(), 'pictures', characterFile);

    let characterName = characterFile.replace('.png', ''); 
    if (characterName === 'sponge_bob') characterName = 'Губка Боб';
    if (characterName === 'patrik') characterName = 'Патрик';
    if (characterName === 'sandy') characterName = 'Сэнди';
    if (characterName === 'skvidvart') characterName = 'Сквидвард';

    try {
        console.log(`\n LLaVA смотрит на фото...`);
        const imageBuffer = fs.readFileSync(userImagePath).toString('base64');
        
        const visionResponse = await ollama.chat({
            model: 'llava',
            messages: [{
                role: 'user',
                content: 'Describe the action and mood in 1 short sentence. Example: "A girl is happily riding a roller coaster". ',
                images: [imageBuffer]
            }]
        });
        const sceneDescription = visionResponse.message.content;
        
        historyLlava.push({ role: "user", content: "[Изображение]" });
        historyLlava.push({ role: "assistant", content: sceneDescription });
        
        console.log(` Сцена: ${sceneDescription}`);

        console.log(` Определяю настроение...`);
        const moodResponse = await ollama.chat({
            model: 'qwen2.5:3b',
            messages: [{ 
                role: 'user', 
                content: `Read this scene: "${sceneDescription}". Reply with EXACTLY ONE WORD from this list: happy, sad, angry, scared, calm, neutral. Do not write anything else. IT IS VERY IMPORTANT PLEASE ONLY ONE WORD FROM LIST!!!` 
            }]
        });
        
        let mood = moodResponse.message.content.toLowerCase().trim().replace(/[^a-z]/g, '');
        if (!moodColors[mood]) mood = 'neutral';
        
        historyMood.push({ role: "user", content: sceneDescription });
        historyMood.push({ role: "assistant", content: mood });
        
        console.log(` Настроение: ${mood}`);

        console.log(` Qwen пишет текст...`);
        const textResponse = await ollama.chat({
            model: 'qwen2.5:3b',
            messages: [
                { 
                    role: 'system', 
                    content: `Ты персонаж ${characterName} из Спанч Боба. Пиши как будто ты - этот персонаж. Строго запрещено использовать прямую речь по типу "Персонаж: реплика". Ты говоришь ТОЛЬКО реплику. Нельзя говорить о себе в третьем лице если нужно. ` 
                },
                { 
                    role: 'user', 
                    content: `Событие: "${sceneDescription}". Напиши короткую (примерно до 10 слов) реплику. Реплика должна быть связной и понятной, на русском, без оскорблений и мата, прямо связанной с событием, как бы ты отреагировал.` 
                },
                ...historyQwen.slice(-5)
            ]
        });
        
        let speechText = textResponse.message.content;
        if (!speechText || speechText.trim() === "") {
            console.error("! Qwen вернула пустоту. Использую заглушку.");
            speechText = "Без комментариев..."; 
        } else {
            speechText = speechText.trim();
        }
        
        historyQwen.push({ role: "user", content: sceneDescription });
        historyQwen.push({ role: "assistant", content: speechText });
        
        console.log(` Реплика: ${speechText}`);

        console.log(`+Вызываю MCP...`);
        const result = await mcpClient.callTool({
            name: "createMeme",
            arguments: {
                userImagePath: userImagePath,
                characterPath: characterPath,
                characterName: characterName,
                sceneDescription: sceneDescription,
                traceId: traceId
            }
        }, undefined, { timeout: 120000 });

        const data = JSON.parse(result.content[0].text);

        res.json({ 
            success: true, 
            mainImageUrl: `/generated/${data.mainImage}`,
            characterImageUrl: `/generated/${data.characterImage}`,
            speechText: speechText,
            moodColor: moodColors[mood]
        });

    } catch (error) {
        console.error("Ошибка:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    res.json({
        llava_history: historyLlava,
        mood_history: historyMood,
        qwen_history: historyQwen
    });
});

app.listen(3000, () => console.log(' Веб-сервер: http://localhost:3000'));