// YouTube Channel Checker - Background Service Worker
// Side Panel Support, DeclarativeNetRequest, Free YouTube RSS & InnerTube API

// Setup DeclarativeNetRequest to ensure InnerTube API calls send youtube.com Origin & Referer
async function setupDeclarativeRules() {
  if (!chrome.declarativeNetRequest) return;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001],
      addRules: [
        {
          id: 1001,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Origin', operation: 'set', value: 'https://www.youtube.com' },
              { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' }
            ]
          },
          condition: {
            urlFilter: '||youtube.com/youtubei/*',
            resourceTypes: ['xmlhttprequest', 'other']
          }
        }
      ]
    });
  } catch (err) {
    console.warn('Declarative rule update notice:', err);
  }
}
setupDeclarativeRules();

// Configure extension icon click to open Side Panel on the right side
chrome.runtime.onInstalled.addListener(() => {
  setupDeclarativeRules();
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error('Error setting panel behavior:', err));
  }
});

chrome.runtime.onStartup.addListener(() => {
  setupDeclarativeRules();
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error('Error setting panel behavior:', err));
  }
});

// Fallback action click handler in case browser does not support setPanelBehavior
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.windowId) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn('Could not open side panel via onClicked:', err);
      }
    }
  });
}

// In-memory channel metadata cache to eliminate redundant fetches
const channelCache = new Map();

// ===== Main Message Listener =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchChannelVideos') {
    handleFetchVideos(request.channelUrl, request.date)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Lỗi không xác định' }));
    return true; // Keep message channel open for async response
  }
});

