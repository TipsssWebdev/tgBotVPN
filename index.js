require("dotenv").config();
const { Bot, InlineKeyboard, Keyboard } = require("grammy");

const bot = new Bot(process.env.BOT_TOKEN);

/* ================= HELPERS ================= */

async function getUserFromDB(telegramId) {
    const res = await fetch(
        "https://proxy-settings-ab0da-default-rtdb.europe-west1.firebasedatabase.app/users.json"
    );

    const users = await res.json();
    if (!users) return null;

    return Object.values(users).find(
        (user) => user.id === String(telegramId)
    );
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
    .resized();

/* ================= COMMANDS MENU ================= */

bot.api.setMyCommands([
    { command: "start", description: "Запустить бота и открыть меню" },
    { command: "proxy", description: "Получить прокси / ключи" },
    { command: "coffee", description: "Поддержать проект ☕" },
]);

/* ================= /start ================= */

bot.command("start", async (ctx) => {
    await ctx.reply(
        "Привет! 👋\n\nВыберите действие:",
        { reply_markup: mainMenuKeyboard }
    );
});

/* ================= REPLY BUTTONS ================= */

bot.hears("🔐 Получить прокси", async (ctx) => {
    const keyboard = new InlineKeyboard()
        .text("🔑 Ключ Hysteria2", "GET_HYSTERIA")
        .row()
        .text("🔑 Ключ VLESS", "GET_VLESS");

    await ctx.reply(
        "⚠️ *Важная информация*\n\n" +
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

/* ================= BOT LAUNCH ================= */

bot.start();
