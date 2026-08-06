const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const { courses, faq, academyIntro } = require('../academyData');

const {
  TELEGRAM_BOT_TOKEN,
  ANTHROPIC_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  WEBSITE_URL,
  WHATSAPP_NUMBER
} = process.env;

// polling: false لأننا شغالين Webhook (Vercel بيشغّل الكود لحظة ما رسالة توصل بس)
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📚 الكورسات والأسعار', callback_data: 'courses' }],
        [{ text: '❓ أسئلة شائعة', callback_data: 'faq' }],
        [{ text: '📝 حالة تسجيلي', callback_data: 'status' }],
        [{ text: '💬 تواصل مع محمد على واتساب', url: `https://wa.me/${WHATSAPP_NUMBER}` }],
        [{ text: '🌐 زيارة الموقع', url: WEBSITE_URL }]
      ]
    }
  };
}

function normalizePhone(raw) {
  let v = (raw || '').toString().trim().replace(/[\s-]/g, '');
  if (v.startsWith('0')) v = '+20' + v.slice(1);
  else if (v.startsWith('20')) v = '+' + v;
  else if (v && !v.startsWith('+')) v = '+' + v;
  return v;
}

// حالة بسيطة في الذاكرة (تكفي لمدة الطلب الواحد) — يتفعّل بعد ما المستخدم يدوس "حالة تسجيلي"
const awaitingPhone = new Set();

async function handleStart(chatId) {
  awaitingPhone.delete(chatId);
  await bot.sendMessage(
    chatId,
    `أهلاً بيك في بوت Orivex 👋\n\n${academyIntro}\n\nاختار من تحت أو اسألني أي سؤال مباشرة.`,
    mainMenu()
  );
}

async function handleCallbackQuery(query) {
  const chatId = query.message.chat.id;
  awaitingPhone.delete(chatId);

  if (query.data === 'courses') {
    const text = courses.map(c =>
      `📘 *${c.title}* (${c.level})\n` +
      `⏱ ${c.duration} · ${c.hours}\n` +
      `💰 ~${c.oldPrice}~ *${c.price} ج.م*\n` +
      `${c.desc}`
    ).join('\n\n');
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainMenu() });
  }

  if (query.data === 'faq') {
    const text = faq.map(f => `❓ *${f.q}*\n${f.a}`).join('\n\n');
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainMenu() });
  }

  if (query.data === 'status') {
    awaitingPhone.add(chatId);
    await bot.sendMessage(chatId, 'ابعتلي رقم الهاتف اللي سجلت بيه (اللي كتبته في فورم التسجيل).');
  }

  await bot.answerCallbackQuery(query.id);
}

async function handlePhoneStatusCheck(chatId, rawPhone) {
  const phone = normalizePhone(rawPhone);
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('course, created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      await bot.sendMessage(chatId, 'مفيش طلب تسجيل مسجل بالرقم ده. لو فيه غلطة في الرقم جرب تاني، أو سجل من الموقع.', mainMenu());
      return;
    }

    const list = data.map(r => `• ${r.course} — ${new Date(r.created_at).toLocaleDateString('ar-EG')}`).join('\n');
    await bot.sendMessage(
      chatId,
      `لقيت طلبات التسجيل دي بالرقم ده:\n\n${list}\n\nالموافقة على الطلب بتتم يدويًا وبتوصلك رسالة تأكيد على واتساب أول ما تتم. لو عدّى يوم عمل ومفيش رد، تواصل معانا على واتساب.`,
      mainMenu()
    );
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, 'حصل خطأ أثناء التحقق، حاول تاني أو تواصل معانا على واتساب.', mainMenu());
  }
}

async function handleFreeQuestion(chatId, question) {
  if (!ANTHROPIC_API_KEY) {
    await bot.sendMessage(chatId, 'مقدرش أجاوب على الأسئلة الحرة دلوقتي. اختار من الأزرار تحت أو تواصل على واتساب.', mainMenu());
    return;
  }

  const systemPrompt =
    `إنت مساعد الرد الآلي لأكاديمية Orivex لتعليم التداول. ${academyIntro}\n\n` +
    `بيانات الكورسات:\n${courses.map(c => `- ${c.title}: ${c.price} ج.م (بدل ${c.oldPrice})، ${c.duration}، ${c.hours}`).join('\n')}\n\n` +
    `أسئلة شائعة معروفة:\n${faq.map(f => `- ${f.q}: ${f.a}`).join('\n')}\n\n` +
    `رد على سؤال المتدرب بالعربية العامية المصرية، بإيجاز (3-4 جمل بحد أقصى)، وبأسلوب ودود ومباشر. ` +
    `لو السؤال بعيد تمامًا عن التداول أو الأكاديمية، رد بلطف إنك متخصص في أسئلة Orivex بس ووجّهه للتواصل مع محمد غنام على واتساب لأي حاجة تانية. ` +
    `متختلقش أسعار أو تفاصيل مش موجودة فوق.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await response.json();
    const reply = (data.content || []).map(b => b.text || '').join('\n').trim();

    await bot.sendMessage(chatId, reply || 'معرفتش أجاوب على السؤال ده، جرب تسأل بشكل تاني أو كلم محمد على واتساب.', mainMenu());
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, 'حصل خطأ في الرد، حاول تاني أو تواصل على واتساب.', mainMenu());
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  if (!msg.text) return;

  if (msg.text.startsWith('/start')) {
    await handleStart(chatId);
    return;
  }
  if (msg.text.startsWith('/')) return;

  if (awaitingPhone.has(chatId)) {
    awaitingPhone.delete(chatId);
    await handlePhoneStatusCheck(chatId, msg.text);
    return;
  }

  await handleFreeQuestion(chatId, msg.text);
}

// ============================================================
// نقطة الدخول اللي تليجرام بيبعتلها كل رسالة (Webhook)
// ============================================================
module.exports = async (req, res) => {
  try {
    const update = req.body;
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallbackQuery(update.callback_query);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('OK'); // نرد 200 دايمًا عشان تليجرام ميعيدش المحاولة بلا نهاية
  }
};
