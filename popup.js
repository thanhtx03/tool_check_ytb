// ===== State =====
let apiKey = '';
const MAX_CHANNELS = 20;

// ===== DOM =====
const settingsBtn     = document.getElementById('settingsBtn');
const apiPanel        = document.getElementById('apiPanel');
const closePanelBtn   = document.getElementById('closePanelBtn');
const saveApiBtn      = document.getElementById('saveApiBtn');
const apiKeyInput     = document.getElementById('apiKeyInput');
const toggleApiKey    = document.getElementById('toggleApiKey');
const noApiBanner     = document.getElementById('noApiBanner');
const goToApiBtn      = document.getElementById('goToApiBtn');

const checkDateInput  = document.getElementById('checkDate');
const quickDateBtns   = document.querySelectorAll('.quick-date-btn');

const channelInputs   = document.getElementById('channelInputs');
const addChannelBtn   = document.getElementById('addChannelBtn');
const checkBtn        = document.getElementById('checkBtn');

const resultsWrapper  = document.getElementById('resultsWrapper');
const resultsTitle    = document.getElementById('resultsTitle');
const resultsDateBadge = document.getElementById('resultsDateBadge');
const resultsList     = document.getElementById('resultsList');

const fileInput       = document.getElementById('fileInput');

const fileBadge       = document.getElementById('fileBadge');
const fileBadgeName   = document.getElementById('fileBadgeName');
const fileBadgeCount  = document.getElementById('fileBadgeCount');
const fileBadgeClear  = document.getElementById('fileBadgeClear');

// ===== Init =====
async function init() {
  const stored = await chrome.storage.local.get(['ytApiKey', 'savedChannels', 'importedFile']);

  if (stored.ytApiKey) {
    apiKey = stored.ytApiKey;
    apiKeyInput.value = apiKey;
    noApiBanner.style.display = 'none';
  } else {
    noApiBanner.style.display = 'flex';
  }

  // Restore saved channels or start with 1
  const saved = stored.savedChannels || [''];
  saved.forEach(url => addChannelRow(url));

  // Restore file badge if a file was previously imported
  if (stored.importedFile) {
    showFileBadge(stored.importedFile.name, stored.importedFile.count);
  }

  setDateOffset(0);
}

// ===== Settings Panel =====
settingsBtn.addEventListener('click', () => { apiPanel.style.display = 'block'; });
closePanelBtn.addEventListener('click', () => { apiPanel.style.display = 'none'; });
goToApiBtn.addEventListener('click', () => { apiPanel.style.display = 'block'; });

// ===== Pin Button =====
const pinBtn          = document.getElementById('pinBtn');
const pinTooltip      = document.getElementById('pinTooltip');
const pinTooltipClose = document.getElementById('pinTooltipClose');

pinBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = pinTooltip.style.display !== 'none';
  pinTooltip.style.display = isOpen ? 'none' : 'block';
});
pinTooltipClose.addEventListener('click', (e) => {
  e.stopPropagation();
  pinTooltip.style.display = 'none';
});
document.addEventListener('click', (e) => {
  if (!document.getElementById('pinWrap').contains(e.target)) {
    pinTooltip.style.display = 'none';
  }
});

// ===== Import File =====
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  importFromFile(file);
});

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    // Parse: split by lines, trim, remove blanks and comment lines (#)
    const rawLines = text.split(/\r?\n/);
    const urls = rawLines
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'))
      // Normalize: add https:// if missing
      .map(l => l.startsWith('http') ? l : 'https://' + l)
      // Keep only lines that look like YouTube URLs
      .filter(l => l.includes('youtube.com') || l.includes('youtu.be'));

    if (urls.length === 0) {
      showToast('Không tìm thấy link YouTube hợp lệ trong file!', 'error');
      return;
    }

    if (urls.length > MAX_CHANNELS) {
      showToast(`File có ${urls.length} kênh, chỉ lấy ${MAX_CHANNELS} kênh đầu tiên.`, 'error');
    }

    const toImport = urls.slice(0, MAX_CHANNELS);

    // Replace existing rows
    channelInputs.innerHTML = '';
    toImport.forEach(url => addChannelRow(url));
    saveChannels();

    // Show and persist file badge
    setFileBadge(file.name, toImport.length);
  };
  reader.onerror = () => showToast('Lỗi đọc file!', 'error');
  reader.readAsText(file, 'utf-8');
}

