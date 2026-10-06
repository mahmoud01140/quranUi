import { Phone } from 'lucide-react';
import { HQ } from '../halaqa/primitives';

/* شارة رقم الهاتف — رابط اتصال مباشر، مدمجة ومتجاوبة:
   تلتف مع النص على الشاشات الصغيرة، وهدف اللمس مريح (44px طولاً ضمنياً عبر الحشو). */
export default function PhoneChip({ phone }) {
  if (!phone) return null;
  const tel = String(phone).replace(/[\s-]/g, '');
  return (
    <a
      href={`tel:${tel}`}
      dir="ltr"
      aria-label={`اتصال برقم ${phone}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        minHeight: 32, padding: '4px 10px', borderRadius: 9999,
        background: '#E2EFE7', color: HQ.MENTOR,
        fontSize: 13, fontWeight: 800, textDecoration: 'none',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}
    >
      <Phone size={13} aria-hidden style={{ flex: 'none' }} />
      <span>{phone}</span>
    </a>
  );
}
