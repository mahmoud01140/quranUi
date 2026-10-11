import { Phone } from 'lucide-react';
import { HQ } from '../halaqa/primitives';

/* شارة رقم الهاتف — رابط اتصال مباشر، مدمجة ومتجاوبة:
   تلتف مع النص على الشاشات الصغيرة، وهدف اللمس 44px طولاً (معيار الوصول). */
export default function PhoneChip({ phone }) {
  if (!phone) return null;
  const tel = String(phone).replace(/[\s-]/g, '');
  return (
    <a
      href={`tel:${tel}`}
      dir="ltr"
      aria-label={`اتصال برقم ${phone}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        minHeight: 44, padding: '8px 14px', borderRadius: 9999,
        background: HQ.MENTOR_WASH, color: HQ.MENTOR,
        fontSize: 13, fontWeight: 800, textDecoration: 'none',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}
    >
      <Phone size={14} aria-hidden style={{ flex: 'none' }} />
      <span>{phone}</span>
    </a>
  );
}