// Show the persistent file badge and save to storage
function setFileBadge(filename, count) {
  chrome.storage.local.set({ importedFile: { name: filename, count } });
  showFileBadge(filename, count);
}

function showFileBadge(filename, count) {
  fileBadgeName.textContent = filename;
  fileBadgeCount.textContent = `${count} kênh được nạp`;
  fileBadge.style.display = 'flex';
}

// Clear button: xoá badge và storage
fileBadgeClear.addEventListener('click', async () => {
  await chrome.storage.local.remove('importedFile');
  fileBadge.style.display = 'none';
  fileBadgeName.textContent = '';
  fileBadgeCount.textContent = '';
});

toggleApiKey.addEventListener('click', () => {
  const isPwd = apiKeyInput.type === 'password';
  apiKeyInput.type = isPwd ? 'text' : 'password';
  toggleApiKey.style.color = isPwd ? 'var(--accent-red)' : 'var(--text-muted)';
});

saveApiBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) { showToast('Vui lòng nhập API Key!', 'error'); return; }
  if (!key.startsWith('AIza')) { showToast('API Key không đúng định dạng!', 'error'); return; }
  apiKey = key;
  await chrome.storage.local.set({ ytApiKey: key });
  noApiBanner.style.display = 'none';
  apiPanel.style.display = 'none';
  showToast('✓ Đã lưu API Key!');
});

// ===== Date Picker =====
function setDateOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  checkDateInput.value = toDateString(d);
  quickDateBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.offset) === offset));
}

function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

quickDateBtns.forEach(btn => {
  btn.addEventListener('click', () => setDateOffset(Number(btn.dataset.offset)));
});
checkDateInput.addEventListener('change', () => {
  quickDateBtns.forEach(b => b.classList.remove('active'));
});

// ===== Channel Input Rows =====
function getRows() {
  return [...channelInputs.querySelectorAll('.channel-input-row')];
}

