// ===== State =====
let apiKey = '';
const MAX_CHANNELS = 20;
let lastImportSourceName = '';

// ===== DOM Elements =====
const settingsBtn      = document.getElementById('settingsBtn');
const apiPanel         = document.getElementById('apiPanel');
const closePanelBtn    = document.getElementById('closePanelBtn');
const saveApiBtn       = document.getElementById('saveApiBtn');
const apiKeyInput      = document.getElementById('apiKeyInput');
const toggleApiKey     = document.getElementById('toggleApiKey');
const noApiBanner      = document.getElementById('noApiBanner');
const goToApiBtn       = document.getElementById('goToApiBtn');

const pinBtn           = document.getElementById('pinBtn');
const pinTooltip       = document.getElementById('pinTooltip');
const pinTooltipClose  = document.getElementById('pinTooltipClose');
const pinWrap          = document.getElementById('pinWrap');

const checkDateInput   = document.getElementById('checkDate');
const quickDateBtns    = document.querySelectorAll('.quick-date-btn');

const channelInputs    = document.getElementById('channelInputs');
const addChannelBtn    = document.getElementById('addChannelBtn');
const clearAllBtn      = document.getElementById('clearAllBtn');
const checkBtn         = document.getElementById('checkBtn');

const pasteToggleBtn   = document.getElementById('pasteToggleBtn');
const pasteArea        = document.getElementById('pasteArea');
const pasteCloseBtn    = document.getElementById('pasteCloseBtn');
const pasteClipBtn     = document.getElementById('pasteClipBtn');
const pasteTextarea    = document.getElementById('pasteTextarea');
const pasteHint        = document.getElementById('pasteHint');
const pasteImportBtn   = document.getElementById('pasteImportBtn');

const fileBadge        = document.getElementById('fileBadge');
const fileBadgeName    = document.getElementById('fileBadgeName');
const fileBadgeCount   = document.getElementById('fileBadgeCount');
const fileBadgeClear   = document.getElementById('fileBadgeClear');

const resultsWrapper   = document.getElementById('resultsWrapper');
const resultsTitle     = document.getElementById('resultsTitle');
const resultsDateBadge = document.getElementById('resultsDateBadge');
const resultsList      = document.getElementById('resultsList');

// ===== Init =====
async function init() {
  // Set date constraints (max: today, min: 7 days ago)
  const today = new Date();
  const minDate = new Date();
  minDate.setDate(today.getDate() - 7);
  if (checkDateInput) {
    checkDateInput.max = toDateString(today);
    checkDateInput.min = toDateString(minDate);
  }

  // Load storage
  const stored = await chrome.storage.local.get(['ytApiKey', 'savedChannels', 'importedFile']);

  if (stored.ytApiKey) {
    apiKey = stored.ytApiKey;
    if (apiKeyInput) apiKeyInput.value = apiKey;
    if (noApiBanner) noApiBanner.style.display = 'none';
  } else {
    if (noApiBanner) noApiBanner.style.display = 'flex';
  }

  // Load saved channels
  const saved = stored.savedChannels && stored.savedChannels.length > 0 ? stored.savedChannels : [''];
  saved.slice(0, MAX_CHANNELS).forEach(url => addChannelRow(url));

  // Load saved file badge
  if (stored.importedFile && stored.importedFile.count > 0) {
    showFileBadge(stored.importedFile.name, stored.importedFile.count);
  }

  setDateOffset(0);
}

// ===== Settings Panel =====
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (apiPanel) apiPanel.style.display = 'block';
  });
}

if (closePanelBtn) {
  closePanelBtn.addEventListener('click', () => {
    if (apiPanel) apiPanel.style.display = 'none';
  });
}

if (goToApiBtn) {
  goToApiBtn.addEventListener('click', () => {
    if (apiPanel) apiPanel.style.display = 'block';
  });
}

if (toggleApiKey) {
  toggleApiKey.addEventListener('click', () => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type = isPwd ? 'text' : 'password';
    toggleApiKey.style.color = isPwd ? 'var(--accent-red)' : 'var(--text-muted)';
  });
}

