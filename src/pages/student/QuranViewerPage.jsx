import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen, ChevronLeft, ChevronRight, ChevronDown, Search, Check, Loader2,
  Eye, EyeOff, Sparkles, Repeat, X, BookMarked, Info
} from 'lucide-react';
import PageLayout from '../../components/shared/PageLayout';
import QuranAudioPlayer from '../../components/shared/QuranAudioPlayer';
import QURAN_SURAHS from '../../utils/quranData';
import { MUTASHABIHAT_ITEMS, getMutashabihForAyah } from '../../utils/mutashabihatData';
import useQuranAudio from '../../hooks/useQuranAudio';
import api from '../../services/api';
import toast from 'react-hot-toast';
import '../../components/halaqa/halaqa.css';
import { HQ } from '../../components/halaqa/primitives';

/* المصحف — the text leads, progress stays secondary.
   Same surah/audio/blur/mutashabihat logic; calmer shell.
   Verses remain Amiri; no JuzMap rebuild here. */

export default function QuranViewerPage() {
  const [selectedSurah, setSelectedSurah] = useState(1);
  const [verses, setVerses] = useState([]);
  const [memorizedVerses] = useState({});
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSurahList, setShowSurahList] = useState(true);

  // تظليل آيات الورد المطلوب (من لوحة الطالب أو زر الورد المطلوب)
  const [searchParams, setSearchParams] = useSearchParams();
  const [wirdRange, setWirdRange] = useState(null); // { surah, from, to }
  const [loadingWird, setLoadingWird] = useState(false);

  // ── Memorization & Blur Mode states (unchanged) ──
  const [isBlurMode, setIsBlurMode] = useState(false);
  const [revealedVerses, setRevealedVerses] = useState(new Set());

  // ── Mutashabihat states (unchanged) ──
  const [selectedMutashabih, setSelectedMutashabih] = useState(null);
  const [isMutashabihatModalOpen, setIsMutashabihatModalOpen] = useState(false);

  // ── Audio hook (unchanged) ──
  const audio = useQuranAudio();
  const {
    currentVerseIndex, isPlaying, reciter, loadSurahAudio, playVerse,
    repeatCount, changeRepeatCount, changePlayMode, playMode
  } = audio;

  const versesContainerRef = useRef(null);
  const surah = QURAN_SURAHS.find(s => s.number === selectedSurah);

  // ── Fetch surah text (unchanged) ──
  const fetchVerses = useCallback(async (surahNum) => {
    setLoadingVerses(true);
    try {
      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`);
      const data = await res.json();
      if (data.code === 200) {
        setVerses(data.data.ayahs || []);
        setRevealedVerses(new Set());
      }
    } catch {
      setVerses([]);
    }
    setLoadingVerses(false);
  }, []);

  useEffect(() => { fetchVerses(selectedSurah); }, [selectedSurah, fetchVerses]);

  // قراءة التوجيه من الرابط (?surah=&from=&to=) — من زر "افتح المصحف" في الورد
  useEffect(() => {
    const s = Number(searchParams.get('surah'));
    const f = Number(searchParams.get('from'));
    const t = Number(searchParams.get('to'));
    if (s >= 1 && s <= 114 && f >= 1 && t >= f) {
      setSelectedSurah(s);
      setWirdRange({ surah: s, from: f, to: t });
      setShowSurahList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // التمرير لموضع أول آية في الورد بعد تحميل السورة
  useEffect(() => {
    if (!wirdRange || wirdRange.surah !== selectedSurah || !verses.length) return;
    const idx = verses.findIndex(v => v.numberInSurah === wirdRange.from);
    if (idx >= 0) {
      const t = setTimeout(() => {
        const el = document.querySelector(`[data-verse-index="${idx}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
      return () => clearTimeout(t);
    }
  }, [verses, wirdRange, selectedSurah]);

  // زر "الورد المطلوب": يعرض آيات الحفظ الجديد فقط (وليس الماضي)
  const handleShowRequiredWird = async () => {
    setLoadingWird(true);
    try {
      const res = await api.get('/daily-tasks/today');
      const task = res.data?.task || res.data?.dailyTask || null;
      const hifz = task?.newHifz;
      if (hifz?.surahNumber && hifz?.fromVerse && hifz?.toVerse) {
        const s = Number(hifz.surahNumber);
        setSelectedSurah(s);
        setWirdRange({ surah: s, from: Number(hifz.fromVerse), to: Number(hifz.toVerse) });
        setShowSurahList(false);
        setSearchParams({ surah: String(s), from: String(hifz.fromVerse), to: String(hifz.toVerse) });
        toast.success(`وردك الجديد: سورة ${hifz.surahName || ''} من الآية ${hifz.fromVerse} إلى ${hifz.toVerse}`);
      } else {
        toast('لا يوجد ورد حفظ جديد محدد لك اليوم بعد');
      }
    } catch {
      toast.error('تعذر جلب الورد المطلوب');
    } finally {
      setLoadingWird(false);
    }
  };

  // ── Load audio when surah or reciter changes (unchanged) ──
  useEffect(() => {
    loadSurahAudio(selectedSurah, reciter);
  }, [selectedSurah, reciter, loadSurahAudio]);

  // ── Auto-scroll to playing verse (unchanged) ──
  useEffect(() => {
    if (currentVerseIndex >= 0) {
      const el = document.querySelector(`[data-verse-index="${currentVerseIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (isBlurMode) {
        setRevealedVerses(prev => new Set(prev).add(currentVerseIndex));
      }
    }
  }, [currentVerseIndex, isBlurMode]);

  // ── Stats (unchanged math) ──
  const memorizedSet = new Set(memorizedVerses[selectedSurah] || []);
  const totalVerses = surah?.verses || 0;
  const memorizedCount = memorizedSet.size;
  const progressPct = totalVerses > 0 ? Math.round((memorizedCount / totalVerses) * 100) : 0;

  const totalMemorizedVerses = Object.values(memorizedVerses).reduce((sum, arr) => sum + arr.length, 0);
  const totalQuranVerses = QURAN_SURAHS.reduce((sum, s) => sum + s.verses, 0);
  const overallPct = Math.round((totalMemorizedVerses / totalQuranVerses) * 100);
  const surahsComplete = QURAN_SURAHS.filter(s => {
    const mem = memorizedVerses[s.number];
    return mem && mem.length >= s.verses;
  }).length;

  const filteredSurahs = QURAN_SURAHS.filter(s =>
    !searchQuery || s.name.includes(searchQuery) || String(s.number).includes(searchQuery)
  );

  const goToSurah = (num) => {
    setSelectedSurah(num);
    setShowSurahList(false);
  };

  const handleVerseClick = (verseNum, index) => {
    if (isBlurMode && !revealedVerses.has(index)) {
      setRevealedVerses(prev => new Set(prev).add(index));
    }
    playVerse(verseNum);
  };

  const toggleVerseReveal = (index, e) => {
    e.stopPropagation();
    setRevealedVerses(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleRevealAll = () => {
    setRevealedVerses(new Set(verses.map((_, i) => i)));
    toast.success('تم إظهار جميع الآيات');
  };

  const handleHideAll = () => {
    setRevealedVerses(new Set());
    toast.success('تم إخفاء الآيات للاختبار');
  };

  const handleSetLoop = (count) => {
    changePlayMode('repeat');
    changeRepeatCount(count);
    toast.success(`تم تعيين التكرار: ${count === 999 ? 'لا نهائي' : `${count} مرات`}`);
  };

  return (
    <PageLayout>
      <div className="halaqa" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={24} color={HQ.MENTOR} /> المصحف
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: HQ.MUTED }}>
              {totalMemorizedVerses.toLocaleString()} آية محفوظة · {overallPct}% من المصحف · {surahsComplete} سورة مكتملة
            </p>
          </div>
          <button type="button" onClick={() => setIsMutashabihatModalOpen(true)} className="hq-action"
            style={{ background: HQ.SURFACE, border: `1.5px solid ${HQ.MENTOR}`, color: HQ.MENTOR, padding: '0 18px', fontSize: 14 }}>
            <BookMarked size={16} /> بنك المتشابهات ({MUTASHABIHAT_ITEMS.length})
          </button>
        </div>

        <div className="hq-quran-layout">
          {/* Surah list */}
          <div className={`hq-surah-panel ${showSurahList ? '' : 'hidden lg:block'}`}>
            <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, overflow: 'hidden', position: 'sticky', top: 80 }}>
              <div style={{ padding: 12, borderBottom: `1px solid ${HQ.LINE}` }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} color={HQ.MUTED} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" placeholder="ابحث عن سورة..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} aria-label="البحث عن سورة"
                    style={{ width: '100%', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, borderRadius: 12, padding: '10px 36px 10px 12px', fontSize: 16, color: HQ.INK, fontFamily: 'inherit', minHeight: 44 }} />
                </div>
              </div>
              <div style={{ maxHeight: '56vh', overflowY: 'auto' }}>
                {filteredSurahs.map(s => {
                  const mem = memorizedVerses[s.number] || [];
                  const pct = Math.round((mem.length / s.verses) * 100);
                  const isComplete = mem.length >= s.verses;
                  const isSelected = selectedSurah === s.number;
                  return (
                    <button key={s.number} type="button" onClick={() => goToSurah(s.number)}
                      aria-current={isSelected}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                        background: isSelected ? '#E2EFE7' : 'transparent', border: 'none', cursor: 'pointer',
                        textAlign: 'right', minHeight: 52,
                      }}>
                      <span aria-hidden style={{
                        width: 32, height: 32, borderRadius: 10, flex: 'none',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        background: isComplete ? HQ.MENTOR : isSelected ? HQ.MENTOR : HQ.PAPER,
                        color: isComplete || isSelected ? '#fff' : HQ.MUTED,
                        border: `1px solid ${isComplete || isSelected ? HQ.MENTOR : HQ.LINE}`,
                      }}>
                        {isComplete ? <Check size={15} strokeWidth={3} /> : s.number}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: isSelected ? HQ.MENTOR : HQ.INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ flex: 1, height: 4, borderRadius: 9999, background: HQ.LINE, overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: HQ.MENTOR }} />
                          </span>
                          <span style={{ fontSize: 11, color: HQ.MUTED, fontWeight: 700, flex: 'none' }}>{pct}%</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main reading area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Mobile surah picker (the list hides after picking) */}
            <button type="button" onClick={() => setShowSurahList(v => !v)} aria-expanded={showSurahList}
              className="hq-action hq-surah-toggle"
              style={{ width: '100%', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14, marginBottom: 12 }}>
              <BookOpen size={17} color={HQ.MENTOR} aria-hidden /> سورة {surah?.name}
              <ChevronDown size={16} color={HQ.MUTED} aria-hidden style={{ marginRight: 'auto', transform: showSurahList ? 'rotate(180deg)' : 'none' }} />
            </button>
            {/* Toolbar */}
            <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', paddingBottom: 12, borderBottom: `1px solid ${HQ.LINE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => selectedSurah > 1 && setSelectedSurah(selectedSurah - 1)}
                    disabled={selectedSurah <= 1} aria-label="السورة السابقة"
                    style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: selectedSurah <= 1 ? 0.35 : 1 }}>
                    <ChevronRight size={20} color={HQ.INK} />
                  </button>
                  <div style={{ textAlign: 'center', minWidth: 130 }}>
                    <h2 className="hq-quran" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: HQ.INK }}>
                      سورة {surah?.name}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED, fontWeight: 700 }}>{surah?.verses} آية</p>
                  </div>
                  <button type="button" onClick={() => selectedSurah < 114 && setSelectedSurah(selectedSurah + 1)}
                    disabled={selectedSurah >= 114} aria-label="السورة التالية"
                    style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: selectedSurah >= 114 ? 0.35 : 1 }}>
                    <ChevronLeft size={20} color={HQ.INK} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleShowRequiredWird} disabled={loadingWird}
                    className="hq-action"
                    style={{ background: '#F8EDD3', border: '1px solid #D9A441', color: '#7C5A12', padding: '0 16px', fontSize: 13, opacity: loadingWird ? 0.6 : 1 }}>
                    <BookOpen size={15} /> {loadingWird ? 'جارٍ الجلب...' : 'الورد المطلوب'}
                  </button>
                  <button type="button" aria-pressed={isBlurMode}
                    onClick={() => { const next = !isBlurMode; setIsBlurMode(next); if (next) handleHideAll(); }}
                    className="hq-action"
                    style={{ background: isBlurMode ? HQ.MENTOR : HQ.PAPER, color: isBlurMode ? '#fff' : HQ.INK, border: isBlurMode ? 'none' : `1px solid ${HQ.LINE}`, padding: '0 16px', fontSize: 13 }}>
                    {isBlurMode ? <EyeOff size={15} /> : <Eye size={15} />} الاختبار الغيبي
                  </button>
                  {isBlurMode && (
                    <>
                      <button type="button" onClick={handleRevealAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: HQ.MENTOR, minHeight: 44, padding: '0 8px' }}>
                        كشف الكل
                      </button>
                      <button type="button" onClick={handleHideAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: HQ.MUTED, minHeight: 44, padding: '0 8px' }}>
                        إخفاء الكل
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Repeat + legend */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Repeat size={15} color={HQ.MENTOR} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: HQ.INK }}>التكرار:</span>
                  {[1, 3, 5, 10, 999].map(cnt => (
                    <button key={cnt} type="button" onClick={() => handleSetLoop(cnt)}
                      aria-pressed={repeatCount === cnt && playMode === 'repeat'}
                      style={{
                        minWidth: 48, minHeight: 44, borderRadius: 10, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 800,
                        background: repeatCount === cnt && playMode === 'repeat' ? HQ.MENTOR : HQ.PAPER,
                        color: repeatCount === cnt && playMode === 'repeat' ? '#fff' : HQ.MUTED,
                      }}>
                      {cnt === 999 ? '∞' : `${cnt}x`}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: HQ.MUTED }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9999, background: HQ.MENTOR }} /> محفوظ
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9999, background: '#B45309' }} /> متشابهة
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 9999, background: '#D9A441' }} /> الورد المطلوب
                  </span>
                  <strong style={{ color: HQ.INK }}>{memorizedCount} / {totalVerses}</strong>
                </div>
              </div>
            </div>

            {/* Verses — Amiri leads */}
            {wirdRange && wirdRange.surah === selectedSurah && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', background: '#F8EDD3', border: '1px solid #D9A441', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#7C5A12' }}>
                  وردك المطلوب مظلل بالذهبي: الآيات {wirdRange.from} إلى {wirdRange.to}
                </span>
                <button type="button" onClick={() => { setWirdRange(null); setSearchParams({}); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: HQ.MUTED, minHeight: 44, padding: '0 8px' }}>
                  إخفاء التظليل
                </button>
              </div>
            )}
            {loadingVerses ? (
              <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 48, textAlign: 'center' }} aria-label="جارٍ تحميل الآيات">
                <Loader2 size={32} color={HQ.MENTOR} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: HQ.MUTED, margin: 0 }}>جارٍ تحميل آيات السورة...</p>
              </div>
            ) : (
              <div style={{ background: HQ.SURFACE, border: `1px solid ${HQ.LINE}`, borderRadius: 18, padding: 'clamp(16px, 4vw, 32px)' }} ref={versesContainerRef}>
                {selectedSurah !== 1 && selectedSurah !== 9 && (
                  <p className="hq-quran" style={{ textAlign: 'center', fontSize: 24, color: HQ.INK, margin: '0 0 20px', paddingBottom: 16, borderBottom: `1px solid ${HQ.LINE}` }}>
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                )}
                <div className="hq-quran hq-verses" dir="rtl">
                  {verses.map((verse, index) => {
                    const verseNum = verse.numberInSurah;
                    const isMemorized = memorizedSet.has(verseNum);
                    const isCurrentVerse = currentVerseIndex === index;
                    const isVersePlaying = isCurrentVerse && isPlaying;
                    const mutashabih = getMutashabihForAyah(selectedSurah, verseNum);
                    const isRevealed = !isBlurMode || revealedVerses.has(index);
                    const inWird = Boolean(wirdRange && wirdRange.surah === selectedSurah && verseNum >= wirdRange.from && verseNum <= wirdRange.to);

                    return (
                      <span key={verse.number} data-verse-index={index} style={{ display: 'inline-block', position: 'relative', margin: '0 4px' }}>
                        <span role="button" tabIndex={0}
                          onClick={() => handleVerseClick(verseNum, index)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerseClick(verseNum, index); } }}
                          title={!isRevealed ? 'انقر لكشف الآية واختبار حفظك' : `آية ${verseNum} — اضغط للاستماع`}
                          style={{
                            display: 'inline', padding: '2px 6px', borderRadius: 8, cursor: 'pointer',
                            filter: !isRevealed ? 'blur(7px)' : 'none',
                            background: !isRevealed ? HQ.PAPER : inWird ? '#FCEFC7' : isCurrentVerse ? '#E2EFE7' : isMemorized ? '#E2EFE7' : 'transparent',
                            color: !isRevealed ? HQ.MUTED : inWird ? '#7C5A12' : isCurrentVerse ? HQ.MENTOR : HQ.INK,
                            fontWeight: isCurrentVerse || inWird ? 700 : 400,
                            outline: isCurrentVerse ? `2px solid ${HQ.MENTOR}` : inWird ? '2px solid #D9A441' : 'none',
                          }}>
                          {verse.text}
                        </span>
                        <span role="button" tabIndex={0} aria-label={`استماع للآية ${verseNum}`}
                          onClick={() => handleVerseClick(verseNum, index)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerseClick(verseNum, index); } }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, margin: '0 4px', borderRadius: 9999,
                            fontSize: 12, fontWeight: 800, cursor: 'pointer', verticalAlign: 'middle',
                            fontFamily: 'Tajawal, sans-serif',
                            background: isVersePlaying || isCurrentVerse ? HQ.MENTOR : isMemorized ? '#E2EFE7' : HQ.PAPER,
                            color: isVersePlaying || isCurrentVerse ? '#fff' : isMemorized ? HQ.MENTOR : HQ.MUTED,
                            border: `1px solid ${isVersePlaying || isCurrentVerse || isMemorized ? HQ.MENTOR : HQ.LINE}`,
                          }}>
                          {verseNum}
                        </span>
                        {mutashabih && (
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedMutashabih(mutashabih); }}
                            title="آية مشابهة — اضغط لمعرفة الفارق"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                              background: HQ.SURFACE, color: '#B45309', border: '1px solid #B45309',
                              fontSize: '0.8125rem', fontWeight: 800, padding: '3px 10px', borderRadius: 9999,
                              verticalAlign: 'middle', margin: '0 4px', minHeight: 44,
                            }}>
                            <Sparkles size={12} /> متشابهة
                          </button>
                        )}
                        {isBlurMode && (
                          <button type="button" onClick={(e) => toggleVerseReveal(index, e)}
                            aria-label={isRevealed ? 'إخفاء الآية' : 'كشف الآية'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 44, height: 44, borderRadius: 9999, border: `1px solid ${HQ.LINE}`,
                              background: HQ.PAPER, color: HQ.MUTED, cursor: 'pointer',
                              verticalAlign: 'middle', margin: '0 2px',
                            }}>
                            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ height: 180 }} aria-hidden />
          </div>
        </div>

        <QuranAudioPlayer audio={audio} surahName={surah?.name} totalSurahVerses={totalVerses} />

        {/* Mutashabih detail modal */}
        {selectedMutashabih && (
          <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
            <div role="dialog" aria-modal="true" aria-label="ضابط المتشابهة"
              style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, maxWidth: 520, width: '100%', border: `1px solid ${HQ.LINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: `1px solid ${HQ.LINE}`, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: HQ.INK }}>ضابط المتشابهة</h3>
                  <p style={{ margin: 0, fontSize: 12, color: HQ.MUTED }}>{selectedMutashabih.category}</p>
                </div>
                <button type="button" onClick={() => setSelectedMutashabih(null)} aria-label="إغلاق"
                  style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={19} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div style={{ background: HQ.PAPER, padding: 14, borderRadius: 12, border: `1px solid ${HQ.LINE}`, fontSize: 13 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 800, color: HQ.MENTOR }}>سورة {surah?.name || ''} — آية {selectedMutashabih.verseNumber}</p>
                  <p className="hq-quran" style={{ margin: 0, fontSize: 18, color: HQ.INK }}>«{selectedMutashabih.verseText}»</p>
                </div>
                <div style={{ background: HQ.PAPER, padding: 14, borderRadius: 12, border: `1px solid ${HQ.LINE}`, fontSize: 13 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 800, color: HQ.INK }}>الموضع المشابه — سورة {selectedMutashabih.similarSurahName} — آية {selectedMutashabih.similarVerseNumber}</p>
                  <p className="hq-quran" style={{ margin: 0, fontSize: 18, color: HQ.INK }}>«{selectedMutashabih.similarVerseText}»</p>
                </div>
              </div>
              <div style={{ background: HQ.PAPER, padding: 14, borderRadius: 12, border: '1px solid #B45309', marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 900, color: HQ.INK, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={15} color="#B45309" /> الفارق والضابط
                </p>
                <p style={{ margin: 0, fontWeight: 700, color: HQ.INK, fontSize: 14 }}>{selectedMutashabih.rule}</p>
                {selectedMutashabih.difference && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: HQ.INK }}>{selectedMutashabih.difference}</p>
                )}
              </div>
              <button type="button" onClick={() => setSelectedMutashabih(null)} className="hq-action"
                style={{ width: '100%', background: HQ.PAPER, border: `1px solid ${HQ.LINE}`, color: HQ.INK, fontSize: 14 }}>
                فهمت الضابط
              </button>
            </div>
          </div>
        )}

        {/* Mutashabihat bank modal */}
        {isMutashabihatModalOpen && (
          <div dir="rtl" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(12,12,29,0.72)' }}>
            <div role="dialog" aria-modal="true" aria-label="بنك المتشابهات"
              style={{ background: HQ.SURFACE, borderRadius: 18, padding: 24, maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: `1px solid ${HQ.LINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: `1px solid ${HQ.LINE}`, flex: 'none' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: HQ.INK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookMarked size={19} color={HQ.MENTOR} /> بنك المتشابهات
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: HQ.MUTED }}>ضوابط تثبيت الآيات المتشابهة</p>
                </div>
                <button type="button" onClick={() => setIsMutashabihatModalOpen(false)} aria-label="إغلاق"
                  style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: HQ.PAPER, color: HQ.MUTED, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={19} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {MUTASHABIHAT_ITEMS.map((item, idx) => (
                  <div key={item.id} style={{ padding: 14, borderRadius: 14, border: `1px solid ${HQ.LINE}`, background: HQ.PAPER }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: HQ.MENTOR }}>{item.category} · ضابط {idx + 1}</p>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: HQ.INK }}><strong>الموضع 1:</strong> «{item.verseText}»</p>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: HQ.INK }}><strong>الموضع 2:</strong> «{item.similarVerseText}»</p>
                    <p style={{ margin: 0, background: '#F8EDD3', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: HQ.INK }}>{item.rule}</p>
                  </div>
                ))}
              </div>
              <div style={{ paddingTop: 12, borderTop: `1px solid ${HQ.LINE}`, display: 'flex', justifyContent: 'flex-end', flex: 'none' }}>
                <button type="button" onClick={() => setIsMutashabihatModalOpen(false)} className="hq-action"
                  style={{ background: HQ.MENTOR, color: '#fff', padding: '0 24px', fontSize: 14 }}>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
