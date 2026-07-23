/**
 * Cloudflare Image Proxy - Frontend JavaScript
 */

// DOM Elements
const imageUrlInput = document.getElementById('imageUrl');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const formatSelect = document.getElementById('format');
const fitSelect = document.getElementById('fit');
const gravitySelect = document.getElementById('gravity');
const advancedToggle = document.getElementById('advancedToggle');
const advancedOptions = document.getElementById('advancedOptions');
const blurSlider = document.getElementById('blur');
const blurValue = document.getElementById('blurValue');
const brightnessSlider = document.getElementById('brightness');
const brightnessValue = document.getElementById('brightnessValue');
const contrastSlider = document.getElementById('contrast');
const contrastValue = document.getElementById('contrastValue');
const sharpenSlider = document.getElementById('sharpen');
const sharpenValue = document.getElementById('sharpenValue');
const rotateSelect = document.getElementById('rotate');
const dprSelect = document.getElementById('dpr');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const resultSection = document.getElementById('resultSection');
const generatedUrl = document.getElementById('generatedUrl');
const previewImage = document.getElementById('previewImage');
const previewLoader = document.getElementById('previewLoader');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const downloadBtn = document.getElementById('downloadBtn');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const toast = document.getElementById('toast');

// State
let currentUrl = '';
let history = JSON.parse(localStorage.getItem('imageProxyHistory') || '[]');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  setupEventListeners();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Slider updates
  qualitySlider.addEventListener('input', (e) => {
    qualityValue.textContent = `${e.target.value}%`;
  });

  blurSlider.addEventListener('input', (e) => {
    blurValue.textContent = e.target.value;
  });

  brightnessSlider.addEventListener('input', (e) => {
    brightnessValue.textContent = e.target.value;
  });

  contrastSlider.addEventListener('input', (e) => {
    contrastValue.textContent = e.target.value;
  });

  sharpenSlider.addEventListener('input', (e) => {
    sharpenValue.textContent = e.target.value;
  });

  // Advanced toggle
  advancedToggle.addEventListener('click', () => {
    advancedToggle.classList.toggle('active');
    advancedOptions.style.display = 
      advancedOptions.style.display === 'none' ? 'block' : 'none';
  });

  // Generate button
  generateBtn.addEventListener('click', generateUrl);

  // Reset button
  resetBtn.addEventListener('click', resetForm);

  // Copy URL
  copyUrlBtn.addEventListener('click', copyToClipboard);

  // Download
  downloadBtn.addEventListener('click', downloadImage);

  // Clear history
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      generateUrl();
    }
  });

  // Auto-generate on URL change (debounced)
  let debounceTimer;
  imageUrlInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (imageUrlInput.value) {
        generateUrl();
      }
    }, 1000);
  });
}

/**
 * Generate transformed URL
 */
async function generateUrl() {
  const url = imageUrlInput.value.trim();
  
  if (!url) {
    showToast('Please enter an image URL', 'error');
    imageUrlInput.focus();
    return;
  }

  // Build query parameters
  const params = new URLSearchParams();
  params.set('url', url);

  if (widthInput.value) params.set('w', widthInput.value);
  if (heightInput.value) params.set('h', heightInput.value);
  if (qualitySlider.value !== '90') params.set('q', qualitySlider.value);
  if (formatSelect.value) params.set('format', formatSelect.value);
  if (fitSelect.value) params.set('fit', fitSelect.value);
  if (gravitySelect.value) params.set('gravity', gravitySelect.value);
  
  if (blurSlider.value !== '0') params.set('blur', blurSlider.value);
  if (brightnessSlider.value !== '0') params.set('brightness', brightnessSlider.value);
  if (contrastSlider.value !== '0') params.set('contrast', contrastSlider.value);
  if (sharpenSlider.value !== '0') params.set('sharpen', sharpenSlider.value);
  if (rotateSelect.value) params.set('rotate', rotateSelect.value);
  if (dprSelect.value) params.set('dpr', dprSelect.value);

  // Generate full URL
  const baseUrl = window.location.origin;
  currentUrl = `${baseUrl}/?${params.toString()}`;

  // Display URL
  generatedUrl.textContent = currentUrl;
  resultSection.style.display = 'block';

  // Load preview
  await loadPreview(currentUrl);

  // Add to history
  addToHistory(url, params);

  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  showToast('URL generated successfully', 'success');
}

/**
 * Load preview image
 */
async function loadPreview(url) {
  previewLoader.style.display = 'flex';
  previewImage.style.display = 'none';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load image');

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    previewImage.src = imageUrl;
    previewImage.onload = () => {
      previewLoader.style.display = 'none';
      previewImage.style.display = 'block';
      URL.revokeObjectURL(imageUrl);
    };
  } catch (error) {
    console.error('Preview error:', error);
    previewLoader.style.display = 'none';
    showToast('Failed to load preview', 'error');
  }
}

