import { useState, useRef } from 'react';
import { Play, Pause, Volume2, Sparkles, HelpCircle, BookOpen } from 'lucide-react';

// Real-world Quranic verse audios (Alafasy reciter) containing the rule examples:
const RULE_AUDIO_MAP = {
  "مَنۡ ءَامَنَ": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/69.mp3", // البقرة 62 (إظهار)
  "مَن يَقُولُ": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/15.mp3", // البقرة 8 (إدغام بغنة)
  "مِن قَبۡلِ": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/11.mp3",  // البقرة 4 (إخفاء)
  "مِن بَعۡدِ": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/34.mp3",  // البقرة 27 (إقلاب)
};

// Help explanations for the Tajweed rules
const RULE_EXPLANATIONS = {
  "إظهار": "النطق بالنون الساكنة أو التنوين واضحة من مخرجها من غير غنة كاملة إذا جاء بعدها أحد حروف الحلق (أ، هـ، ع، ح، غ، خ).",
  "إدغام": "دمج النون الساكنة أو التنوين في الحرف الذي يليها بحيث يصيران حرفاً واحداً مشدداً، وحروفه (ي، ر، م، ل، و، ن).",
  "إخفاء": "النطق بالنون الساكنة أو التنوين بحالة متوسطة بين الإظهار والإدغام مع بقاء الغنة، وحروفه 15 حرفاً تجمعها أوائل كلمات بيت الشعر: صف ذا ثنا كم جاد شخص قد سما...",
  "إقلاب": "قلب النون الساكنة أو التنوين ميماً مخفاة مع الغنة إذا جاء بعدها حرف الباء (ب).",
};

