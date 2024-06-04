const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Создание и инициализация базы данных SQLite
const db = new sqlite3.Database('./user_data.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS user_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    orderNumber TEXT,
    photos TEXT,
    comments TEXT,
    timestamp TEXT
  )`);
});

// Хранение состояний пользователей
const userStates = {};

// Шаги
const steps = {
  ORDER_NUMBER: 'ORDER_NUMBER',
  ORDER_PHOTOS: 'ORDER_PHOTOS',
  COMMENTS: 'COMMENTS',
  WAITING_FOR_COMMENT: 'WAITING_FOR_COMMENT',
  WAITING_FOR_MORE_PHOTOS: 'WAITING_FOR_MORE_PHOTOS'
};

bot.start((ctx) => {
  ctx.reply('Отправьте, пожалуйста, номер заказа!');
  userStates[ctx.chat.id] = { step: steps.ORDER_NUMBER };
});

bot.help((ctx) => ctx.reply('Отправьте мне стикер'));

bot.on('sticker', (ctx) => ctx.reply('👍'));

bot.hears('привет', (ctx) => ctx.reply('Привет!'));

bot.command('restart', (ctx) => {
  ctx.reply('Процесс перезапущен. Отправьте, пожалуйста, номер заказа!');
  userStates[ctx.chat.id] = { step: steps.ORDER_NUMBER };
});

bot.on('text', (ctx) => {
  const userId = ctx.chat.id;
  const userState = userStates[userId];

  if (userState) {
    if (userState.step === steps.ORDER_NUMBER) {
      const orderNumber = ctx.message.text;
      userState.orderNumber = orderNumber;
      userState.step = steps.WAITING_FOR_MORE_PHOTOS;
      ctx.reply('Отправьте фотографии для контроля учета брака');
    } else if (userState.step === steps.WAITING_FOR_COMMENT) {
      userState.comments = ctx.message.text;
      ctx.reply('Ваш комментарий сохранен. Спасибо! Операция завершена.', Markup.inlineKeyboard([
        Markup.button.callback('Отправить другой заказ', 'NEW_ORDER'),
        Markup.button.callback('Завершить', 'FINISH_BOT')
      ]).resize());
      saveUserData(userId, userState);
      delete userStates[userId];
    }
  }
});

bot.on('photo', (ctx) => {
  const userId = ctx.chat.id;
  const userState = userStates[userId];

  if (userState && (userState.step === steps.WAITING_FOR_MORE_PHOTOS || userState.step === steps.ORDER_PHOTOS)) {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    if (!userState.photos) {
      userState.photos = [];
    }
    userState.photos.push(photoId);

    if (userState.step === steps.WAITING_FOR_MORE_PHOTOS) {
      ctx.reply('Фотографии получены. Можете отправить еще или завершить процесс.', Markup.inlineKeyboard([
        Markup.button.callback('Оставить комментарий', 'LEAVE_COMMENT'),
        Markup.button.callback('Завершить', 'FINISH')
      ]).resize());
      userState.step = steps.ORDER_PHOTOS;
    }
  } else {
    ctx.reply('Пожалуйста, сначала отправьте номер заказа.');
  }
});

bot.action('LEAVE_COMMENT', (ctx) => {
  const userId = ctx.chat.id;
  const userState = userStates[userId];

  if (userState && userState.step === steps.ORDER_PHOTOS) {
    ctx.reply('Пожалуйста, оставьте ваш комментарий:');
    userState.step = steps.WAITING_FOR_COMMENT;
  }
});

bot.action('FINISH', (ctx) => {
  const userId = ctx.chat.id;
  const userState = userStates[userId];

  if (userState && userState.step === steps.ORDER_PHOTOS) {
    ctx.reply('Спасибо! Процесс завершен.', Markup.inlineKeyboard([
      Markup.button.callback('Отправить другой заказ', 'NEW_ORDER'),
      Markup.button.callback('Завершить', 'FINISH_BOT')
    ]).resize());
    saveUserData(userId, userState);
    delete userStates[userId];
  }
});

bot.action('NEW_ORDER', (ctx) => {
  ctx.reply('Отправьте, пожалуйста, номер заказа!');
  userStates[ctx.chat.id] = { step: steps.ORDER_NUMBER };
});

bot.action('FINISH_BOT', (ctx) => {
  ctx.reply('Бот завершил свою работу. До свидания!');
  delete userStates[ctx.chat.id];
});

bot.launch().then(() => {
  console.log('Бот запущен успешно');
}).catch(err => {
  console.error('Не удалось запустить бота:', err);
});

// Остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Функция для сохранения данных пользователя
function saveUserData(userId, userState) {
  const photos = userState.photos ? userState.photos.join(',') : '';
  const timestamp = new Date().toISOString();

  db.run(`INSERT INTO user_data (userId, orderNumber, photos, comments, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [userId, userState.orderNumber, photos, userState.comments, timestamp], (err) => {
      if (err) {
        console.error('Ошибка при сохранении данных пользователя:', err);
      } else {
        console.log(`Данные пользователя ${userId} сохранены успешно.`);
      }
    });
}
