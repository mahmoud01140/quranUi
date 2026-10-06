// Form validators

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) ? null : 'البريد الإلكتروني غير صحيح';
};

export const validatePassword = (password) => {
  if (!password) return 'كلمة المرور مطلوبة';
  if (password.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  return null;
};

/**
 * توحيد الرقم المصري إلى 01xxxxxxxxx (مطابق لمنطق السيرفر).
 * يُرجع الرقم الموحد أو null.
 */
export const normalizePhoneEG = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
  return /^01[0125]\d{8}$/.test(digits) ? digits : null;
};

export const validatePhone = (phone, { required = false } = {}) => {
  if (!phone || !String(phone).trim()) {
    return required ? 'رقم الهاتف مطلوب — أدخل رقماً مصرياً (01xxxxxxxxx)' : null;
  }
  return normalizePhoneEG(phone)
    ? null
    : 'رقم الهاتف غير صحيح — أدخل رقماً مصرياً (01xxxxxxxxx)';
};

export const validateRequired = (value, fieldName = 'الحقل') => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} مطلوب`;
  }
  return null;
};

export const validateRegisterForm = (data) => {
  const errors = {};
  
  if (!data.firstName?.trim()) errors.firstName = 'الاسم الأول مطلوب';
  if (!data.lastName?.trim()) errors.lastName = 'اسم العائلة مطلوب';
  
  // البريد اختياري (للاستعادة) — يُتحقق منه فقط عند إدخاله
  if (data.email?.trim()) {
    const emailErr = validateEmail(data.email.trim());
    if (emailErr) errors.email = emailErr;
  }

  // الهاتف هو معرّف الدخول — مطلوب وفريد
  const phoneErr = validatePhone(data.phone, { required: true });
  if (phoneErr) errors.phone = phoneErr;

  const passErr = validatePassword(data.password);
  if (passErr) errors.password = passErr;

  if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
    errors.confirmPassword = 'كلمتا المرور غير متطابقتين';
  }

  return errors;
};

export const validateLoginForm = (data) => {
  const errors = {};
  const emailErr = validateEmail(data.email);
  if (emailErr) errors.email = emailErr;
  if (!data.password) errors.password = 'كلمة المرور مطلوبة';
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors).length > 0;
