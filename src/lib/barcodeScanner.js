import { Capacitor } from '@capacitor/core';

function normalizeBarcode(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text.replace(/\s+/g, '');
}

function pickBarcodeValue(scanResult) {
  if (!scanResult) return '';
  const list = Array.isArray(scanResult.barcodes) ? scanResult.barcodes : [];
  const first = list[0] || null;
  const candidate = first?.rawValue || first?.displayValue || scanResult?.content || '';
  return normalizeBarcode(candidate);
}

export async function scanBarcodeValue() {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'native_only', cancelled: false, barcode: '' };
  }

  try {
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    const supported = await BarcodeScanner.isSupported();
    if (supported?.supported === false) {
      return { ok: false, reason: 'unsupported', cancelled: false, barcode: '' };
    }

    const permission = await BarcodeScanner.requestPermissions();
    if (permission?.camera && permission.camera !== 'granted') {
      return { ok: false, reason: 'permission_denied', cancelled: false, barcode: '' };
    }

    const result = await BarcodeScanner.scan();
    if (result?.barcodes?.length === 0 || result?.cancelled) {
      return { ok: false, reason: 'cancelled', cancelled: true, barcode: '' };
    }

    const barcode = pickBarcodeValue(result);
    if (!barcode) {
      return { ok: false, reason: 'empty_result', cancelled: false, barcode: '' };
    }
    return { ok: true, reason: null, cancelled: false, barcode };
  } catch {
    return { ok: false, reason: 'scan_error', cancelled: false, barcode: '' };
  }
}