// ===== Core Logic: Fetch Channel Videos via RSS (0 Quota) =====
async function handleFetchVideos(channelUrl, date) {
  if (!channelUrl || !channelUrl.trim()) {
    throw new Error('URL kênh không hợp lệ');
  }

  // Normalize URL (strip tracking params like ?si=..., normalize to https://www.youtube.com/)
  const cleanUrl = cleanYoutubeUrl(channelUrl);

  // Step 1: Check in-memory cache
  let channelId = parseDirectChannelId(cleanUrl);
  let channelTitle = '';
  let channelAvatar = '';
  let subscriberCount = null;
  let totalVideos = null;

  const cacheKey = cleanUrl.toLowerCase();
  let cachedMeta = null;
  if (channelCache.has(cacheKey)) {
    const cached = channelCache.get(cacheKey);
    if (cached && cached.totalVideos) {
      channelId = cached.channelId;
      channelTitle = cached.title || '';
      channelAvatar = cached.avatar || '';
      subscriberCount = cached.subscriberCount || null;
      totalVideos = cached.totalVideos || null;
      cachedMeta = cached;
    }
  }

  // Step 2: If we don't have channelId yet, resolve via InnerTube API (fast) or web fallback
  if (!channelId) {
    channelId = await resolveChannelId(cleanUrl);
  }

  if (!channelId) {
    throw new Error('Không thể xác định channel ID từ URL này');
  }

  // Step 3: Fetch YouTube RSS XML and Channel Metadata in parallel
  const rssPromise = fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`)
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 404) throw new Error('Kênh không tồn tại hoặc đã bị xóa');
        throw new Error(`HTTP ${res.status}: Không thể tải RSS kênh`);
      }
      return res.text();
    });

  const metaPromise = (cachedMeta && cachedMeta.totalVideos)
    ? Promise.resolve(cachedMeta)
    : getChannelMetadata(channelId, cleanUrl);

  const [rssResult, metaResult] = await Promise.allSettled([rssPromise, metaPromise]);

  if (rssResult.status !== 'fulfilled') {
    throw rssResult.reason || new Error('Lỗi tải dữ liệu kênh');
  }

  const xmlText = rssResult.value;
  const parsedFeed = parseRssFeed(xmlText);

  if (metaResult.status === 'fulfilled' && metaResult.value) {
    const meta = metaResult.value;
    if (meta.title) channelTitle = meta.title;
    if (meta.avatar) channelAvatar = meta.avatar;
    if (meta.subscriberCount) subscriberCount = meta.subscriberCount;
    if (meta.totalVideos) totalVideos = meta.totalVideos;
  }

  if (!channelTitle && parsedFeed.channelTitle) {
    channelTitle = parsedFeed.channelTitle;
  }

  // Calculate target date range in user's local timezone
  // date format: 'YYYY-MM-DD'
  const [year, month, day] = date.split('-').map(Number);
  const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

  // Filter videos posted within the target date
  const matchingVideos = [];
  for (const item of parsedFeed.videos) {
    const pubDate = new Date(item.publishedAt);
    if (!isNaN(pubDate.getTime()) && pubDate >= startDate && pubDate <= endDate) {
      matchingVideos.push(item);
    }
  }

  // Thumbnail / Avatar fallback
  if (!channelAvatar && parsedFeed.videos.length > 0) {
    channelAvatar = parsedFeed.videos[0].thumbnail;
  }

  // Cache resolved channel info
  if (totalVideos) {
    channelCache.set(cacheKey, {
      channelId,
      title: channelTitle,
      avatar: channelAvatar,
      subscriberCount,
      totalVideos
    });
  }

  return {
    channel: {
      id: channelId,
      title: channelTitle || 'Kênh YouTube',
      thumbnail: channelAvatar || 'icons/icon48.png',
      subscriberCount: subscriberCount,
      totalVideos: totalVideos
    },
    videos: matchingVideos,
    date: date,
    count: matchingVideos.length
  };
}

function cleanYoutubeUrl(url) {
  let u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }
  // Strip query string (?si=..., etc.)
  u = u.split('?')[0].replace(/\/+$/, '');
  // Normalize domain to https://www.youtube.com/
  u = u.replace(/https?:\/\/(?:www\.)?youtube\.com\//i, 'https://www.youtube.com/');
  return u;
}

function parseDirectChannelId(url) {
  const trimmed = url.trim();

  // Direct channel ID: UC...
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // URL containing /channel/UC...
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
  if (channelMatch) {
    return channelMatch[1];
  }

  return null;
}

async function resolveChannelId(url) {
  // Method 1: YouTube InnerTube API (Official internal JSON API, ultra-fast, handles handles & custom URLs)
  try {
    const innertubeUrl = 'https://www.youtube.com/youtubei/v1/navigation/resolve_url';
    const payload = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.00.00'
        }
      },
      url: url
    };

    const response = await fetch(innertubeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      const browseId = data?.endpoint?.browseEndpoint?.browseId;
      if (browseId && browseId.startsWith('UC')) {
        return browseId;
      }
    }
  } catch (err) {
    console.warn('InnerTube resolve failed, attempting web fallback:', err);
  }

  // Method 2: Web Scraping Fallback
  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    const patterns = [
      /feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/,
      /youtube\.com\/channel\/(UC[\w-]{22})/,
      /"browseId":"(UC[\w-]{22})"/,
      /"channelId":"(UC[\w-]{22})"/,
      /"externalId":"(UC[\w-]{22})"/,
      /itemprop="identifier"\s+content="(UC[\w-]{22})"/,
      /itemprop="channelId"\s+content="(UC[\w-]{22})"/
    ];

    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        return m[1];
      }
    }
  } catch (err) {
    console.error('Web scraping fallback error:', err);
  }

  throw new Error('Không thể tìm thấy ID của kênh này');
}

// Helper to extract channel metadata from YouTube JSON structure
function extractMetadataFromYtData(data) {
  if (!data) return {};

  let title = '';
  let avatar = '';
  let subscriberCount = null;
  let videoCount = null;

  // 1. Current YouTube pageHeaderViewModel
  const vm = data?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
  if (vm) {
    title = vm?.title?.dynamicTextViewModel?.text?.content || '';
    const sources = vm?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
    avatar = sources && sources.length > 0 ? sources[sources.length - 1]?.url : '';

    const rows = vm?.metadata?.contentMetadataViewModel?.metadataRows || [];
    for (const row of rows) {
      const parts = row?.metadataParts || [];
      for (const part of parts) {
        const txt = part?.text?.content || '';
        if (txt.includes('đăng ký') || txt.toLowerCase().includes('subscribers') || txt.includes('구독자')) {
          subscriberCount = txt;
        } else if (txt.toLowerCase().includes('video') || txt.includes('동영상')) {
          videoCount = txt;
        }
      }
    }
  }

  // 2. Legacy YouTube c4TabbedHeaderRenderer
  const c4 = data?.header?.c4TabbedHeaderRenderer;
  if (c4) {
    if (!title) title = c4.title || '';
    if (!avatar) {
      const thumbs = c4.avatar?.thumbnails || [];
      avatar = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : '';
    }
    if (!subscriberCount) {
      subscriberCount = c4.subscriberCountText?.simpleText || c4.subscriberCountText?.runs?.[0]?.text || null;
    }
    if (!videoCount) {
      videoCount = c4.videosCountText?.runs?.[0]?.text || c4.videosCountText?.simpleText || null;
    }
  }

  // 3. Fallback: scan raw JSON if total videos wasn't extracted
  if (!videoCount) {
    try {
      const raw = JSON.stringify(data);
      const m = raw.match(/"(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*video)"/i) ||
                raw.match(/"(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*videos?)"/i) ||
                raw.match(/"(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*개의\s*동영상)"/i) ||
                raw.match(/(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*video)/i);
      if (m) videoCount = m[1];
    } catch (e) {}
  }

  return {
    title,
    avatar,
    subscriberCount,
    totalVideos: videoCount
  };
}

async function getChannelMetadata(channelId, channelUrl) {
  let partialMeta = {};

  // Method 1: YouTube InnerTube browse API (super fast, ~50-80ms)
  try {
    const browseUrl = 'https://www.youtube.com/youtubei/v1/browse';
    const payload = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.00.00',
          hl: 'vi'
        }
      },
      browseId: channelId
    };

    const resp = await fetch(browseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const data = await resp.json();
      const meta = extractMetadataFromYtData(data);
      if (meta && meta.totalVideos) {
        return meta;
      }
      if (meta && (meta.title || meta.avatar)) {
        partialMeta = meta;
      }
    }
  } catch (err) {
    console.warn('InnerTube browse API failed, falling back to HTML:', err);
  }

  // Method 2: Channel Page HTML Scraping Fallback
  try {
    const targetUrl = (channelUrl && channelUrl.includes('youtube.com'))
      ? channelUrl
      : `https://www.youtube.com/channel/${channelId}`;

    const resp = await fetch(targetUrl, {
      headers: {
        'Accept-Language': 'vi,en;q=0.9'
      }
    });

    if (resp.ok) {
      const html = await resp.text();

      // Extract ytInitialData
      const m = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/) ||
                html.match(/window\["ytInitialData"\]\s*=\s*({.+?});<\/script>/);
      if (m) {
        try {
          const data = JSON.parse(m[1]);
          const meta = extractMetadataFromYtData(data);
          if (meta && meta.totalVideos) {
            return {
              ...partialMeta,
              ...meta
            };
          }
        } catch (e) {
          console.warn('Failed to parse ytInitialData JSON:', e);
        }
      }

      // Check contentMetadataViewModel directly in HTML
      const vmMatch = html.match(/"contentMetadataViewModel":\s*({.+?"delimiter":.+?})/);
      if (vmMatch) {
        try {
          const vm = JSON.parse(vmMatch[1]);
          for (const r of vm.metadataRows || []) {
            for (const p of r.metadataParts || []) {
              const txt = p.text?.content || '';
              if (txt.toLowerCase().includes('video') || txt.includes('동영상')) {
                return {
                  ...partialMeta,
                  totalVideos: txt
                };
              }
            }
          }
        } catch (e) {}
      }

      // Regex fallback across HTML
      const regexMatch = html.match(/"(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*video)"/i) ||
                         html.match(/(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*video)/i);
      if (regexMatch) {
        return {
          ...partialMeta,
          totalVideos: regexMatch[1]
        };
      }
    }
  } catch (err) {
    console.warn('HTML scraping fallback error:', err);
  }

  return partialMeta;
}

function parseRssFeed(xml) {
  let channelTitle = '';
  const firstEntryIndex = xml.indexOf('<entry>');
  const headerXml = firstEntryIndex !== -1 ? xml.substring(0, firstEntryIndex) : xml;
  const titleMatch = headerXml.match(/<title>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    channelTitle = unescapeXml(titleMatch[1].trim());
  }

  const videos = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const idMatch = entryXml.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/i);
    const videoTitleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
    const pubMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/i);
    const thumbMatch = entryXml.match(/<media:thumbnail\s+[^>]*url="([^"]+)"/i);
    const descMatch = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/i);

    const videoId = idMatch ? idMatch[1].trim() : '';
    const title = videoTitleMatch ? unescapeXml(videoTitleMatch[1].trim()) : '';
    const publishedAt = pubMatch ? pubMatch[1].trim() : '';
    const thumbnail = thumbMatch ? thumbMatch[1] : (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
    const description = descMatch ? unescapeXml(descMatch[1].trim()) : '';

    if (videoId) {
      videos.push({
        id: videoId,
        title,
        thumbnail,
        publishedAt,
        description: description.substring(0, 100)
      });
    }
  }

  return {
    channelTitle,
    videos
  };
}

function unescapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
