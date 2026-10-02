import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import {
  BookOpen, Users, Video, Mic, Hand, ClipboardList, BarChart3,
  Star, Flag, Award, BookmarkCheck, CalendarCheck,
  ChevronDown, ChevronLeft, LogIn, UserPlus, Route, ArrowLeft,
  LayoutDashboard,
} from 'lucide-react';
import Navbar from '../components/shared/Navbar';
import useAuthStore from '../store/authStore';
import '../components/halaqa/halaqa.css';
import { HqBadge } from '../components/halaqa/primitives';

/* ── Landing / Home — Al-Halaqa identity, marketing page only ────────────
   Paper canvas, ink text, mentor actions, violet for the teacher voice.
   No gradients, no glass, no dark panels, no emoji, Lucide only. */

const INK = '#2A2438';
const MUTED = '#756E85';
const LINE = '#E8E2D4';
const PAPER = '#FBF7EE';
const SURFACE = '#FFFFFF';
const MENTOR = '#177B58';
const MENTOR_DEEP = '#0F5940';
const MENTOR_WASH = '#E2EFE7';
const GUIDE = '#4A3F6B';
const GUIDE_WASH = '#ECE9F4';

const journeySteps = [
  { title: 'التسجيل', proof: 'أنشئ حسابك وفعّل بريدك الإلكتروني.' },
  { title: 'التقييم', proof: 'اختبار قصير لتحديد مستواك بدقة.' },
  { title: 'المستوى', proof: 'منهج مناسب لمستواك وهدفك.' },
  { title: 'الحلقة', proof: 'جلسة فردية مباشرة 1-1 مع معلّم يتابعك.' },
  { title: 'الدرس', proof: 'دروس متدرجة في الحفظ والتجويد.' },
  { title: 'المجلس الحي', proof: 'تسميع مباشر أمام المعلّم.' },
  { title: 'المتابعة', proof: 'اختبارات وتقدّم يومي.' },
  { title: 'الختمة', proof: 'إتمام الحفظ ومراجعة متقنة.' },
];

const benefits = [
  { icon: BookmarkCheck, title: 'متابعة الحفظ', desc: 'ورد يومي من الحفظ الجديد والمراجعة.' },
  { icon: BookOpen, title: 'الدروس', desc: 'منهج متدرج حسب مستواك.' },
  { icon: Video, title: 'المجلس الحي', desc: 'تسميع مباشر مع معلّمك الخاص.' },
  { icon: ClipboardList, title: 'الاختبارات', desc: 'تدريب مستمر وقياس لمستواك.' },
  { icon: BarChart3, title: 'متابعة التقدم', desc: 'تعرف أين وصلت وما خطوتك التالية.' },
  { icon: Star, title: 'تقييم المعلّم', desc: 'ملاحظات على تلاوتك وتجويدك.' },
  { icon: Flag, title: 'الختمة', desc: 'رحلة متدرجة حتى إتمام الحفظ.' },
  { icon: Award, title: 'الإجازة', desc: 'عند تحقق شروطها المعتمدة.' },
];

const liveRoles = [
  { icon: Users, tone: 'guide', title: 'المعلّم', desc: 'يدير المجلس، يستمع للتسميع ويقيّم.' },
  { icon: Mic, tone: 'mentor', title: 'الطالب الذي يقرأ', desc: 'يُسمّع ورده ويتلقى ملاحظات المعلّم.' },
  { icon: Hand, tone: 'mentor', title: 'دورك في الانتظار', desc: 'تعرف ترتيبك في الطابور وتستعد لدورك.' },
  { icon: CalendarCheck, tone: 'mentor', title: 'الحضور', desc: 'يُسجَّل حضورك في كل مجلس.' },
  { icon: BookOpen, tone: 'mentor', title: 'الورد', desc: 'حفظك ومراجعتك واضحة قبل المجلس.' },
  { icon: BarChart3, tone: 'mentor', title: 'المتابعة', desc: 'درجتك وملاحظات المعلّم بعد كل تسميع.' },
];

const pathPoints = [
  { icon: Route, title: 'مستواك', desc: 'يُحدَّد بعد التقييم، ويوجَّه منهجك على أساسه.' },
  { icon: BarChart3, title: 'تقدّمك', desc: 'يُقاس بالدروس والتسميع والاختبارات.' },
  { icon: Flag, title: 'ختمتك', desc: 'هدف واضح تعمل عليه جزءًا جزءًا.' },
  { icon: ArrowLeft, title: 'خطوتك التالية', desc: 'دائمًا معروفة — لا دروس متفرقة.' },
];

