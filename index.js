require("dotenv").config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const cron = require("node-cron");

const bot = new Bot(process.env.BOT_TOKEN);
const ADMIN_ID = 368225717;

const adminEditState = new Map();

/* ================= HELPERS ================= */

async function getAllUsersFromDB() {
    const res = await fetch(
        "https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users.json"
    );
    const users = await res.json();
    if (!users) return [];
    return Object.values(users);
}

async function getUserFromDB(telegramId) {
    const users = await getAllUsersFromDB();
    return users.find((user) => user.id === String(telegramId)) || null;
}

function getMenuKeyboard(ctx){
    if (ctx.from?.id === ADMIN_ID) {
        return adminMenuKeyboard;
    }
    return mainMenuKeyboard;
}

function confirmKeyboard() {
    return new InlineKeyboard()
        .text("✅ Подтвердить", "CONFIRM_EDIT")
        .row()
        .text("❌ Отменить", "CANCEL_EDIT");
}

function createUserConfirmKeyboard() {
    return new InlineKeyboard()
        .text("✅ Добавить", "CONFIRM_CREATE")
        .row()
        .text("🔄 Заново", "RESTART_CREATE");
}


/* ================= ACCESS ================= */

bot.use(async (ctx, next) => {
    if (!ctx.from) return;

    const user = await getUserFromDB(ctx.from.id);

    if (!user) {
        await ctx.reply("⛔ У вас нет доступа к этому боту");
        return;
    }

    ctx.dbUser = user;
    return next();
});

/* ================= KEYBOARDS ================= */

const mainMenuKeyboard = new Keyboard()
    .text("🔐 Получить прокси")
    .row()
    .text("☕ Купить мне кофе")
    .row()
    .text("❓ FAQ")
    .resized();

const adminMenuKeyboard = new Keyboard()
    .text("🔐 Получить прокси")
    .row()
    .text("☕ Купить мне кофе")
    .row()
    .text("❓ FAQ")
    .row()
    .text("🛠 АДМИНКА")
    .resized();

const adminMenuKeyboardBtn = new Keyboard()
    .text("Список юзеров")
    .row()
    .text("Добавить юзера")
    .resized();


/* ================= COMMANDS MENU ================= */

bot.api.setMyCommands([
    { command: "start", description: "Запустить бота и открыть меню" },
    { command: "proxy", description: "Получить прокси / ключи" },
    { command: "coffee", description: "Поддержать проект ☕" },
    { command: "faq", description: "Часто задаваемые вопросы" },
]);

/* ================= /start ================= */

bot.command("start", async (ctx) => {
    await ctx.reply(
        "Привет! 👋\n\nВыберите действие:",
        { reply_markup: getMenuKeyboard(ctx) }
    );
});

/* ================= SLASH COMMANDS (FIX) ================= */

bot.command("proxy", async (ctx) => {
    await ctx.reply("Выберите действие 👇", {
        reply_markup: getMenuKeyboard(ctx),
    });
});

bot.command("coffee", async (ctx) => {
    await ctx.reply("Вы можете поддержать проект через кнопку ниже ☕", {
        reply_markup: getMenuKeyboard(ctx),
    });
});

bot.command("faq", async (ctx) => {
    await ctx.reply("Откройте раздел FAQ с помощью кнопки ниже 👇", {
        reply_markup: getMenuKeyboard(ctx),
    });
});

/* ================= REPLY BUTTONS ================= */

bot.hears("🔐 Получить прокси", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("🔑 Ключ Hysteria2", "GET_HYSTERIA")
        .row()
        .text("🔑 Ключ VLESS", "GET_VLESS");

    await ctx.reply(
        "⚠️ *Важная информация* ⚠️\n\n" +
        "Поддержка протокола *VLESS* в ближайшее время будет прекращена.\n" +
        "Рекомендуем заранее перейти на *Hysteria2* и использовать совместимые клиенты.\n\n" +
        "Это обеспечит более стабильную и корректную работу сервиса.",
        { parse_mode: "Markdown" }
    );

    await ctx.reply("Выберите протокол:", {
        reply_markup: keyboard,
    });
});

