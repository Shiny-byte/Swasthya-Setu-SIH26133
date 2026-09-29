import api from '../api';

export const OUTBOX_KEY = 'swasthya_outbox_queue';
export const PATIENT_STORAGE_KEY = 'swasthya_persistent_patients_v1';

// 1. Client-Side Image Compressor (5MB camera photo -> ~35-40KB for 2G/EDGE)
export function compressImageFor2G(file, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 2. Save record to local outbox & mirror directly into active clinical queue
export function saveToOutbox(triageData) {
  const existing = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  const localRecord = {
    ...triageData,
    local_id: `offline_${Date.now()}`,
    queued_at: new Date().toLocaleTimeString(),
    sync_status: 'QUEUED_OFFLINE'
  };

  const updatedOutbox = [...existing.filter(p => p.ticket_id !== localRecord.ticket_id), localRecord];
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(updatedOutbox));

  try {
    const unified = JSON.parse(localStorage.getItem(PATIENT_STORAGE_KEY) || '[]');
    const updatedUnified = [localRecord, ...unified.filter(p => p.ticket_id !== localRecord.ticket_id)];
    localStorage.setItem(PATIENT_STORAGE_KEY, JSON.stringify(updatedUnified));
    localStorage.setItem('swasthya_unified_patients', JSON.stringify(updatedUnified));
    localStorage.setItem('swasthya_queue', JSON.stringify(updatedUnified));
  } catch (err) {
    console.error('Error saving offline record to patient storage', err);
  }

  return localRecord;
}

// 3. Get count of pending offline records
export function getOutboxCount() {
  const existing = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  return existing.length;
}

// 4. Drain & sync pending records when cellular/Wi-Fi signal returns
export async function syncOutbox(onSuccessCallback) {
  if (!navigator.onLine) return;

  const existing = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
  if (existing.length === 0) return;

  const remaining = [];
  let syncedCount = 0;

  for (const item of existing) {
    try {
      // Corrected API endpoint mapping matching main.py backend route
      await api.post('/api/triage/submit', {
        patient_name: item.patient_name,
        age: item.age,
        gender: item.gender,
        phone: item.phone,
        village: item.village,
        abha_id: item.abha_id,
        systolic_bp: item.systolic_bp,
        diastolic_bp: item.diastolic_bp,
        pulse: item.pulse,
        spo2: item.spo2,
        blood_glucose: item.blood_glucose,
        symptoms: item.symptoms,
        photo_base64: item.photo_base64,
        audio_base64: item.audio_base64,
        sync_status: 'SYNCED_ONLINE'
      });

      syncedCount++;

      const unified = JSON.parse(localStorage.getItem(PATIENT_STORAGE_KEY) || '[]');
      const updatedUnified = unified.map(p => 
        (p.ticket_id === item.ticket_id || p.local_id === item.local_id) 
          ? { ...p, sync_status: 'SYNCED_ONLINE' } 
          : p
      );
      localStorage.setItem(PATIENT_STORAGE_KEY, JSON.stringify(updatedUnified));
      localStorage.setItem('swasthya_unified_patients', JSON.stringify(updatedUnified));
      localStorage.setItem('swasthya_queue', JSON.stringify(updatedUnified));

    } catch (err) {
      console.warn('Sync attempt failed, retaining item in outbox for retry:', err);
      remaining.push(item);
    }
  }

  localStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));

  if (onSuccessCallback && syncedCount > 0) {
    onSuccessCallback(syncedCount);
  }
}

// 5. Network quality monitor
export function getNetworkQuality() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'OFFLINE', label: '100% Offline (Store & Forward Active)', color: 'bg-amber-600 text-white' };
  }
  const conn = typeof navigator !== 'undefined' ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
  if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
    return { status: '2G_LOW', label: '2G Low Bandwidth (Audio / 40KB Mode)', color: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  return { status: 'ONLINE', label: 'Broadband / 4G Connected', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
}