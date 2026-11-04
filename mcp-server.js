import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { PROMPTS } from './prompts.js';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
    console.error("Ключи в .env не найдены");
    process.exit(1);
}

const server = new McpServer({
    name: "spongebob-server",
    version: "1.0.0"
});

async function processImage(inputPath, prompt, url) {
    const formData = new FormData();
    formData.append("prompt", prompt);
    if (inputPath) {
        const imageBlob = new Blob([fs.readFileSync(inputPath)], { type: 'image/png' });
        formData.append("input_image_0", imageBlob, "input.png");
    }
    formData.append("width", "1024");
    formData.append("height", "1024");

    const response = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}` },
        body: formData,
        duplex: 'half',
        signal: AbortSignal.timeout(20000) 
    });

    if (!response.ok) {
        if (response.status === 400) throw new Error("CENSORED");
        throw new Error(`Cloudflare Error: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (contentType.includes("application/json")) {
        const json = JSON.parse(buffer.toString('utf-8'));
        let base64Image = json.result?.image;
        if (base64Image && base64Image.includes("base64,")) {
            base64Image = base64Image.split("base64,")[1];
        }
        return Buffer.from(base64Image, 'base64');
    }
    return buffer;
}

server.tool(
    "createMeme",
    "Генерирует сцену и персонажа в нужной позе.",
    {
        userImagePath: z.string().describe("Путь к загруженному фото"),
        characterPath: z.string().describe("Путь к ПНГ персонажа"),
        characterName: z.string().describe("Имя персонажа"),
        sceneDescription: z.string().describe("Описание сцены"),
        traceId: z.string().describe("Уникальный ID запроса")
    },
    async ({ userImagePath, characterPath, characterName, sceneDescription, traceId }) => {
        try {
            const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`;

            let mainName = `main_${Date.now()}.jpg`;
            let mainGenerated = false;
            const maxAttempts = 3;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    console.error(`[${traceId}] Генерирую главную сцену (попытка ${attempt} из ${maxAttempts})...`);
                    
                    let mainPrompt = PROMPTS.mainScene(sceneDescription, attempt);
                    let mainBuffer = await processImage(userImagePath, mainPrompt, url);
                    fs.writeFileSync(path.join(process.cwd(), "generated", mainName), mainBuffer);
                    
                    mainGenerated = true;
                    console.error(` Главная сцена сгенерирована с попытки ${attempt}!`);
                    break; 
                    
                } catch (e) {
                    console.error(`! Попытка ${attempt} не удалась (${e.message}).`);
                    if (attempt < maxAttempts) {
                        const delay = 1000 * Math.pow(2, attempt - 1);
                        console.error(`[${traceId}]  Ждем ${delay}мс перед повторной попыткой...`);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }

            if (!mainGenerated) {
                console.error(`! Все попытки провалились. Использую оригинал для главной сцены.`);
                fs.copyFileSync(userImagePath, path.join(process.cwd(), "generated", mainName));
            }

            console.error(` Начинаю генерацию ${characterName}...`);
            let charName = `char_${Date.now()}.png`;
            let charGenerated = false;
            const charMaxAttempts = 3;

            for (let attempt = 1; attempt <= charMaxAttempts; attempt++) {
                try {
                    console.error(`[${traceId}] Генерирую персонажа (попытка ${attempt} из ${charMaxAttempts})...`);
                    
                    let charPrompt = PROMPTS.character(characterName, sceneDescription, attempt);
                    let charBuffer = await processImage(characterPath, charPrompt, url);
                    fs.writeFileSync(path.join(process.cwd(), "generated", charName), charBuffer);
                    
                    charGenerated = true;
                    console.error(` Персонаж сгенерирован с попытки ${attempt}!`);
                    break; 
                    
                } catch (e) {
                    console.error(`! Попытка ${attempt} для персонажа не удалась (${e.message}).`);
                    if (attempt < charMaxAttempts) await new Promise(r => setTimeout(r, 1500));
                }
            }

            if (!charGenerated) {
                console.error(`! Все попытки для персонажа провалились. Отправляю оригинал.`);
                const originalCopy = `original_${Date.now()}.png`;
                fs.copyFileSync(characterPath, path.join(process.cwd(), "generated", originalCopy));
                charName = originalCopy; 
            }

            return { 
                content: [{ 
                    type: "text", 
                    text: JSON.stringify({ mainImage: mainName, characterImage: charName }) 
                }] 
            };

        } catch (e) {
            console.error(`! КРИТИЧЕСКАЯ ОШИБКА: ${e.message}`);
            return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] }; 
        }
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);