/**
 * Copy URL to clipboard
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(currentUrl);
    showToast('URL copied to clipboard', 'success');
  } catch (error) {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = currentUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('URL copied to clipboard', 'success');
  }
}

/**
 * Download image
 */
async function downloadImage() {
  if (!currentUrl) return;

  try {
    const response = await fetch(currentUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast('Image downloaded', 'success');
  } catch (error) {
    console.error('Download error:', error);
    showToast('Failed to download image', 'error');
  }
}

/**
 * Reset form
 */
function resetForm() {
  imageUrlInput.value = '';
  widthInput.value = '';
  heightInput.value = '';
  qualitySlider.value = '90';
  qualityValue.textContent = '90%';
  formatSelect.value = '';
  fitSelect.value = '';
  gravitySelect.value = '';
  blurSlider.value = '0';
  blurValue.textContent = '0';
  brightnessSlider.value = '0';
  brightnessValue.textContent = '0';
  contrastSlider.value = '0';
  contrastValue.textContent = '0';
  sharpenSlider.value = '0';
  sharpenValue.textContent = '0';
  rotateSelect.value = '';
  dprSelect.value = '';
  
  resultSection.style.display = 'none';
  currentUrl = '';
  
  showToast('Form reset', 'success');
}

/**
 * Add to history
 */
function addToHistory(url, params) {
  const entry = {
    url: url,
    params: Object.fromEntries(params),
    timestamp: Date.now(),
  };

  // Remove duplicate if exists
  history = history.filter(item => item.url !== url);
  
  // Add to beginning
  history.unshift(entry);
  
  // Keep only last 10
  history = history.slice(0, 10);
  
  // Save to localStorage
  localStorage.setItem('imageProxyHistory', JSON.stringify(history));
  
  renderHistory();
}

/**
 * Render history list
 */
function renderHistory() {
  if (history.length === 0) {
    historySection.style.display = 'none';
    return;
  }

  historySection.style.display = 'block';
  historyList.innerHTML = '';

  history.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <img class="history-thumbnail" src="" alt="Thumbnail" onerror="this.style.display='none'">
      <div class="history-info">
        <div class="history-url">${escapeHtml(item.url)}</div>
        <div class="history-params">${formatParams(item.params)}</div>
      </div>
    `;
    
    div.addEventListener('click', () => {
      loadFromHistory(item);
    });

    // Load thumbnail
    if (item.params.url) {
      const thumbUrl = buildThumbUrl(item.params);
      div.querySelector('.history-thumbnail').src = thumbUrl;
    }

    historyList.appendChild(div);
  });
}

/**
 * Build thumbnail URL
 */
function buildThumbUrl(params) {
  const thumbParams = new URLSearchParams();
  thumbParams.set('url', params.url);
  thumbParams.set('w', '100');
  thumbParams.set('h', '100');
  thumbParams.set('fit', 'cover');
  
  return `/?${thumbParams.toString()}`;
}

/**
 * Load from history
 */
function loadFromHistory(item) {
  imageUrlInput.value = item.url;
  
  if (item.params.w) widthInput.value = item.params.w;
  if (item.params.h) heightInput.value = item.params.h;
  if (item.params.q) {
    qualitySlider.value = item.params.q;
    qualityValue.textContent = `${item.params.q}%`;
  }
  if (item.params.format) formatSelect.value = item.params.format;
  if (item.params.fit) fitSelect.value = item.params.fit;
  if (item.params.gravity) gravitySelect.value = item.params.gravity;
  if (item.params.blur) {
    blurSlider.value = item.params.blur;
    blurValue.textContent = item.params.blur;
  }
  if (item.params.brightness) {
    brightnessSlider.value = item.params.brightness;
    brightnessValue.textContent = item.params.brightness;
  }
  if (item.params.contrast) {
    contrastSlider.value = item.params.contrast;
    contrastValue.textContent = item.params.contrast;
  }
  if (item.params.sharpen) {
    sharpenSlider.value = item.params.sharpen;
    sharpenValue.textContent = item.params.sharpen;
  }
  if (item.params.rotate) rotateSelect.value = item.params.rotate;
  if (item.params.dpr) dprSelect.value = item.params.dpr;

  generateUrl();
}

/**
 * Clear history
 */
function clearHistory() {
  history = [];
  localStorage.removeItem('imageProxyHistory');
  renderHistory();
  showToast('History cleared', 'success');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Format params for display
 */
function formatParams(params) {
  const parts = [];
  if (params.w) parts.push(`${params.w}px`);
  if (params.h) parts.push(`${params.h}px`);
  if (params.format) parts.push(params.format.toUpperCase());
  if (params.q) parts.push(`Q:${params.q}`);
  return parts.join(' • ');
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