if (saveApiBtn) {
  saveApiBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showToast('Vui lòng nhập API Key!', 'error');
      return;
    }
    if (!key.startsWith('AIza')) {
      showToast('API Key không đúng định dạng (thường bắt đầu bằng AIza)!', 'error');
      return;
    }
    apiKey = key;
    await chrome.storage.local.set({ ytApiKey: key });
    if (noApiBanner) noApiBanner.style.display = 'none';
    if (apiPanel) apiPanel.style.display = 'none';
    showToast('✓ Đã lưu API Key thành công!');
  });
}

// ===== Pin Button & Tooltip =====
if (pinBtn && pinTooltip) {
  pinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = pinTooltip.style.display === 'none' || !pinTooltip.style.display;
    pinTooltip.style.display = isHidden ? 'block' : 'none';
  });
}

if (pinTooltipClose && pinTooltip) {
  pinTooltipClose.addEventListener('click', (e) => {
    e.stopPropagation();
    pinTooltip.style.display = 'none';
  });
}

document.addEventListener('click', (e) => {
  if (pinWrap && pinTooltip && !pinWrap.contains(e.target)) {
    pinTooltip.style.display = 'none';
  }
});

// ===== Date Picker =====
function setDateOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (checkDateInput) {
    checkDateInput.value = toDateString(d);
  }
  quickDateBtns.forEach(b => {
    b.classList.toggle('active', Number(b.dataset.offset) === offset);
  });
}

function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

quickDateBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setDateOffset(Number(btn.dataset.offset));
  });
});

if (checkDateInput) {
  checkDateInput.addEventListener('change', () => {
    quickDateBtns.forEach(b => b.classList.remove('active'));
  });
}

// ===== Channel Input Rows =====
function getRows() {
  return channelInputs ? [...channelInputs.querySelectorAll('.channel-input-row')] : [];
}

function addChannelRow(value = '') {
  if (!channelInputs) return;
  const rows = getRows();
  if (rows.length >= MAX_CHANNELS) {
    showToast(`Tối đa ${MAX_CHANNELS} kênh!`, 'error');
    return;
  }

  const idx = rows.length + 1;
  const row = document.createElement('div');
  row.className = 'channel-input-row';
  row.innerHTML = `
    <span class="channel-num">${idx}</span>
    <input
      type="text"
      class="channel-url-input"
      placeholder="https://www.youtube.com/@kenhcuaban hoặc /channel/UC..."
      value="${escapeAttr(value)}"
      id="channel-input-${idx}"
    >
    <button class="remove-channel-btn" title="Xoá kênh này" ${rows.length === 0 ? 'disabled' : ''}>✕</button>
  `;

  row.querySelector('.remove-channel-btn').addEventListener('click', () => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(10px)';
    row.style.transition = 'all 0.15s ease';
    setTimeout(() => {
      row.remove();
      refreshRowNumbers();
      saveChannels();
    }, 150);
  });

  row.querySelector('.channel-url-input').addEventListener('input', () => {
    saveChannels();
    updateRowControls();
  });

  channelInputs.appendChild(row);
  updateRowControls();
}

function refreshRowNumbers() {
  const rows = getRows();
  rows.forEach((row, i) => {
    const numEl = row.querySelector('.channel-num');
    if (numEl) numEl.textContent = i + 1;
    const removeBtn = row.querySelector('.remove-channel-btn');
    if (removeBtn) removeBtn.disabled = rows.length <= 1;
  });
  updateRowControls();
}

function updateRowControls() {
  const rows = getRows();
  const count = rows.length;

  if (addChannelBtn) {
    addChannelBtn.disabled = count >= MAX_CHANNELS;
    addChannelBtn.title = count >= MAX_CHANNELS ? `Tối đa ${MAX_CHANNELS} kênh` : 'Thêm kênh mới';
  }

  if (clearAllBtn) {
    const hasAnyValue = rows.some(r => r.querySelector('.channel-url-input').value.trim().length > 0);
    clearAllBtn.disabled = count <= 1 && !hasAnyValue;
  }
}

async function saveChannels() {
  const urls = getRows().map(r => r.querySelector('.channel-url-input').value.trim());
  await chrome.storage.local.set({ savedChannels: urls });
}

if (addChannelBtn) {
  addChannelBtn.addEventListener('click', () => {
    addChannelRow('');
    const inputs = channelInputs.querySelectorAll('.channel-url-input');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
    }
  });
}

