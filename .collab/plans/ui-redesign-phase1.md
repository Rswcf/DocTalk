# UI Redesign Phase 1: Theme + Global Styles + Layout + i18n

## Task
Transform DocTalk from a generic blue-primary SaaS look into a premium monochrome (zinc-based) aesthetic. This phase covers theme setup, CSS variables, font, and i18n translation keys.

## Changes Required

### 1. `frontend/tailwind.config.ts`
Keep existing config, just extend the theme:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
```

### 2. `frontend/src/app/globals.css`
Update CSS variables to zinc-based palette. Keep ALL existing styles (prose, pdf-highlight, etc). Only update the :root and .dark CSS variable blocks:
```css
:root {
  --background: #ffffff;
  --foreground: #09090b;  /* zinc-950 */
  --border: #e4e4e7;      /* zinc-200 */
  /* Keep existing highlight vars */
  --highlight-base: rgba(56, 189, 248, 0.25);
  --highlight-strong: rgba(56, 189, 248, 0.5);
}

.dark {
  --background: #09090b;  /* zinc-950 */
  --foreground: #fafafa;  /* zinc-50 */
  --border: #3f3f46;      /* zinc-700 */
  --highlight-base: rgba(56, 189, 248, 0.20);
  --highlight-strong: rgba(56, 189, 248, 0.5);
}
```

### 3. `frontend/src/app/layout.tsx`
Add Inter font from `next/font/google`. Apply the font variable to <html> or <body>:
```tsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// In the return, add the variable class to <html>:
<html lang="en" suppressHydrationWarning className={inter.variable}>
  <body className="font-sans">
    ...
  </body>