function FadeIn({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.25, delay }}
    >
      {children}
    </motion.div>
  );
}

function Chip({ icon: Icon, tone = 'mentor' }) {
  const tones = {
    mentor: { bg: MENTOR_WASH, fg: MENTOR },
    guide: { bg: GUIDE_WASH, fg: GUIDE },
  };
  const t = tones[tone] || tones.mentor;
  return (
    <span
      aria-hidden
      style={{
        flex: 'none', width: 44, height: 44, borderRadius: 12,
        background: t.bg, color: t.fg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon size={20} strokeWidth={2} />
    </span>
  );
}

function SectionHead({ badge, title, sub, id }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <HqBadge tone="mentor">{badge}</HqBadge>
      <h2 id={id} style={{ margin: '12px 0 0', fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.5 }}>
        {title}
      </h2>
      {sub && <p style={{ margin: '8px 0 0', fontSize: 16, color: MUTED, lineHeight: 1.8 }}>{sub}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuthStore();
  const isStudent = user?.role === 'student';

  return (
    <MotionConfig reducedMotion="user">
      <div className="halaqa min-h-screen" dir="rtl" style={{ background: PAPER, color: INK }}>
        <Navbar />

        {/* ─── 1. Hero ─────────────────────────────────────────── */}
        <section aria-labelledby="hero-title" style={{ paddingTop: 96, paddingBottom: 48 }}>
          <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
            <div
              style={{ display: 'grid', gap: 48, alignItems: 'center' }}
              className="grid-cols-1 lg:grid-cols-2"
            >
              <FadeIn>
                <div>
                  <HqBadge tone="mentor">حلقة قرآنية حيّة بمتابعة شخصية</HqBadge>
                  <h1 id="hero-title" style={{ margin: '16px 0 0', fontSize: 32, fontWeight: 800, color: INK, lineHeight: 1.4 }}>
                    احفظ القرآن الكريم
                    <br />
                    <span style={{ color: MENTOR }}>في حلقة حيّة تتابعك</span>
                  </h1>
                  <p style={{ margin: '16px 0 0', fontSize: 16, color: MUTED, lineHeight: 1.8, maxWidth: 520 }}>
                    منصة الحلقة تجمعك بمعلّمك الخاص: دروس منظّمة، ومجلس تسميع حيّ،
                    ومتابعة يومية لحفظك ومراجعتك حتى الختمة.
                  </p>
                  <div className="m-cta-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
                    {isStudent ? (
                      <Link
                        to="/student"
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-[#177B58] text-white font-bold hover:bg-[#0F5940] transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <LayoutDashboard size={19} aria-hidden />
                        لوحة التحكم
                      </Link>
                    ) : (
                      <Link
                        to="/register"
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-[#177B58] text-white font-bold hover:bg-[#0F5940] transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <UserPlus size={19} aria-hidden />
                        ابدأ التسجيل
                      </Link>
                    )}
                    {!isStudent && (
                      <Link
                        to="/login"
                        className="min-h-[48px] px-6 py-3 rounded-xl bg-white font-bold transition-colors inline-flex items-center justify-center gap-2"
                        style={{ color: MENTOR, border: `1.5px solid ${MENTOR}` }}
                      >
                        <LogIn size={19} aria-hidden />
                        تسجيل الدخول
                      </Link>
                    )}
                  </div>
                  <a
                    href="#journey"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      marginTop: 16, minHeight: 44, fontSize: 14, fontWeight: 700, color: MENTOR,
                    }}
                  >
                    شاهد كيف تسير الرحلة
                    <ChevronDown size={17} aria-hidden />
                  </a>
                </div>
              </FadeIn>

              {/* العنصر البصري الوحيد: لمحة عن مجلس الحلقة */}
              <FadeIn delay={0.1}>
                <div
                  role="img"
                  aria-label="لمحة توضيحية عن مجلس الحلقة: آية قرآنية، ثم المعلّم والقارئ والمنتظر"
                  style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 24 }}
                >
                  <p className="hq-quran" style={{ margin: 0, fontSize: 24, textAlign: 'center' }}>
                    ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
                  </p>
                  <div style={{ height: 1, background: LINE, margin: '16px 0' }} aria-hidden />
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                      <Chip icon={Users} tone="guide" />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>المعلّم</span>
                        <span style={{ display: 'block', fontSize: 13, color: MUTED }}>يدير المجلس ويقيّم التسميع</span>
                      </span>
                      <HqBadge tone="guide">المعلّم</HqBadge>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
                      <Chip icon={Mic} tone="mentor" />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>القارئ الآن</span>
                        <span style={{ display: 'block', fontSize: 13, color: MUTED }}>يُسمّع ورده أمام الحلقة</span>
                      </span>
                      <HqBadge tone="mentor">يُسمّع الآن</HqBadge>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${LINE}` }}>
                      <Chip icon={Hand} tone="mentor" />
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>بقية الطلاب</span>
                        <span style={{ display: 'block', fontSize: 13, color: MUTED }}>يستمعون ويستعدون لأدوارهم</span>
                      </span>
                    </li>
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ─── 2. كيف تسير الرحلة؟ ─────────────────────────────── */}
        <section aria-labelledby="journey-title" id="journey" style={{ padding: '48px 0', scrollMarginTop: 72 }}>
          <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px' }}>
            <FadeIn>
              <SectionHead
                badge="خطوة بخطوة"
                title="كيف تسير الرحلة؟"
                sub="من التسجيل حتى الختمة، كل مرحلة تمهّد لما بعدها."
                id="journey-title"
              />
            </FadeIn>
            <ol className="hq-thread" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {journeySteps.map((s, i) => (
                <li key={s.title} className="hq-node" style={{ display: 'flex', gap: 16, padding: '12px 0' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 28, height: 28, borderRadius: 9999, flex: 'none', zIndex: 1,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, background: SURFACE,
                      border: `2px solid ${LINE}`, color: INK,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK }}>
                      {s.title}
                      {i === 0 && (
                        <span style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                          <HqBadge tone="mentor">تبدأ من هنا</HqBadge>
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: MUTED }}>{s.proof}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── 3. ماذا يحصل عليه الطالب؟ ───────────────────────── */}
        <section aria-labelledby="benefits-title" id="benefits" style={{ padding: '48px 0', scrollMarginTop: 72 }}>
          <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
            <FadeIn>
              <SectionHead
                badge="داخل المنصة"
                title="ماذا يحصل عليه الطالب؟"
                sub="كل ما تحتاجه رحلة الحفظ في مكان واحد."
                id="benefits-title"
              />
            </FadeIn>
            <FadeIn>
              <ul
                style={{
                  listStyle: 'none', margin: 0, padding: 0,
                  background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18,
                }}
              >
                {benefits.map((b, i) => (
                  <li
                    key={b.title}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                      borderTop: i === 0 ? 'none' : `1px solid ${LINE}`,
                    }}
                  >
                    <Chip icon={b.icon} tone="mentor" />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 16, color: INK }}>{b.title}</span>
                      <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2 }}>{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </section>

        {/* ─── 4. الحلقة والمجلس الحي ──────────────────────────── */}
        <section aria-labelledby="live-title" id="live" style={{ padding: '48px 0', scrollMarginTop: 72 }}>
          <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px' }}>
            <FadeIn>
              <SectionHead
                badge="التجربة الحيّة"
                title="الحلقة والمجلس الحي"
                sub="معلّم حقيقي، وطابور تسميع واضح، ومتابعة لكل طالب."
                id="live-title"
              />
            </FadeIn>
            <div
              style={{ display: 'grid', gap: 24, alignItems: 'start' }}
              className="grid-cols-1 lg:grid-cols-2"
            >
              <FadeIn>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {liveRoles.map((r, i) => (
                    <li
                      key={r.title}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
                        borderTop: i === 0 ? 'none' : `1px solid ${LINE}`,
                      }}
                    >
                      <Chip icon={r.icon} tone={r.tone} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 16, color: INK }}>
                          {r.title}
                          {r.tone === 'guide' && (
                            <span style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                              <HqBadge tone="guide">المعلّم</HqBadge>
                            </span>
                          )}
                        </span>
                        <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2 }}>{r.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
              <FadeIn delay={0.1}>
                <div
                  role="img"
                  aria-label="مثال توضيحي لطابور التسميع: القارئ الآن، ثم التالي، ثم المعلّم، مع الحضور والورد"
                  style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18, padding: 16 }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: MUTED }}>مثال توضيحي لطابور التسميع</p>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 4px', borderBottom: `1px solid ${LINE}` }}>
                      <span aria-hidden style={{ flex: 'none', width: 32, height: 32, borderRadius: 9999, background: MENTOR, color: '#fff', border: `1px solid ${MENTOR}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>1</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>القارئ الآن</span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: MENTOR }}>يُسمّع الآن</span>
                      </span>
                      <Mic size={17} color={MENTOR} aria-hidden />
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 4px', borderBottom: `1px solid ${LINE}` }}>
                      <span aria-hidden style={{ flex: 'none', width: 32, height: 32, borderRadius: 9999, background: PAPER, color: MUTED, border: `1px solid ${LINE}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>2</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>التالي في الدور</span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: MUTED }}>يستعد للتسميع</span>
                      </span>
                      <Hand size={17} color={MUTED} aria-hidden />
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 4px' }}>
                      <span aria-hidden style={{ flex: 'none', width: 32, height: 32, borderRadius: 9999, background: GUIDE_WASH, color: GUIDE, border: `1px solid ${GUIDE_WASH}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                        <Users size={16} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, fontSize: 15, color: INK }}>المعلّم</span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: MUTED }}>يستمع ويقيّم</span>
                      </span>
                      <HqBadge tone="guide">المعلّم</HqBadge>
                    </li>
                  </ol>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 9999, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: INK }}>
                      <CalendarCheck size={15} color={MENTOR} aria-hidden />
                      الحضور يُسجَّل في كل مجلس
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 9999, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: INK }}>
                      <BookOpen size={15} color={MENTOR} aria-hidden />
                      الورد واضح قبل المجلس
                    </span>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ─── 5. رحلة الطالب ─────────────────────────────────── */}
        <section aria-labelledby="path-title" id="path" style={{ padding: '48px 0', scrollMarginTop: 72 }}>
          <div style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px' }}>
            <FadeIn>
              <SectionHead
                badge="رحلة متدرجة"
                title="رحلة الطالب"
                sub="لا دروس متفرقة، بل طريق واحد واضح من مستواك الحالي حتى الختمة."
                id="path-title"
              />
            </FadeIn>
            <FadeIn>
              <ul
                style={{
                  listStyle: 'none', margin: 0, padding: 0,
                  background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 18,
                }}
              >
                {pathPoints.map((p, i) => (
                  <li
                    key={p.title}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                      borderTop: i === 0 ? 'none' : `1px solid ${LINE}`,
                    }}
                  >
                    <Chip icon={p.icon} tone="mentor" />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: 16, color: INK }}>{p.title}</span>
                      <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2 }}>{p.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </section>

        {/* ─── 6. CTA نهائي ───────────────────────────────────── */}
        <section aria-labelledby="cta-title" style={{ padding: '48px 0 64px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
            <FadeIn>
              <h2 id="cta-title" style={{ margin: 0, fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.5 }}>
                ابدأ رحلتك مع القرآن اليوم
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: 16, color: MUTED, lineHeight: 1.8 }}>
                سجّل حسابك، واجتز التقييم، وانضم إلى حلقتك.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 24 }}>
                {isStudent ? (
                  <Link
                    to="/student"
                    className="min-h-[48px] px-10 py-3 rounded-xl bg-[#177B58] text-white font-bold hover:bg-[#0F5940] transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <LayoutDashboard size={19} aria-hidden />
                    الذهاب إلى لوحة التحكم
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="min-h-[48px] px-10 py-3 rounded-xl bg-[#177B58] text-white font-bold hover:bg-[#0F5940] transition-colors inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    ابدأ التسجيل
                    <ChevronLeft size={19} aria-hidden />
                  </Link>
                )}
                {!isStudent && (
                  <Link
                    to="/login"
                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 14, fontWeight: 700, color: MENTOR }}
                  >
                    لديك حساب بالفعل؟ سجّل الدخول
                  </Link>
                )}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ background: SURFACE, borderTop: `1px solid ${LINE}`, padding: '32px 0' }}>
          <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <span
                aria-hidden
                style={{
                  width: 36, height: 36, borderRadius: 12, background: MENTOR, color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <BookOpen size={19} />
              </span>
              <span style={{ color: INK, fontWeight: 800, fontSize: 17 }}>منصة الحلقة لتحفيظ القرآن الكريم</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>© {new Date().getFullYear()} جميع الحقوق محفوظة</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