if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    const rows = getRows();
    const hasAnyValue = rows.some(r => r.querySelector('.channel-url-input').value.trim().length > 0);
    if (rows.length <= 1 && !hasAnyValue) {
      showToast('Danh sách kênh đã trống!', 'error');
      return;
    }

    if (channelInputs) {
      channelInputs.innerHTML = '';
      addChannelRow('');
    }
    await chrome.storage.local.set({ savedChannels: [] });
    await chrome.storage.local.remove('importedFile');

    if (fileBadge) fileBadge.style.display = 'none';
    if (fileBadgeName) fileBadgeName.textContent = '';
    if (fileBadgeCount) fileBadgeCount.textContent = '';

    if (resultsWrapper) resultsWrapper.style.display = 'none';

    if (pasteTextarea) {
      pasteTextarea.value = '';
      updatePastePreview();
    }

    updateRowControls();
    showToast('✓ Đã xóa tất cả các link kênh!');
  });
}

// ===== Paste / Batch Import =====
function extractUrls(text) {
  if (!text) return [];
  const rawLines = text.split(/[\r\n,;]+/);
  const found = [];

  for (let line of rawLines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    
    // Normalize prefix
    if (!line.startsWith('http://') && !line.startsWith('https://')) {
      line = 'https://' + line;
    }

    if (line.includes('youtube.com') || line.includes('youtu.be')) {
      if (!found.includes(line)) {
        found.push(line);
      }
    }
  }
  return found;
}

function updatePastePreview() {
  if (!pasteTextarea || !pasteHint || !pasteImportBtn) return;
  const urls = extractUrls(pasteTextarea.value);
  const count = urls.length;

  if (count === 0) {
    pasteHint.textContent = '0 link phát hiện';
    pasteHint.classList.remove('has-links');
    pasteImportBtn.disabled = true;
  } else {
    const displayCount = count > MAX_CHANNELS ? `${MAX_CHANNELS} / ${count}` : count;
    pasteHint.textContent = `${displayCount} link hợp lệ`;
    pasteHint.classList.add('has-links');
    pasteImportBtn.disabled = false;
  }
}

if (pasteToggleBtn && pasteArea) {
  pasteToggleBtn.addEventListener('click', () => {
    const isHidden = pasteArea.style.display === 'none' || !pasteArea.style.display;
    pasteArea.style.display = isHidden ? 'flex' : 'none';
    if (isHidden && pasteTextarea) {
      pasteTextarea.focus();
      updatePastePreview();
    }
  });
}

if (pasteCloseBtn && pasteArea) {
  pasteCloseBtn.addEventListener('click', () => {
    pasteArea.style.display = 'none';
  });
}

if (pasteClipBtn && pasteTextarea) {
  pasteClipBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        pasteTextarea.value = text;
        lastImportSourceName = 'Clipboard';
        updatePastePreview();
        showToast('✓ Đã dán nội dung từ clipboard!');
      } else {
        showToast('Clipboard đang trống!', 'error');
      }
    } catch (e) {
      showToast('Hãy dùng phím Ctrl+V để dán trực tiếp', 'error');
    }
  });
}

if (pasteTextarea) {
  pasteTextarea.addEventListener('input', () => {
    lastImportSourceName = '';
    updatePastePreview();
  });

  // Drag & drop support for .txt / .md files onto textarea
  pasteTextarea.addEventListener('dragover', (e) => {
    e.preventDefault();
    pasteTextarea.classList.add('dragover');
  });

  pasteTextarea.addEventListener('dragleave', () => {
    pasteTextarea.classList.remove('dragover');
  });

  pasteTextarea.addEventListener('drop', (e) => {
    e.preventDefault();
    pasteTextarea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file) {
      lastImportSourceName = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        pasteTextarea.value = event.target.result;
        updatePastePreview();
        showToast(`✓ Đã đọc file: ${file.name}`);
      };
      reader.onerror = () => showToast('Lỗi đọc file!', 'error');
      reader.readAsText(file, 'utf-8');
    }
  });
}

