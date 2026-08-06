const TelegramBot = require('node-telegram-bot-api');

module.exports = async (req, res) => {
  const { TELEGRAM_BOT_TOKEN } = process.env;
  if (!TELEGRAM_BOT_TOKEN) {
    res.status(500).send('❌ TELEGRAM_BOT_TOKEN مش موجود في Environment Variables');
    return;
  }

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  const webhookUrl = `https://${req.headers.host}/api/webhook`;

  try {
    await bot.setWebHook(webhookUrl);
    res.status(200).send('✅ تم تفعيل البوت بنجاح! الرابط: ' + webhookUrl + '\nجرب تكلم البوت دلوقتي على تليجرام.');
  } catch (err) {
    res.status(500).send('❌ حصل خطأ: ' + err.message);
  }
};
