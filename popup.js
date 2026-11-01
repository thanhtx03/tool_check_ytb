// ===== State =====
let apiKey = '';
let lastResult = null;

// ===== DOM Elements =====
const settingsBtn = document.getElementById('settingsBtn');
const apiPanel = document.getElementById('apiPanel');
const closePanelBtn = document.getElementById('closePanelBtn');
const saveApiBtn = document.getElementById('saveApiBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKey = document.getElementById('toggleApiKey');
const noApiBanner = document.getElementById('noApiBanner');
const goToApiBtn = document.getElementById('goToApiBtn');

const channelUrlInput = document.getElementById('channelUrl');
const clearUrlBtn = document.getElementById('clearUrl');
const checkDateInput = document.getElementById('checkDate');
const quickDateBtns = document.querySelectorAll('.quick-date-btn');
const checkBtn = document.getElementById('checkBtn');

const loadingState = document.getElementById('loadingState');
const loadingText = document.getElementById('loadingText');
const resultsSection = document.getElementById('resultsSection');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

// Channel info
const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const subscriberCount = document.getElementById('subscriberCount');
const totalVideoCount = document.getElementById('totalVideoCount');
const channelLink = document.getElementById('channelLink');
const summaryDate = document.getElementById('summaryDate');
const videoCountBadge = document.getElementById('videoCountBadge');
const noVideos = document.getElementById('noVideos');
const videoList = document.getElementById('videoList');

// ===== Initialize =====
async function init() {
  // Load saved API key
  const stored = await chrome.storage.local.get(['ytApiKey', 'lastChannelUrl']);
  if (stored.ytApiKey) {
    apiKey = stored.ytApiKey;
    apiKeyInput.value = apiKey;
    noApiBanner.style.display = 'none';
  } else {
    noApiBanner.style.display = 'flex';
  }

  // Restore last channel URL
  if (stored.lastChannelUrl) {
    channelUrlInput.value = stored.lastChannelUrl;
    updateClearBtn();
  }

  // Set today's date as default
  setDateOffset(0);
}

// ===== Settings Panel =====
settingsBtn.addEventListener('click', () => {
  apiPanel.style.display = 'block';
});

closePanelBtn.addEventListener('click', () => {
  apiPanel.style.display = 'none';
});

saveApiBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Vui lòng nhập API Key!', 'error');
    return;
  }
  if (!key.startsWith('AIza')) {
    showToast('API Key không đúng định dạng!', 'error');
    return;
  }

  apiKey = key;
  await chrome.storage.local.set({ ytApiKey: key });
  noApiBanner.style.display = 'none';
  apiPanel.style.display = 'none';
  showToast('✓ Đã lưu API Key thành công!');
});

toggleApiKey.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleApiKey.style.color = isPassword ? 'var(--accent-red)' : 'var(--text-muted)';
});

goToApiBtn.addEventListener('click', () => {
  apiPanel.style.display = 'block';
});

// ===== URL Input =====
channelUrlInput.addEventListener('input', () => {
  updateClearBtn();
});

clearUrlBtn.addEventListener('click', () => {
  channelUrlInput.value = '';
  clearUrlBtn.style.display = 'none';
  channelUrlInput.focus();
});

function updateClearBtn() {
  clearUrlBtn.style.display = channelUrlInput.value ? 'flex' : 'none';
}

// ===== Date Picker =====
function setDateOffset(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  checkDateInput.value = `${yyyy}-${mm}-${dd}`;
  
  // Update active state
  quickDateBtns.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.offset) === daysOffset);
  });
}

quickDateBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setDateOffset(Number(btn.dataset.offset));
  });
});

checkDateInput.addEventListener('change', () => {
  // Deactivate all quick buttons when manually selecting
  quickDateBtns.forEach(btn => btn.classList.remove('active'));
});

// ===== Main Check Logic =====
checkBtn.addEventListener('click', () => runCheck());

retryBtn.addEventListener('click', () => runCheck());