if (pasteImportBtn && pasteTextarea) {
  pasteImportBtn.addEventListener('click', () => {
    const urls = extractUrls(pasteTextarea.value);
    if (urls.length === 0) {
      showToast('Không có link YouTube hợp lệ!', 'error');
      return;
    }

    if (urls.length > MAX_CHANNELS) {
      showToast(`Có ${urls.length} link, chỉ lấy ${MAX_CHANNELS} link đầu tiên.`, 'error');
    }

    const toImport = urls.slice(0, MAX_CHANNELS);
    if (channelInputs) {
      channelInputs.innerHTML = '';
      toImport.forEach(url => addChannelRow(url));
    }
    saveChannels();

    const badgeName = lastImportSourceName || 'Danh sách dán';
    setFileBadge(badgeName, toImport.length);

    if (pasteArea) pasteArea.style.display = 'none';
    pasteTextarea.value = '';
    lastImportSourceName = '';
    updatePastePreview();
    showToast(`✓ Đã nạp ${toImport.length} kênh thành công!`);
  });
}

// ===== File Badge =====
function setFileBadge(name, count) {
  chrome.storage.local.set({ importedFile: { name, count } });
  showFileBadge(name, count);
}

function showFileBadge(name, count) {
  if (!fileBadge || !fileBadgeName || !fileBadgeCount) return;
  fileBadgeName.textContent = name;
  fileBadgeCount.textContent = `${count} kênh được nạp`;
  fileBadge.style.display = 'flex';
}

if (fileBadgeClear) {
  fileBadgeClear.addEventListener('click', async () => {
    await chrome.storage.local.remove('importedFile');
    if (fileBadge) fileBadge.style.display = 'none';
    if (fileBadgeName) fileBadgeName.textContent = '';
    if (fileBadgeCount) fileBadgeCount.textContent = '';
    showToast('Đã xóa thông tin nguồn nạp.');
  });
}

// ===== Main Check =====
if (checkBtn) {
  checkBtn.addEventListener('click', runCheck);
}

