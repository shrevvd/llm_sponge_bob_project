import ollama from "ollama";

const testCases = [
    { text: "Мальчик плачет на улице", expected: "sad" },
    { text: "Девочка весело катается на карусели", expected: "happy" },
    { text: "Злой монстр разрушает город", expected: "angry" }
];

async function runEvals() {
    console.log(" Запуск тестов для Qwen \n");
    let passed = 0;

    for (const test of testCases) {
        const response = await ollama.chat({
            model: 'qwen2.5:3b',
            messages: [
                { 
                    role: 'system', 
                    content: `You are an emotion classifier. Classify the scene into EXACTLY ONE WORD: happy, sad, angry, scared, calm, neutral.
                    
                    Examples:
                    - "A boy is crying" -> sad
                    - "A girl is riding a roller coaster and laughing" -> happy
                    - "A monster is destroying a city and roaring" -> angry
                    - "A person is sleeping peacefully" -> calm
                    - "A ghost is jumping out of the dark" -> scared` 
                },
                { 
                    role: 'user', 
                    content: `Read this scene: "${test.text}". Reply with EXACTLY ONE WORD.` 
                }
            ]
        });
        
        const moodText = response.message.content.toLowerCase();
        let mood = 'neutral';
        if (moodText.includes('happy')) mood = 'happy';
        else if (moodText.includes('sad')) mood = 'sad';
        else if (moodText.includes('angry')) mood = 'angry';

        const isPassed = mood === test.expected;
        if (isPassed) passed++;
        
        console.log(`Текст: "${test.text}"`);
        console.log(`Ожидали: ${test.expected} | Получили: ${mood} | ${isPassed ? 'PASS' : 'FAIL'}\n`);
    }
    
    console.log(`📊 Итог: ${passed} из ${testCases.length} тестов пройдено.`);
}

runEvals();