async function runCheck() {
  const url = channelUrlInput.value.trim();
  const date = checkDateInput.value;

  if (!url) {
    channelUrlInput.focus();
    channelUrlInput.style.borderColor = 'var(--accent-red)';
    setTimeout(() => channelUrlInput.style.borderColor = '', 1500);
    return;
  }

  if (!date) {
    showToast('Vui lòng chọn ngày!', 'error');
    return;
  }

  if (!apiKey) {
    apiPanel.style.display = 'block';
    return;
  }

  // Validate date (max 7 days ago)
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  if (selectedDate > today) {
    showToast('Không thể kiểm tra ngày trong tương lai!', 'error');
    return;
  }

  if (selectedDate < sevenDaysAgo) {
    showToast('Chỉ có thể kiểm tra trong vòng 7 ngày!', 'error');
    return;
  }

  // Save last URL
  await chrome.storage.local.set({ lastChannelUrl: url });

  // Show loading
  showLoading('Đang tải thông tin kênh...');
  checkBtn.disabled = true;

  try {
    loadingText.textContent = 'Đang tìm kiếm video trong ngày...';

    const response = await chrome.runtime.sendMessage({
      action: 'fetchChannelVideos',
      channelUrl: url,
      date: date,
      apiKey: apiKey
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    lastResult = response.data;
    displayResults(response.data);
  } catch (error) {
    showError(error.message);
  } finally {
    checkBtn.disabled = false;
  }
}

// ===== Display Functions =====
function showLoading(text) {
  loadingState.style.display = 'flex';
  loadingText.textContent = text || 'Đang tải...';
  resultsSection.style.display = 'none';
  errorState.style.display = 'none';
}

function showError(message) {
  loadingState.style.display = 'none';
  resultsSection.style.display = 'none';
  errorState.style.display = 'flex';
  errorMessage.textContent = message || 'Đã xảy ra lỗi không xác định';
}

function displayResults(data) {
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
  resultsSection.style.display = 'flex';

  // Channel info
  const channel = data.channel;
  channelAvatar.src = channel.thumbnail || 'icons/icon48.png';
  channelAvatar.alt = channel.title;
  channelName.textContent = channel.title;
  channelLink.href = `https://www.youtube.com/channel/${channel.id}`;
  
  subscriberCount.textContent = channel.subscriberCount 
    ? `👥 ${formatNumber(channel.subscriberCount)} người đăng ký` 
    : '';
  totalVideoCount.textContent = channel.videoCount 
    ? `📹 ${formatNumber(channel.videoCount)} video` 
    : '';

  // Summary
  const dateObj = new Date(data.date + 'T00:00:00');
  summaryDate.textContent = `📅 ${formatDate(dateObj)}`;
  videoCountBadge.textContent = data.count;

  // Videos
  videoList.innerHTML = '';
  
  if (data.videos.length === 0) {
    noVideos.style.display = 'flex';
    videoList.style.display = 'none';
  } else {
    noVideos.style.display = 'none';
    videoList.style.display = 'flex';
    
    data.videos.forEach((video, index) => {
      const item = createVideoItem(video, index + 1);
      videoList.appendChild(item);
    });
  }
}

function createVideoItem(video, index) {
  const a = document.createElement('a');
  a.className = 'video-item';
  a.href = `https://www.youtube.com/watch?v=${video.id}`;
  a.target = '_blank';
  
  const publishTime = new Date(video.publishedAt);
  const timeStr = publishTime.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });

  a.innerHTML = `
    <div class="video-thumbnail-wrapper">
      <img 
        src="${video.thumbnail || ''}" 
        alt="${escapeHtml(video.title)}" 
        class="video-thumbnail"
        onerror="this.src='icons/icon48.png'"
      >
      <span class="video-index">#${index}</span>
    </div>
    <div class="video-info">
      <div class="video-title">${escapeHtml(video.title)}</div>
      <div class="video-time">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        ${timeStr}
      </div>
    </div>
  `;

  return a;
}

// ===== Utility Functions =====
function formatNumber(num) {
  const n = parseInt(num);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

function formatDate(date) {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dayName}, ${dd}/${mm}/${yyyy}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  if (type === 'error') {
    toast.style.background = 'rgba(239, 68, 68, 0.9)';
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// ===== Start =====
init();
