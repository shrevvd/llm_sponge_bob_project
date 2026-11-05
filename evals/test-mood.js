import ollama from "ollama";

const testCases = [
    { text: "Мальчик плачет на улице", expected: "sad" },
    { text: "Девочка весело катается на карусели", expected: "happy" },
    { text: "Злой монстр разрушает город", expected: "angry" },
    { text: "Человек спокойно сидит на скамейке", expected: "calm" },
    { text: "Кто-то внезапно выпрыгнул из темноты", expected: "scared" },
    { text: "Мужчина грустит, глядя в окно", expected: "sad" },
    { text: "Дети смеются и играют с собакой", expected: "happy" },
    { text: "Два человека ссорятся и кричат друг на друга", expected: "angry" },
    { text: "Девушка медитирует с закрытыми глазами", expected: "calm" },
    { text: "Женщина в ужасе убегает от змеи", expected: "scared" },
    { text: "Парень получил двойку и расстроился", expected: "sad" },
    { text: "Семья празднует день рождения с тортом", expected: "happy" },
    { text: "Водитель злится в пробке и сигналит", expected: "angry" },
    { text: "Парень лежит на траве и смотрит на облака", expected: "calm" },
    { text: "Кот неожиданно уронил вазу и напугал хозяйку", expected: "scared" },
    { text: "Девушка плачет из-за разбитого телефона", expected: "sad" },
    { text: "Друзья обнимаются при встрече", expected: "happy" },
    { text: "Начальник орет на подчиненного", expected: "angry" },
    { text: "Человек пьет чай и читает книгу", expected: "calm" },
    { text: "Ребенок боится грозы и прячется под одеялом", expected: "scared" },
    { text: "Парень скучает на скучной лекции", expected: "neutral" },
    { text: "Женщина улыбается, глядя на фото", expected: "happy" },
    { text: "Мужчина топает ногой от ярости", expected: "angry" },
    { text: "Студентка грустит из-за расставания", expected: "sad" },
    { text: "Пара танцует вальс на площади", expected: "happy" },
    { text: "Человек замер от страха, увидев медведя", expected: "scared" },
    { text: "Бабушка вяжет носки в кресле-качалке", expected: "calm" },
    { text: "Подросток закатывает истерику", expected: "angry" },
    { text: "Мужчина плачет на похоронах", expected: "sad" },
    { text: "Ребенок радуется новой игрушке", expected: "happy" }
];

async function runEvals() {
    console.log("Запуск тестов для Qwen (определение эмоций)...\n");
    let passed = 0;
    const stats = {};

    for (const test of testCases) {
        const response = await ollama.chat({
            model: 'qwen2.5:3b',
            messages: [{ 
                role: 'user', 
                content: `Read this scene: "${test.text}". Reply with EXACTLY ONE WORD from this list: happy, sad, angry, scared, calm, neutral. Do not write anything else.` 
            }]
        });
        
        const moodText = response.message.content.toLowerCase();
        let mood = 'neutral';
        if (moodText.includes('happy')) mood = 'happy';
        else if (moodText.includes('sad')) mood = 'sad';
        else if (moodText.includes('angry')) mood = 'angry';
        else if (moodText.includes('scared')) mood = 'scared';
        else if (moodText.includes('calm')) mood = 'calm';

        const isPassed = mood === test.expected;
        if (isPassed) passed++;
        
        if (!stats[test.expected]) stats[test.expected] = { total: 0, correct: 0 };
        stats[test.expected].total++;
        if (isPassed) stats[test.expected].correct++;

        console.log(`${isPassed ? '✅' : '❌'} Текст: "${test.text}"`);
        console.log(`   Ожидали: ${test.expected} | Получили: ${mood}\n`);
    }
    
    const accuracy = ((passed / testCases.length) * 100).toFixed(1);
    console.log(`\n Общая точность: ${passed}/${testCases.length} (${accuracy}%)`);
    
    console.log("\n Точность по классам:");
    for (const [emotion, data] of Object.entries(stats)) {
        const acc = ((data.correct / data.total) * 100).toFixed(1);
        console.log(`   ${emotion}: ${data.correct}/${data.total} (${acc}%)`);
    }
}

runEvals();