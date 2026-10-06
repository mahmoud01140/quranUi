import api from '../services/api';

/* الرفع المباشر من المتصفح إلى Cloudinary (unsigned preset) — يتجاوز حدود
   Vercel لحجم الطلب ومهلة الدوال، فالملف لا يمر بالسيرفر أبداً.
   السيرفر يستقبل الرابط + public_id فقط ويتحقق أن الرابط يخص سحابتنا. */

let cachedConfig = null;

const envFallback = (key) => {
  try {
    return import.meta.env?.[`VITE_${key}`] || null;
  } catch {
    return null;
  }
};

/** Upload settings (public by design — unsigned presets hold no secrets). */
export async function getDirectUploadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await api.get('/payments/public-config');
    const c = res.data?.cloudinary;
    if (c?.cloudName && (c.audioPreset || c.receiptPreset || c.resourcePreset)) {
      cachedConfig = {
        cloudName: c.cloudName,
        audioPreset: c.audioPreset || 'quran-audio',
        receiptPreset: c.receiptPreset || 'quran-receipts',
        resourcePreset: c.resourcePreset || 'quran-resources',
      };
      return cachedConfig;
    }
  } catch (_) {}
  // Local/dev fallback from .env
  const cloudName = envFallback('CLOUDINARY_CLOUD_NAME');
  if (!cloudName) return null;
  cachedConfig = {
    cloudName,
    audioPreset: envFallback('CLOUDINARY_AUDIO_PRESET') || 'quran-audio',
    receiptPreset: envFallback('CLOUDINARY_RECEIPT_PRESET') || 'quran-receipts',
    resourcePreset: envFallback('CLOUDINARY_RESOURCE_PRESET') || 'quran-resources',
  };
  return cachedConfig;
}

export function isDirectUploadAvailable(config) {
  return Boolean(config?.cloudName);
}

/**
 * Upload one File/Blob straight to Cloudinary (unsigned).
 * kind: 'audio' | 'receipt' | 'resource'
 * onProgress(0..1): optional progress callback (uses XHR for progress events).
 * Returns { url, publicId, resourceType } — resourceType needed later for delete.
 */
export function uploadDirectToCloudinary(file, { kind = 'audio', onProgress } = {}) {
  return getDirectUploadConfig().then((config) => {
    if (!isDirectUploadAvailable(config)) {
      throw new Error('الرفع المباشر غير مُعد — تواصل مع الإدارة');
    }
    const preset =
      kind === 'receipt'
        ? config.receiptPreset
        : kind === 'resource'
          ? config.resourcePreset
          : config.audioPreset;
    const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
            resolve({
              url: data.secure_url,
              publicId: data.public_id,
              resourceType: data.resource_type,
            });
          } else {
            reject(new Error(data?.error?.message || 'فشل الرفع إلى التخزين السحابي'));
          }
        } catch {
          reject(new Error('فشل الرفع إلى التخزين السحابي'));
        }
      };
      xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
      xhr.ontimeout = () => reject(new Error('انتهت مهلة الرفع — حاول مجدداً'));
      xhr.timeout = 10 * 60 * 1000; // direct uploads bypass serverless timeouts

      const form = new FormData();
      form.append('file', file, file.name || `upload-${Date.now()}`);
      form.append('upload_preset', preset);
      xhr.send(form);
    });
  });
}

export default uploadDirectToCloudinary;