bot.hears("☕ Купить мне кофе", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("T-Bank", "TBANK")
        .row()
        .text("Yandex-bank", "YABANK")
        .row()
        .text("Alfa-bank", "ALFA");

    await ctx.reply("Выберите банк:", {
        reply_markup: keyboard,
    });
});

bot.hears("🛠 АДМИНКА", async (ctx) => {
    // доп. защита, даже если кнопку увидит кто-то ещё
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply("⛔ Доступ запрещён");
        return;
    }

    await ctx.reply(
        "🛠 *Админ-панель*\n\nВыберите действие:",
        {
            parse_mode: "Markdown",
            reply_markup: adminMenuKeyboardBtn,
        }
    );
});

bot.hears("Список юзеров", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const users = await getAllUsersFromDB();

    if (!users.length) {
        await ctx.reply("Пользователи не найдены");
        return;
    }

    for (const [idd, user] of users.entries()) {
        const keyboard = new InlineKeyboard().text(
            "✏️ Изменить",
            `EDIT_USER:${user.id}`
        );

        await ctx.reply(
            "🧾 Пользователь\n\n" +
            `idd: ${idd}\n` +
            `id: ${user.id}\n` +
            `name: ${user.name || "—"}\n\n` +
            `keyHs:\n${user.keyHs || "—"}\n\n` +
            `keyVl:\n${user.keyVl || "—"}`,
            {
                reply_markup: keyboard,
            }
        );
    }
});

bot.hears("Добавить юзера", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    adminEditState.set(ctx.from.id, {
        mode: "CREATE",
        step: "id",
        user: {},
    });

    await ctx.reply("🆕 Создание пользователя\n\nВведите id:");
});


/* ================= FAQ ================= */

bot.hears("❓ FAQ", async (ctx) => {
    await ctx.reply(
        "❓ *FAQ — часто задаваемые вопросы*\n\n" +

        "📍 *Локация серверов*\n\n" +
        "Протокол *VLESS* работает через сервер, расположенный в *Финляндии*.\n" +
        "В настоящее время работа VLESS может быть нестабильной, и в ближайшей перспективе его поддержка будет постепенно прекращена.\n" +
        "Рекомендуем заранее перейти на *Hysteria2* для более стабильной и предсказуемой работы сервиса.\n\n" +

        "Протокол *Hysteria2* использует сервер, расположенный в *Польше*.\n\n" +

        "📡 *Особенности работы Hysteria2*\n\n" +
        "Обратите внимание, что протокол *Hysteria2* может не работать в мобильных сетях (LTE / 5G).\n" +
        "Для стабильной работы рекомендуется использовать подключение через *Wi-Fi* или проводной интернет.\n\n" +

        "📱 *Клиенты и устройства*\n\n" +
        "Служба поддержки не предоставляет рекомендаций по выбору клиентов для конкретных моделей телефонов или операционных систем.\n\n" +
        "На рынке существует множество VPN-клиентов, и их работа может отличаться в зависимости от:\n" +
        "• устройства;\n" +
        "• версии ОС;\n" +
        "• региона;\n" +
        "• типа сети.\n\n" +
        "Рекомендуем самостоятельно подобрать наиболее подходящий клиент, ориентируясь на официальную документацию и отзывы пользователей.\n\n" +

        "ℹ️ *Важно*\n\n" +
        "Мы стараемся поддерживать стабильную работу сервиса и заранее информируем о любых изменениях.\n" +
        "Если у вас возникают сложности с подключением — в большинстве случаев они связаны с особенностями конкретного устройства или сети.",
        { parse_mode: "Markdown" }
    );
});