async function runCheck() {
  const date = checkDateInput ? checkDateInput.value : '';
  if (!date) {
    showToast('Vui lòng chọn ngày!', 'error');
    return;
  }
  if (!apiKey) {
    if (apiPanel) apiPanel.style.display = 'block';
    showToast('Vui lòng nhập YouTube API Key!', 'error');
    return;
  }

  const selectedDate = new Date(date + 'T00:00:00');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  if (selectedDate < sevenDaysAgo) {
    showToast('Chỉ kiểm tra được trong vòng 7 ngày qua!', 'error');
    return;
  }

  const urls = getRows()
    .map(r => r.querySelector('.channel-url-input').value.trim())
    .filter(u => u.length > 0);

  if (urls.length === 0) {
    showToast('Vui lòng nhập ít nhất 1 link kênh!', 'error');
    return;
  }

  checkBtn.disabled = true;
  checkBtn.innerHTML = `
    <div class="spinner-inline" style="border-top-color:#fff;width:15px;height:15px;margin-right:6px"></div>
    Đang kiểm tra (${urls.length} kênh)...
  `;

  if (resultsWrapper) resultsWrapper.style.display = 'block';
  const dateObj = new Date(date + 'T00:00:00');
  if (resultsDateBadge) resultsDateBadge.textContent = formatDate(dateObj);
  if (resultsTitle) resultsTitle.textContent = `Kết quả (${urls.length} kênh)`;
  if (resultsList) resultsList.innerHTML = '';

  const oldSummary = resultsWrapper ? resultsWrapper.querySelector('.results-summary') : null;
  if (oldSummary) oldSummary.remove();

  // Create loading cards
  const cardMap = {};
  urls.forEach((url, i) => {
    const card = createLoadingCard(url, i + 1);
    if (resultsList) resultsList.appendChild(card);
    cardMap[url] = card;
  });

  if (resultsWrapper) {
    resultsWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Fetch concurrently
  const promises = urls.map(url =>
    chrome.runtime.sendMessage({
      action: 'fetchChannelVideos',
      channelUrl: url,
      date,
      apiKey
    })
    .then(resp => ({ url, resp }))
    .catch(err => ({ url, resp: { success: false, error: err.message } }))
  );

  let totalVideos = 0;
  let doneCount = 0;

  promises.forEach(promise => {
    promise.then(({ url, resp }) => {
      doneCount++;
      const card = cardMap[url];
      if (card) {
        if (resp && resp.success) {
          totalVideos += (resp.data ? resp.data.count : 0);
          updateCardSuccess(card, resp.data);
        } else {
          updateCardError(card, resp ? resp.error : 'Lỗi kết nối');
        }
      }

      if (doneCount === urls.length) {
        checkBtn.disabled = false;
        checkBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          Kiểm tra tất cả
        `;
        showSummary(totalVideos, urls.length);
      }
    });
  });
}

// ===== Card Builders =====
function createLoadingCard(url, index) {
  const card = document.createElement('div');
  card.className = 'result-card loading';
  const displayUrl = url.length > 38 ? url.substring(0, 38) + '…' : url;
  card.innerHTML = `
    <div class="result-avatar-wrap">
      <img src="icons/icon48.png" class="result-avatar" alt="loading">
      <span class="result-status-dot"></span>
    </div>
    <div class="result-info">
      <div class="result-name">#${index} Đang tải...</div>
      <div class="result-meta" title="${escapeHtml(url)}">${escapeHtml(displayUrl)}</div>
    </div>
    <div class="result-count-wrap">
      <div class="spinner-inline"></div>
    </div>
    <a class="result-link-btn" style="visibility:hidden" target="_blank">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;
  return card;
}

function updateCardSuccess(card, data) {
  if (!card || !data) return;
  card.className = 'result-card success';
  const { channel, count } = data;
  const isZero = count === 0;
  const channelTitle = channel ? channel.title : 'Kênh YouTube';
  const channelThumb = channel && channel.thumbnail ? channel.thumbnail : 'icons/icon48.png';
  const channelSub = channel && channel.subscriberCount
    ? `👥 ${formatNumber(channel.subscriberCount)} người đăng ký`
    : 'Kênh YouTube';
  const channelLink = channel && channel.id
    ? `https://www.youtube.com/channel/${channel.id}`
    : '#';

  card.innerHTML = `
    <div class="result-avatar-wrap">
      <img
        src="${escapeAttr(channelThumb)}"
        class="result-avatar"
        alt="${escapeHtml(channelTitle)}"
        onerror="this.src='icons/icon48.png'"
      >
      <span class="result-status-dot"></span>
    </div>
    <div class="result-info">
      <div class="result-name" title="${escapeHtml(channelTitle)}">${escapeHtml(channelTitle)}</div>
      <div class="result-meta">${escapeHtml(channelSub)}</div>
    </div>
    <div class="result-count-wrap">
      <div class="result-count ${isZero ? 'zero' : ''}">${count}</div>
      <div class="result-count-label">video</div>
    </div>
    <a
      class="result-link-btn"
      href="${escapeAttr(channelLink)}"
      target="_blank"
      title="Mở kênh trên YouTube"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;
}

function updateCardError(card, errorMsg) {
  if (!card) return;
  card.className = 'result-card error';
  card.innerHTML = `
    <div class="result-avatar-wrap">
      <img src="icons/icon48.png" class="result-avatar" alt="error">
      <span class="result-status-dot"></span>
    </div>
    <div class="result-info">
      <div class="result-name">Lỗi kiểm tra kênh</div>
      <div class="result-meta" title="${escapeHtml(errorMsg || '')}">${escapeHtml(truncate(errorMsg || 'Không xác định', 50))}</div>
    </div>
    <div class="result-count-wrap">
      <div class="result-count" style="-webkit-text-fill-color:var(--accent-red);font-size:18px;">!</div>
    </div>
    <a class="result-link-btn" style="visibility:hidden" target="_blank">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;
}

function showSummary(totalVideos, channelCount) {
  if (!resultsWrapper) return;
  const summary = document.createElement('div');
  summary.className = 'results-summary';
  summary.innerHTML = `
    <span>${channelCount} kênh đã kiểm tra</span>
    <span class="summary-total">Tổng cộng: ${totalVideos} video</span>
  `;
  resultsWrapper.appendChild(summary);
}

// ===== Helpers =====
function formatNumber(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

function formatDate(d) {
  const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function truncate(str, max) {
  return str && str.length > max ? str.substring(0, max) + '…' : (str || '');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, 10px)';
    t.style.transition = 'all 0.2s ease';
    setTimeout(() => t.remove(), 200);
  }, 2500);
}

// ===== Boot =====
let hasInitialized = false;
function safeInit() {
  if (hasInitialized) return;
  hasInitialized = true;
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  safeInit();
}