</html>
```
Keep ALL existing providers, wrappers, metadata, etc. Only add the font import and className.

### 4. i18n — Add new landing page translation keys

Add the following keys to `frontend/src/i18n/locales/en.json` (merge with existing, don't replace):
```json
{
  "landing.badge": "PDF AI ASSISTANT",
  "landing.headline": "Chat with any PDF\nin seconds",
  "landing.subtitle": "Your AI-powered reading companion",
  "landing.description": "Upload any PDF and get instant, cited answers. Every response links back to the exact source — so you can verify in one click.",
  "landing.cta.demo": "Try free demo",
  "landing.cta.getStarted": "Get started",
  "landing.cta.howItWorks": "How it works",
  "landing.showcase.title": "See it in action",
  "landing.showcase.caption": "Upload a PDF, ask questions, get cited answers with page highlights",
  "landing.features.title": "Why DocTalk?",
  "landing.feature.answers.title": "Instant Answers",
  "landing.feature.answers.desc": "Ask any question and get precise answers from your document in seconds, powered by state-of-the-art AI.",
  "landing.feature.citations.title": "Source Citations",
  "landing.feature.citations.desc": "Every answer includes numbered references. Click any citation to jump to the exact page and see the source highlighted.",
  "landing.feature.privacy.title": "Privacy First",
  "landing.feature.privacy.desc": "Your documents are never used for AI training. Encrypted in transit and at rest, with full deletion control."
}
```

For the other 7 locale files, add the same keys translated appropriately:

**zh.json:**
```json
{
  "landing.badge": "PDF AI 助手",
  "landing.headline": "与任何 PDF\n即时对话",
  "landing.subtitle": "你的 AI 阅读伙伴",
  "landing.description": "上传任意 PDF，即刻获得带引用的精准回答。每个回答都链接到原文出处，一键验证。",
  "landing.cta.demo": "免费试用",
  "landing.cta.getStarted": "开始使用",
  "landing.cta.howItWorks": "了解详情",
  "landing.showcase.title": "实际效果展示",
  "landing.showcase.caption": "上传 PDF，提问，获取带页面高亮的引用回答",
  "landing.features.title": "为什么选择 DocTalk？",
  "landing.feature.answers.title": "即时回答",
  "landing.feature.answers.desc": "提出任何问题，几秒内从文档中获得精准答案，由最先进的 AI 驱动。",
  "landing.feature.citations.title": "来源引用",
  "landing.feature.citations.desc": "每个回答都包含编号引用。点击任意引用跳转到精确页面并查看高亮原文。",
  "landing.feature.privacy.title": "隐私优先",
  "landing.feature.privacy.desc": "您的文档绝不会用于 AI 训练。传输和存储均加密，完全控制删除权。"
}
```

**hi.json:**
```json
{
  "landing.badge": "PDF AI सहायक",
  "landing.headline": "किसी भी PDF से\nतुरंत बात करें",
  "landing.subtitle": "आपका AI पढ़ने का साथी",
  "landing.description": "कोई भी PDF अपलोड करें और तुरंत उद्धरण सहित सटीक उत्तर पाएं। हर उत्तर मूल स्रोत से जुड़ा होता है।",
  "landing.cta.demo": "मुफ्त डेमो",
  "landing.cta.getStarted": "शुरू करें",
  "landing.cta.howItWorks": "कैसे काम करता है",
  "landing.showcase.title": "इसे क्रिया में देखें",
  "landing.showcase.caption": "PDF अपलोड करें, सवाल पूछें, पेज हाइलाइट के साथ उद्धृत उत्तर पाएं",
  "landing.features.title": "DocTalk क्यों?",
  "landing.feature.answers.title": "तुरंत उत्तर",
  "landing.feature.answers.desc": "कोई भी सवाल पूछें और सेकंडों में अपने दस्तावेज़ से सटीक उत्तर पाएं।",
  "landing.feature.citations.title": "स्रोत उद्धरण",
  "landing.feature.citations.desc": "हर उत्तर में क्रमांकित संदर्भ शामिल हैं। किसी भी उद्धरण पर क्लिक करके सटीक पृष्ठ पर जाएं।",
  "landing.feature.privacy.title": "गोपनीयता पहले",
  "landing.feature.privacy.desc": "आपके दस्तावेज़ कभी AI प्रशिक्षण के लिए उपयोग नहीं किए जाते।"
}
```

**es.json:**
```json
{
  "landing.badge": "ASISTENTE PDF AI",
  "landing.headline": "Chatea con cualquier PDF\nen segundos",
  "landing.subtitle": "Tu compañero de lectura con IA",
  "landing.description": "Sube cualquier PDF y obtén respuestas instantáneas con citas. Cada respuesta enlaza directamente a la fuente exacta.",
  "landing.cta.demo": "Demo gratuita",
  "landing.cta.getStarted": "Empezar",
  "landing.cta.howItWorks": "Cómo funciona",
  "landing.showcase.title": "Véalo en acción",
  "landing.showcase.caption": "Sube un PDF, haz preguntas, obtén respuestas citadas con resaltado de páginas",
  "landing.features.title": "¿Por qué DocTalk?",
  "landing.feature.answers.title": "Respuestas instantáneas",
  "landing.feature.answers.desc": "Haz cualquier pregunta y obtén respuestas precisas de tu documento en segundos.",
  "landing.feature.citations.title": "Citas con fuente",
  "landing.feature.citations.desc": "Cada respuesta incluye referencias numeradas. Haz clic en cualquier cita para ir a la página exacta.",
  "landing.feature.privacy.title": "Privacidad primero",
  "landing.feature.privacy.desc": "Tus documentos nunca se usan para entrenar IA. Cifrados en tránsito y en reposo."
}
```

**ar.json:**
```json
{
  "landing.badge": "مساعد PDF بالذكاء الاصطناعي",
  "landing.headline": "تحدث مع أي PDF\nفي ثوانٍ",
  "landing.subtitle": "رفيقك في القراءة بالذكاء الاصطناعي",
  "landing.description": "ارفع أي PDF واحصل على إجابات فورية مع اقتباسات. كل إجابة مرتبطة بالمصدر الأصلي.",
  "landing.cta.demo": "تجربة مجانية",
  "landing.cta.getStarted": "ابدأ الآن",
  "landing.cta.howItWorks": "كيف يعمل",
  "landing.showcase.title": "شاهده أثناء العمل",
  "landing.showcase.caption": "ارفع PDF، اطرح أسئلة، احصل على إجابات مقتبسة مع تمييز الصفحات",
  "landing.features.title": "لماذا DocTalk؟",
  "landing.feature.answers.title": "إجابات فورية",
  "landing.feature.answers.desc": "اطرح أي سؤال واحصل على إجابات دقيقة من مستندك في ثوانٍ.",
  "landing.feature.citations.title": "اقتباسات المصدر",
  "landing.feature.citations.desc": "كل إجابة تتضمن مراجع مرقمة. انقر على أي اقتباس للانتقال إلى الصفحة المحددة.",
  "landing.feature.privacy.title": "الخصوصية أولاً",
  "landing.feature.privacy.desc": "لا تُستخدم مستنداتك أبداً لتدريب الذكاء الاصطناعي. مشفرة أثناء النقل والتخزين."
}
```

**fr.json:**
```json
{
  "landing.badge": "ASSISTANT PDF IA",
  "landing.headline": "Discutez avec n'importe quel PDF\nen quelques secondes",
  "landing.subtitle": "Votre compagnon de lecture IA",
  "landing.description": "Téléchargez n'importe quel PDF et obtenez des réponses instantanées avec citations. Chaque réponse renvoie à la source exacte.",
  "landing.cta.demo": "Démo gratuite",
  "landing.cta.getStarted": "Commencer",
  "landing.cta.howItWorks": "Comment ça marche",
  "landing.showcase.title": "Voyez-le en action",
  "landing.showcase.caption": "Téléchargez un PDF, posez des questions, obtenez des réponses citées avec surlignage",
  "landing.features.title": "Pourquoi DocTalk ?",
  "landing.feature.answers.title": "Réponses instantanées",
  "landing.feature.answers.desc": "Posez n'importe quelle question et obtenez des réponses précises de votre document en quelques secondes.",
  "landing.feature.citations.title": "Citations sourcées",
  "landing.feature.citations.desc": "Chaque réponse inclut des références numérotées. Cliquez sur une citation pour aller à la page exacte.",
  "landing.feature.privacy.title": "Confidentialité d'abord",
  "landing.feature.privacy.desc": "Vos documents ne sont jamais utilisés pour l'entraînement IA. Chiffrés en transit et au repos."
}
```

**bn.json:**
```json
{
  "landing.badge": "PDF AI সহকারী",
  "landing.headline": "যেকোনো PDF-এর সাথে\nতাৎক্ষণিক আলাপ",
  "landing.subtitle": "আপনার AI পড়ার সঙ্গী",
  "landing.description": "যেকোনো PDF আপলোড করুন এবং উদ্ধৃতিসহ তাৎক্ষণিক উত্তর পান। প্রতিটি উত্তর সঠিক উৎসের সাথে যুক্ত।",
  "landing.cta.demo": "বিনামূল্যে ডেমো",
  "landing.cta.getStarted": "শুরু করুন",
  "landing.cta.howItWorks": "কিভাবে কাজ করে",
  "landing.showcase.title": "কার্যক্রমে দেখুন",
  "landing.showcase.caption": "PDF আপলোড করুন, প্রশ্ন করুন, পৃষ্ঠা হাইলাইটসহ উদ্ধৃত উত্তর পান",
  "landing.features.title": "কেন DocTalk?",
  "landing.feature.answers.title": "তাৎক্ষণিক উত্তর",
  "landing.feature.answers.desc": "যেকোনো প্রশ্ন করুন এবং সেকেন্ডের মধ্যে আপনার নথি থেকে সঠিক উত্তর পান।",
  "landing.feature.citations.title": "উৎস উদ্ধৃতি",
  "landing.feature.citations.desc": "প্রতিটি উত্তরে সংখ্যাযুক্ত রেফারেন্স অন্তর্ভুক্ত। যেকোনো উদ্ধৃতিতে ক্লিক করে সঠিক পৃষ্ঠায় যান।",
  "landing.feature.privacy.title": "গোপনীয়তা প্রথমে",
  "landing.feature.privacy.desc": "আপনার নথি কখনোই AI প্রশিক্ষণের জন্য ব্যবহৃত হয় না।"
}
```

**pt.json:**
```json
{
  "landing.badge": "ASSISTENTE PDF IA",
  "landing.headline": "Converse com qualquer PDF\nem segundos",
  "landing.subtitle": "Seu companheiro de leitura com IA",
  "landing.description": "Faça upload de qualquer PDF e obtenha respostas instantâneas com citações. Cada resposta vincula diretamente à fonte exata.",
  "landing.cta.demo": "Demo gratuita",
  "landing.cta.getStarted": "Começar",
  "landing.cta.howItWorks": "Como funciona",
  "landing.showcase.title": "Veja em ação",
  "landing.showcase.caption": "Faça upload de um PDF, faça perguntas, obtenha respostas citadas com destaque de páginas",
  "landing.features.title": "Por que DocTalk?",
  "landing.feature.answers.title": "Respostas instantâneas",
  "landing.feature.answers.desc": "Faça qualquer pergunta e obtenha respostas precisas do seu documento em segundos.",
  "landing.feature.citations.title": "Citações com fonte",
  "landing.feature.citations.desc": "Cada resposta inclui referências numeradas. Clique em qualquer citação para ir à página exata.",
  "landing.feature.privacy.title": "Privacidade em primeiro",
  "landing.feature.privacy.desc": "Seus documentos nunca são usados para treinar IA. Criptografados em trânsito e em repouso."
}
```

## IMPORTANT NOTES
- When editing locale JSON files, MERGE the new keys into the existing file. Do NOT delete existing keys.
- For `globals.css`, keep ALL existing styles (prose, pdf-highlight, highlightPulse). Only update the CSS variable values in :root and .dark.
- For `layout.tsx`, keep ALL existing imports, providers, metadata. Only add the Inter font import and className.
- For `tailwind.config.ts`, keep existing content paths and plugins. Only add fontFamily extension.