export default function LessonContent({ content }) {
  const [playingAudio, setPlayingAudio] = useState(null); // String text of currently playing example
  const [hoveredRule, setHoveredRule] = useState(null); // Rule type for showing definition tooltip
  const audioRef = useRef(new Audio());

  const handlePlayAudio = (phrase) => {
    const audioUrl = RULE_AUDIO_MAP[phrase];
    if (!audioUrl) return;

    if (playingAudio === phrase) {
      audioRef.current.pause();
      setPlayingAudio(null);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setPlayingAudio(phrase);
      audioRef.current.onended = () => {
        setPlayingAudio(null);
      };
    }
  };

  // Helper to parse content into paragraphs and render rich formatting
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Split text into lines/paragraphs
    const paragraphs = text.split('\n');

    return paragraphs.map((p, idx) => {
      let trimmed = p.trim();
      if (!trimmed) return null;

      // Handle custom blockquotes or warnings
      if (trimmed.startsWith('>')) {
        return (
          <blockquote key={idx} className="my-4 p-4 rounded-xl text-sm" style={{ border: '1px solid #E8E2D4', background: '#FBF7EE', color: '#2A2438', lineHeight: 1.8 }}>
            {parseInlineStyles(trimmed.substring(1).trim())}
          </blockquote>
        );
      }

      // Handle headings
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={idx} className="text-base font-bold mt-5 mb-2" style={{ color: '#2A2438' }}>
            {parseInlineStyles(trimmed.substring(3).trim())}
          </h4>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h3 key={idx} className="text-lg font-extrabold mt-6 mb-3 pb-1" style={{ color: '#177B58', borderBottom: '1px solid #E8E2D4' }}>
            {parseInlineStyles(trimmed.substring(2).trim())}
          </h3>
        );
      }

      // Handle lists
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return (
          <ul key={idx} className="list-disc list-inside mr-4 my-2 text-sm space-y-1.5" style={{ color: '#2A2438', lineHeight: 1.8 }}>
            <li className="list-item">
              {parseInlineStyles(trimmed.substring(1).trim())}
            </li>
          </ul>
        );
      }

      // Normal paragraph
      return (
        <p key={idx} className="text-sm mb-4" style={{ color: '#756E85', lineHeight: 1.8 }}>
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Helper to parse custom tags: ﴿...﴾ for Quran, [rule|example] for Tajweed rules
  const parseInlineStyles = (line) => {
    let elements = [];
    let currentIdx = 0;
    
    // Regular expressions for Quranic verses ﴿...﴾ and Tajweed rules [rule|example]
    const combinedRegex = /(﴿[^﴾]+﴾)|(\[[^|\]]+\|[^\]]+\])/g;
    let match;

    while ((match = combinedRegex.exec(line)) !== null) {
      const matchStart = match.index;
      const matchText = match[0];

      // Add preceding plain text
      if (matchStart > currentIdx) {
        elements.push(line.substring(currentIdx, matchStart));
      }

      if (matchText.startsWith('﴿')) {
        // Quranic Verse rendering
        const verseText = matchText.slice(1, -1);
        elements.push(
          <span key={matchStart} className="inline-block px-1 mx-0.5 my-1">
            <span className="quran-text font-quran text-lg select-text font-semibold"
              style={{ background: '#E2EFE7', border: '1px solid #E8E2D4', color: '#2A2438', padding: '2px 8px', borderRadius: 8 }}>
              ﴿ {verseText} ﴾
            </span>
          </span>
        );
      } else {
        // Tajweed rule parsing: [ruleType|example]
        const innerText = matchText.slice(1, -1); // remove [ and ]
        const [ruleType, phrase] = innerText.split('|');

        const audioUrl = RULE_AUDIO_MAP[phrase];
        const isPlaying = playingAudio === phrase;

        elements.push(
          <span
            key={matchStart}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl mx-1 my-1 relative group"
            style={{ background: '#FFFFFF', border: '1px solid #E8E2D4' }}
          >
            {/* Rule badge */}
            <span
              className="font-bold px-2 py-0.5 rounded-full select-none flex items-center gap-0.5 cursor-help"
              style={{ fontSize: '0.8125rem', background: '#FBF7EE', color: '#2A2438', border: '1px solid #E8E2D4' }}
              onMouseEnter={() => setHoveredRule(ruleType)}
              onMouseLeave={() => setHoveredRule(null)}
            >
              {ruleType}
              <HelpCircle className="w-2.5 h-2.5" style={{ color: '#756E85' }} aria-hidden />
            </span>

            {/* Quranic Phrase */}
            <span className="font-quran text-base select-text" style={{ color: '#2A2438' }}>
              {phrase}
            </span>

            {/* Play/Pause example audio */}
            {audioUrl && (
              <button
                onClick={() => handlePlayAudio(phrase)}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                aria-label={isPlaying ? "إيقاف مثال العفاسي" : "استماع لمثال العفاسي"}
                style={{ background: isPlaying ? '#177B58' : '#E2EFE7', color: isPlaying ? '#fff' : '#177B58' }}
                title={isPlaying ? "إيقاف مؤقت" : "استمع للمثال بصوت العفاسي"}
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 mr-0.5" />}
              </button>
            )}

            {/* Rule description tooltip */}
            {hoveredRule === ruleType && RULE_EXPLANATIONS[ruleType] && (
              <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-48 p-2 rounded-lg z-50 text-right leading-relaxed pointer-events-none"
                style={{ fontSize: '0.8125rem', background: '#FFFFFF', color: '#2A2438', border: '1px solid #E8E2D4' }}>
                {RULE_EXPLANATIONS[ruleType]}
              </span>
            )}
          </span>
        );
      }

      currentIdx = combinedRegex.lastIndex;
    }

    // Add trailing text
    if (currentIdx < line.length) {
      elements.push(line.substring(currentIdx));
    }

    return elements;
  };

  return (
    <div className="p-6" style={{ background: '#FFFFFF', border: '1px solid #E8E2D4', borderRadius: 18 }}>
      <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid #FBF7EE' }}>
        <div className="flex items-center gap-2">
          <span aria-hidden style={{
            width: 36, height: 36, borderRadius: 12, background: '#E2EFE7', color: '#177B58',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
          }}>
            <BookOpen size={17} />
          </span>
          <h3 className="font-black text-base" style={{ color: '#2A2438', margin: 0 }}>الشرح النصي والأمثلة</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1"
          style={{ color: '#177B58', background: '#E2EFE7', borderRadius: 9999 }}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          <span>أمثلة تلاوة تفاعلية</span>
        </div>
      </div>

      <div className="space-y-1">
        {content ? renderFormattedText(content) : (
          <div className="text-center py-8 text-sm" style={{ color: '#756E85' }}>
            <Volume2 className="w-12 h-12 mx-auto mb-2" style={{ color: '#E8E2D4' }} aria-hidden />
            لا يوجد محتوى شرح نصي لهذا الدرس.
          </div>
        )}
      </div>
    </div>
  );
}
