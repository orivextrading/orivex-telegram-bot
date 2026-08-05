require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const { courses, faq, academyIntro } = require('./academyData');

const {
  TELEGRAM_BOT_TOKEN,
  ANTHROPIC_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  WEBSITE_URL,
  WHATSAPP_NUMBER
} = process.env;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ لازم تحط TELEGRAM_BOT_TOKEN في ملف .env الأول.');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// يتفعّل لما المستخدم يبعت رقم هاتفه بعد ما يدوس "حالة تسجيلي"
const awaitingPhone = new Set();

// ============================================================
// القائمة الرئيسية
// ============================================================
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

bot.onText(/\/start/, (msg) => {
  awaitingPhone.delete(msg.chat.id);
  bot.sendMessage(
    msg.chat.id,
    `أهلاً بيك في بوت Orivex 👋\n\n${academyIntro}\n\nاختار من تحت أو اسألني أي سؤال مباشرة.`,
    mainMenu()
  );
});

// ============================================================
// الأزرار
// ============================================================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  awaitingPhone.delete(chatId);

  if (query.data === 'courses') {
    const text = courses.map(c =>
      `📘 *${c.title}* (${c.level})\n` +
      `⏱ ${c.duration} · ${c.hours}\n` +
      `💰 ~${c.oldPrice}~ *${c.price} ج.م*\n` +
      `${c.desc}`
    ).join('\n\n');
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainMenu() });
  }

  if (query.data === 'faq') {
    const text = faq.map(f => `❓ *${f.q}*\n${f.a}`).join('\n\n');
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainMenu() });
  }

  if (query.data === 'status') {
    awaitingPhone.add(chatId);
    bot.sendMessage(chatId, 'ابعتلي رقم الهاتف اللي سجلت بيه (اللي كتبته في فورم التسجيل).');
  }

  bot.answerCallbackQuery(query.id);
});

// ============================================================
// الرسائل الحرة (رقم هاتف أو سؤال حر)
// ============================================================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;

  // لو المستخدم في وضع "بعت رقم هاتفه"
  if (awaitingPhone.has(chatId)) {
    awaitingPhone.delete(chatId);
    await handlePhoneStatusCheck(chatId, msg.text);
    return;
  }

  // غير كده: سؤال حر → رد ذكي بالـ AI
  await handleFreeQuestion(chatId, msg.text);
});

// ============================================================
// التحقق من حالة التسجيل (نفس فكرة الموقع، عبر جدول registrations)
// ============================================================
function normalizePhone(raw) {
  let v = (raw || '').toString().trim().replace(/[\s-]/g, '');
  if (v.startsWith('0')) v = '+20' + v.slice(1);
  else if (v.startsWith('20')) v = '+' + v;
  else if (v && !v.startsWith('+')) v = '+' + v;
  return v;
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
      bot.sendMessage(chatId, 'مفيش طلب تسجيل مسجل بالرقم ده. لو فيه غلطة في الرقم جرب تاني، أو سجل من الموقع.', mainMenu());
      return;
    }

    const list = data.map(r => `• ${r.course} — ${new Date(r.created_at).toLocaleDateString('ar-EG')}`).join('\n');
    bot.sendMessage(
      chatId,
      `لقيت طلبات التسجيل دي بالرقم ده:\n\n${list}\n\nالموافقة على الطلب بتتم يدويًا وبتوصلك رسالة تأكيد على واتساب أول ما تتم. لو عدّى يوم عمل ومفيش رد، تواصل معانا على واتساب.`,
      mainMenu()
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'حصل خطأ أثناء التحقق، حاول تاني أو تواصل معانا على واتساب.', mainMenu());
  }
}

// ============================================================
// الرد الذكي (AI) لأي سؤال مش موجود في الأزرار/الـ FAQ
// ============================================================
async function handleFreeQuestion(chatId, question) {
  if (!ANTHROPIC_API_KEY) {
    bot.sendMessage(chatId, 'مقدرش أجاوب على الأسئلة الحرة دلوقتي. اختار من الأزرار تحت أو تواصل على واتساب.', mainMenu());
    return;
  }

  bot.sendChatAction(chatId, 'typing');

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

    bot.sendMessage(chatId, reply || 'معرفتش أجاوب على السؤال ده، جرب تسأل بشكل تاني أو كلم محمد على واتساب.', mainMenu());
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, 'حصل خطأ في الرد، حاول تاني أو تواصل على واتساب.', mainMenu());
  }
}

console.log('✅ Orivex bot is running...');
