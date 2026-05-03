const mineflayer = require('mineflayer')
const {
    Vec3
} = require('vec3')
const Jimp = require('jimp').Jimp || require('jimp');
const axios = require('axios')
const fs = require('fs')

let passed_antibot = false;

const CONFIG = {
    host: 'mc.kalogrief.pw',
    port: 25565,
    username: 'SampleBlockBypass',

    api_key: "B1_YOUR_BARE_API_KEY",

    version: '1.20.1',
    triggerWord: 'цифры',
	
    mirrorBlocks: true,
    mirrorAnswer: false,

    scale: 8,
    padding: 50,

    scanPos1: {
        x: 107,
        y: 105,
        z: 110
    },

    scanPos2: {
        x: 93,
        y: 101,
        z: 110
    }
}

const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version
})

bot.once('spawn', () => {
	// ...
})

bot.on('physicTick', () => {
    if (!bot.entity) return
    if (passed_antibot) return
    bot.entity.velocity.x *= 0.0
    bot.entity.velocity.y *= 0.0
    bot.entity.velocity.z *= 0.0
})

bot.on('messagestr', async (message) => {
    console.log('[CHAT]', message)

    if (message.toLowerCase().includes("авторизация")) {
        passed_antibot = true;
        console.log('Блочный антибот пройден, бот на авторизации..')
        // Сюда можешь добавить отправку /login пароль или регистрацию
    }
	
	// Проверка на триггер, выплюнуло ли сообщение содержащее "цифры"
	// Captcha » Пожалуйста, введите цифры, которые вы видите.
    if (message.toLowerCase().includes(CONFIG.triggerWord.toLowerCase())) {
        console.log('[CAPTCHA] trigger detected')

        try {
            const matrix = scanTextFront(
                CONFIG.scanPos1,
                CONFIG.scanPos2
            )

            const image = await buildImage(
                matrix,
                CONFIG.scale,
                CONFIG.padding
            )

            await image.writeAsync('captcha.png')
            const answer = await sendAPI(image)
			
            if (!answer) {
                console.log('[CAPTCHA] empty answer')
                return
            }
			
            let finalAnswer = answer
            if (CONFIG.mirrorAnswer) {
                finalAnswer = answer.split('').reverse().join('')
            }
			
            bot.chat(finalAnswer)
        } catch (err) {
            console.error(err)
        }
    }
})


function scanTextFront(pos1, pos2) {
    const minX = Math.min(pos1.x, pos2.x)
    const maxX = Math.max(pos1.x, pos2.x)

    const minY = Math.min(pos1.y, pos2.y)
    const maxY = Math.max(pos1.y, pos2.y)

    const z = pos1.z

    const width = maxX - minX + 1
    const height = maxY - minY + 1

    const pixels = Array.from({
            length: height
        }, () =>
        Array(width).fill(false)
    )

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {

            const block = bot.blockAt(new Vec3(x, y, z))

            let filled = false

            if (block) {
                filled = block.name !== 'air' &&
                    block.name !== 'cave_air' &&
                    block.name !== 'void_air'
            }

            let px = x - minX
            let py = (maxY - y)

            if (CONFIG.mirrorBlocks) {
                px = width - 1 - px
            }

            pixels[py][px] = filled
        }
    }

    return pixels
}

async function buildImage(data, scale, paddingPx) {

    const h = data.length;
    const w = data[0].length;
    const imgW = w * scale + paddingPx * 2;
    const imgH = h * scale + paddingPx * 2;
    const image = await Jimp.create(imgW, imgH, 0x00c8ffff);
    const red = Jimp.rgbaToInt(255, 0, 0, 255);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!data[y][x]) continue;

            for (let sy = 0; sy < scale; sy++) {
                for (let sx = 0; sx < scale; sx++) {
                    image.setPixelColor(
                        red,
                        paddingPx + x * scale + sx,
                        paddingPx + y * scale + sy
                    );
                }
            }
        }
    }

    return image;
}

async function sendAPI(image) {
    const site = "http://5.42.211.111/";
    try {
        let base64Image;

        if (Buffer.isBuffer(image)) {
            base64Image = image.toString('base64');

        } else if (image.getBufferAsync) {
            const buffer = await image.getBufferAsync('image/png');
            base64Image = buffer.toString('base64');

        } else {
            throw new Error('Неподдерживаемый тип image');
        }

        const postData = new URLSearchParams({
            key: CONFIG.api_key,
            method: "base64",
            body: base64Image
        });

        const postResponse = await fetch(`${site}in.php`, {
            method: "POST",
            body: postData
        });

        const postText = await postResponse.text();

        console.log('Ответ in.php:', postText);

        if (!postText.includes("|")) {
            throw new Error(`Некорректный ответ сервера: ${postText}`);
        }

        const captcha_id = postText.split("|")[1].trim();

        await new Promise(res => setTimeout(res, 500));

        const getData = new URLSearchParams({
            key: CONFIG.api_key,
            action: "get",
            id: captcha_id
        });

        const getResponse = await fetch(`${site}res.php?${getData}`);

        const getText = await getResponse.text();

        console.log('Ответ res.php:', getText);

        if (getText.startsWith("ERROR")) {
            throw new Error(`Ошибка API: ${getText}`);
        }

        if (!getText.includes("|")) {
            throw new Error(`Некорректный формат ответа: ${getText}`);
        }

        return getText.split("|")[1]?.trim() || null;

    } catch (error) {
        console.error('Ошибка в sendAPI:', error.message);
        return null;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

bot.on('kicked', console.log)
bot.on('error', console.log)