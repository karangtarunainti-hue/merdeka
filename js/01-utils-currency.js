/* ============================================================
   CURRENCY INPUT HELPER
   ============================================================ */
// Format angka dengan titik ribuan
function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(/,/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parse angka dari format titik ribuan
function parseCurrency(value) {
  if (typeof value === 'string') {
    // Hapus semua titik (ribuan) dan koma (desimal), lalu konversi ke float
    return parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
  }
  return value;
}

// Setup input dengan format ribuan
function setupCurrencyInput(inputEl) {
  if (!inputEl) return;
  
  // Pastikan input memiliki class currency-input
  inputEl.classList.add('currency-input');
  
  // Set initial value if present
  const rawValue = inputEl.value.trim();
  if (rawValue) {
    const parsed = parseCurrency(rawValue);
    if (!isNaN(parsed) && parsed > 0) {
      inputEl.value = formatCurrency(parsed);
    }
  }
  
  // Event listener untuk formatting saat mengetik
  inputEl.addEventListener('input', function(e) {
    // Simpan posisi kursor
    const cursorPos = this.selectionStart;
    const oldLength = this.value.length;
    
    // Hapus semua titik dari nilai saat ini
    let raw = this.value.replace(/\./g, '');
    // Hanya angka yang diperbolehkan
    raw = raw.replace(/[^0-9]/g, '');
    
    if (raw === '') {
      this.value = '';
      return;
    }
    
    // Format dengan titik
    const formatted = formatCurrency(parseInt(raw, 10));
    this.value = formatted;
    
    // Setel ulang posisi kursor
    const newLength = this.value.length;
    this.setSelectionRange(cursorPos + (newLength - oldLength), cursorPos + (newLength - oldLength));
  });
  
  // Saat blur, pastikan format benar
  inputEl.addEventListener('blur', function() {
    if (this.value === '') return;
    const raw = parseCurrency(this.value);
    if (!isNaN(raw) && raw > 0) {
      this.value = formatCurrency(raw);
    }
  });

  // Untuk nilai yang diset secara programatis
  const originalSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const setValue = function(value) {
    if (value !== undefined && value !== null && value !== '') {
      const num = typeof value === 'string' ? parseCurrency(value) : value;
      if (!isNaN(num) && num > 0) {
        originalSetValue.set.call(this, formatCurrency(num));
        return;
      }
    }
    originalSetValue.set.call(this, value);
  };
  // Override value setter
  Object.defineProperty(inputEl, 'value', {
    get: function() { return originalSetValue.get.call(this); },
    set: setValue,
    configurable: true
  });
}

// Setup semua input dengan class currency-input di modal
function setupAllCurrencyInputs() {
  document.querySelectorAll('#modal-body .currency-input').forEach(el => {
    setupCurrencyInput(el);
  });
  document.querySelectorAll('#modal-body input[data-currency="true"]').forEach(el => {
    setupCurrencyInput(el);
  });
  document.querySelectorAll('#content .currency-input').forEach(el => {
    setupCurrencyInput(el);
  });
}

// Helper untuk mendapatkan nilai numerik dari input format ribuan
function getCurrencyValue(inputEl) {
  if (!inputEl) return 0;
  const raw = inputEl.value.trim();
  if (!raw) return 0;
  const parsed = parseCurrency(raw);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper untuk mengisi nilai input dengan format ribuan
function setCurrencyValue(inputEl, value) {
  if (!inputEl) return;
  if (value === undefined || value === null) {
    inputEl.value = '';
    return;
  }
  const num = typeof value === 'string' ? parseCurrency(value) : value;
  if (isNaN(num) || num <= 0) {
    inputEl.value = '';
    return;
  }
  inputEl.value = formatCurrency(num);
}