function addChannelRow(value = '') {
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
      placeholder="https://www.youtube.com/@kenhcuaban"
      value="${escapeAttr(value)}"
      id="channel-input-${idx}"
    >
    <button class="remove-channel-btn" title="Xoá kênh này" ${rows.length === 0 ? 'disabled' : ''}>✕</button>
  `;

  // Remove button
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

  // Auto-save on change
  row.querySelector('.channel-url-input').addEventListener('input', () => {
    saveChannels();
  });

  channelInputs.appendChild(row);
  updateAddBtn();
}

function refreshRowNumbers() {
  getRows().forEach((row, i) => {
    row.querySelector('.channel-num').textContent = i + 1;
    const removeBtn = row.querySelector('.remove-channel-btn');
    removeBtn.disabled = getRows().length <= 1;
  });
  updateAddBtn();
}

function updateAddBtn() {
  const count = getRows().length;
  addChannelBtn.disabled = count >= MAX_CHANNELS;
  addChannelBtn.title = count >= MAX_CHANNELS ? `Tối đa ${MAX_CHANNELS} kênh` : '';
}

async function saveChannels() {
  const urls = getRows().map(r => r.querySelector('.channel-url-input').value.trim());
  await chrome.storage.local.set({ savedChannels: urls });
}

addChannelBtn.addEventListener('click', () => {
  addChannelRow('');
  const inputs = channelInputs.querySelectorAll('.channel-url-input');
  inputs[inputs.length - 1].focus();
});

// ===== Main Check =====
checkBtn.addEventListener('click', runCheck);

async function runCheck() {
  const date = checkDateInput.value;

  if (!date) { showToast('Vui lòng chọn ngày!', 'error'); return; }
  if (!apiKey) { apiPanel.style.display = 'block'; return; }

  // Validate date
  const selectedDate = new Date(date + 'T00:00:00');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  if (selectedDate < sevenDaysAgo) {
    showToast('Chỉ kiểm tra được trong vòng 7 ngày!', 'error');
    return;
  }

  // Collect URLs
  const urls = getRows()
    .map(r => r.querySelector('.channel-url-input').value.trim())
    .filter(u => u.length > 0);

  if (urls.length === 0) {
    showToast('Vui lòng nhập ít nhất 1 link kênh!', 'error');
    return;
  }

  checkBtn.disabled = true;

  // Show results container
  resultsWrapper.style.display = 'block';
  const dateObj = new Date(date + 'T00:00:00');
  resultsDateBadge.textContent = formatDate(dateObj);
  resultsTitle.textContent = `Kết quả (${urls.length} kênh)`;
  resultsList.innerHTML = '';

  // Remove old summary if exists
  const oldSummary = resultsWrapper.querySelector('.results-summary');
  if (oldSummary) oldSummary.remove();

  // Create placeholder cards
  const cardMap = {};
  urls.forEach((url, i) => {
    const card = createLoadingCard(url, i + 1);
    resultsList.appendChild(card);
    cardMap[url] = card;
  });

  // Scroll into view
  resultsWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Fetch all channels concurrently
  const promises = urls.map(url =>
    chrome.runtime.sendMessage({
      action: 'fetchChannelVideos',
      channelUrl: url,
      date: date,
      apiKey: apiKey
    }).then(resp => ({ url, resp }))
      .catch(err => ({ url, resp: { success: false, error: err.message } }))
  );

  let totalVideos = 0;
  let doneCount = 0;

  // Handle responses as they come in
  promises.forEach(promise => {
    promise.then(({ url, resp }) => {
      doneCount++;
      const card = cardMap[url];
      if (resp.success) {
        totalVideos += resp.data.count;
        updateCardSuccess(card, resp.data);
      } else {
        updateCardError(card, resp.error);
      }

      // When all done, show summary
      if (doneCount === urls.length) {
        checkBtn.disabled = false;
        showSummary(totalVideos, urls.length);
      }
    });
  });
}

// ===== Card Builders =====
function createLoadingCard(url, index) {
  const card = document.createElement('div');
  card.className = 'result-card loading';

  // Try to show a friendly name from URL while loading
  const displayUrl = url.length > 35 ? url.substring(0, 35) + '…' : url;

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
  card.className = 'result-card success';
  const channel = data.channel;
  const count = data.count;
  const isZero = count === 0;

  card.innerHTML = `
    <div class="result-avatar-wrap">
      <img 
        src="${channel.thumbnail || 'icons/icon48.png'}" 
        class="result-avatar" 
        alt="${escapeHtml(channel.title)}"
        onerror="this.src='icons/icon48.png'"
      >
      <span class="result-status-dot"></span>
    </div>
    <div class="result-info">
      <div class="result-name" title="${escapeHtml(channel.title)}">${escapeHtml(channel.title)}</div>
      <div class="result-meta">${
        channel.subscriberCount 
          ? `👥 ${formatNumber(channel.subscriberCount)} subscribers` 
          : 'YouTube Channel'
      }</div>
    </div>
    <div class="result-count-wrap">
      <div class="result-count ${isZero ? 'zero' : ''}">${count}</div>
      <div class="result-count-label">video</div>
    </div>
    <a 
      class="result-link-btn" 
      href="https://www.youtube.com/channel/${channel.id}" 
      target="_blank"
      title="Mở kênh"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  `;
}

function updateCardError(card, errorMsg) {
  card.className = 'result-card error';
  card.innerHTML = `
    <div class="result-avatar-wrap">
      <img src="icons/icon48.png" class="result-avatar" alt="error">
      <span class="result-status-dot"></span>
    </div>
    <div class="result-info">
      <div class="result-name">Lỗi tải kênh</div>
      <div class="result-meta" title="${escapeHtml(errorMsg || '')}">${escapeHtml(truncate(errorMsg || 'Không xác định', 52))}</div>
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
  const summary = document.createElement('div');
  summary.className = 'results-summary';
  summary.innerHTML = `
    <span>${channelCount} kênh đã kiểm tra</span>
    <span class="summary-total">Tổng: ${totalVideos} video</span>
  `;
  resultsWrapper.appendChild(summary);
}

// ===== Helpers =====
function formatNumber(num) {
  const n = parseInt(num);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

function formatDate(d) {
  const days = ['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function truncate(str, max) {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ===== Boot =====
init();