bot.on("message:text", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const state = adminEditState.get(ctx.from.id);
    if (!state) return;

    const value = ctx.message.text;

    /* ===== EDIT USER FLOW ===== */
    if (state.field && !state.confirm) {
        adminEditState.set(ctx.from.id, {
            ...state,
            newValue: value,
            confirm: true,
        });

        await ctx.reply(
            `Подтвердите изменение:\n\n` +
            `Поле: ${state.field}\n` +
            `Новое значение:\n${value}`,
            { reply_markup: confirmKeyboard() }
        );

        return;
    }

    /* ===== CREATE USER FLOW ===== */
    if (state.mode === "CREATE") {

        if (state.step === "preview") {
            await ctx.reply("⬇️ Используйте кнопки ниже для подтверждения");
            return;
        }

        if (state.step === "id") {
            state.user.id = value;
            state.step = "keyHs";
            await ctx.reply("Введите keyHs:");
            return;
        }

        if (state.step === "keyHs") {
            state.user.keyHs = value;
            state.step = "keyVl";
            await ctx.reply("Введите keyVl:");
            return;
        }

        if (state.step === "keyVl") {
            state.user.keyVl = value;
            state.step = "name";
            await ctx.reply("Введите name:");
            return;
        }

        if (state.step === "name") {
            state.user.name = value;
            state.step = "preview";

            await ctx.reply(
                "🧾 *Новый пользователь*\n\n" +
                `id: ${state.user.id}\n` +
                `name: ${state.user.name}\n\n` +
                `keyHs:\n\`${state.user.keyHs}\`\n\n` +
                `keyVl:\n\`${state.user.keyVl}\``,
                {
                    parse_mode: "Markdown",
                    reply_markup: createUserConfirmKeyboard(),
                }
            );
        }
    }
});




/* ================= CALLBACKS ================= */

bot.callbackQuery("GET_HYSTERIA", async (ctx) => {
    const { keyHs } = ctx.dbUser;

    if (!keyHs || keyHs.trim() === "") {
        await ctx.reply("⏳ Ключа пока нет");
    } else {
        await ctx.reply(keyHs);
    }

    await ctx.answerCallbackQuery();
});

bot.callbackQuery("GET_VLESS", async (ctx) => {
    const { keyVl } = ctx.dbUser;

    if (!keyVl || keyVl.trim() === "") {
        await ctx.reply("⏳ Ключа пока нет");
    } else {
        await ctx.reply(keyVl);
    }

    await ctx.answerCallbackQuery();
});

/* ================= BUY COFFEE ================= */

