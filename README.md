# WhatsApp Personal Bridge

جسر شخصي لاستقبال أوامر الرسائل مع تفويض مسبق وإيقاف فوري.

## الحالة الحالية

هذه النسخة تنفّذ API آمنًا للطابور والتفويض، لكنها لا تتحكم تلقائيًا في جلسة WhatsApp Web داخل ChatGPT. Cloudflare Workers لا يستطيع الضغط على زر في متصفح خارجي. يلزم منفّذ دائم منفصل (متصفح Playwright على جهازك أو خادم) يقرأ `/queue` وينفّذ الإرسال، أو استخدام WhatsApp Cloud API الرسمي.

## التشغيل

```bash
npm test
npx wrangler secret put BRIDGE_TOKEN
npm run deploy
```

## API

- `POST /authorize` — تفعيل الإرسال التلقائي مسبقًا.
- `POST /stop` — إيقاف فوري ومسح الطابور.
- `GET /status` — حالة التفويض والمنفّذ والطابور.
- `POST /send` — يضيف رسالة للطابور بصيغة `{ "to": "+201023082293", "message": "ازيك" }`.
- `GET /queue` — قراءة الرسائل المعلّقة للمنفّذ.

كل الطلبات تحتاج `Authorization: Bearer <BRIDGE_TOKEN>`. لا تضع رمز واتساب أو بيانات الدخول في GitHub أو Cloudflare.