bot.callbackQuery("TBANK", async (ctx) => {
    await ctx.reply("💳 *T-Bank*\n\n`2200 7001 6398 3629`", {
        parse_mode: "Markdown",
    });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("YABANK", async (ctx) => {
    await ctx.reply("💳 *Yandex Bank*\n\n`2204 3110 2980 8046`", {
        parse_mode: "Markdown",
    });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("ALFA", async (ctx) => {
    await ctx.reply("💳 *Alfa-Bank*\n\n`2200 1545 0127 6777`", {
        parse_mode: "Markdown",
    });
    await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^EDIT_USER:/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCallbackQuery({ text: "⛔ Нет доступа", show_alert: true });
        return;
    }

    const userId = ctx.callbackQuery.data.split(":")[1];

    const keyboard = new InlineKeyboard()
        .text("Изменить id", `EDIT_FIELD:id:${userId}`)
        .row()
        .text("Изменить keyHs", `EDIT_FIELD:keyHs:${userId}`)
        .row()
        .text("Изменить keyVl", `EDIT_FIELD:keyVl:${userId}`)
        .row()
        .text("Изменить name", `EDIT_FIELD:name:${userId}`);

    await ctx.reply(
        `✏️ Что изменить у пользователя ${userId}?`,
        { reply_markup: keyboard }
    );

    await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^EDIT_FIELD:/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const [, field, userId] = ctx.callbackQuery.data.split(":");

    // сохраняем состояние
    adminEditState.set(ctx.from.id, { userId, field });

    await ctx.reply(
        `✏️ Введите новое значение для поля "${field}"\n\n` +
        `Пользователь: ${userId}`
    );

    await ctx.answerCallbackQuery();
});

bot.callbackQuery("CANCEL_EDIT", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    adminEditState.delete(ctx.from.id);

    await ctx.reply("❌ Изменение отменено");
    await ctx.answerCallbackQuery();
});


bot.callbackQuery("CONFIRM_EDIT", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const state = adminEditState.get(ctx.from.id);
    if (!state || !state.confirm) {
        await ctx.answerCallbackQuery();
        return;
    }

    const { userId, field, newValue } = state;

    const res = await fetch(
        "https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users.json"
    );
    const data = await res.json();

    const entry = Object.entries(data).find(
        ([, user]) => user.id === userId
    );

    if (!entry) {
        await ctx.reply("❌ Пользователь не найден");
        adminEditState.delete(ctx.from.id);
        await ctx.answerCallbackQuery();
        return;
    }

    const [dbKey] = entry;

    await fetch(
        `https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users/${dbKey}.json`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: newValue }),
        }
    );

    await ctx.reply("✅ Данные успешно обновлены");

    adminEditState.delete(ctx.from.id);
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("CONFIRM_CREATE", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const state = adminEditState.get(ctx.from.id);
    if (!state || state.mode !== "CREATE") {
        await ctx.answerCallbackQuery();
        return;
    }

    const res = await fetch(
        "https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users.json"
    );
    const data = await res.json();

    // находим максимальный числовой ключ
    const numericKeys = Object.keys(data)
        .map(Number)
        .filter((n) => !isNaN(n));

    const nextKey = Math.max(...numericKeys) + 1;

    await fetch(
        `https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users/${nextKey}.json`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state.user),
        }
    );

    await ctx.reply(`✅ Пользователь добавлен (key = ${nextKey})`);

    adminEditState.delete(ctx.from.id);
    await ctx.answerCallbackQuery();
});

bot.callbackQuery("RESTART_CREATE", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    adminEditState.set(ctx.from.id, {
        mode: "CREATE",
        step: "id",
        user: {},
    });

    await ctx.reply("🔄 Начнём заново\n\nВведите id:");
    await ctx.answerCallbackQuery();
});


/* ================= DAILY COFFEE REMINDER ================= */

async function sendDailyCoffeeReminder() {
    const users = await getAllUsersFromDB();

    for (const user of users) {
        try {
            await bot.api.sendMessage(
                user.id,
                "🛠 *Тех. работы на Hysteria2*\n\n" +
                "Vless доступен ☺️\n\n" +
                "# 🛠 Плановые техработы: Poland DC1 (стабилизация кластера)\n" +
                "\n" +
                "Когда: 07/01/26 08:00 (CET)\n" +
                "Причина: постоянная потеря пакетов в кластере Poland DC1.\n" +
                "\n" +
                "Что будет сделано:\n" +
                "- потребуется полностью отключить локацию Poland DC1\n" +
                "- произведём замену NIC (сетевых карт) на другие для стабилизации\n" +
                "\n" +
                "Влияние: все VPS в Poland DC1 будут недоступны на время работ (возможны перезагрузки).  \n" +
                "Компенсация: простой будет компенсирован (добавим дни работы сервера).\n" +
                { parse_mode: "Markdown" }
            );
        } catch (err) {
            console.error(`Ошибка отправки пользователю ${user.id}:`, err.message);
        }
    }
}

cron.schedule(
    "15 15 * * 2,3",
    () => {
        console.log("☕ Напоминание о кофе (ПН/СР/ПТ)");
        sendDailyCoffeeReminder();
    },
    {
        timezone: "Europe/Moscow",
    }
);

/* ================= BOT LAUNCH ================= */

bot.start();

