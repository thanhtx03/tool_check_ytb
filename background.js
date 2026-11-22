// Background service worker - YouTube Channel Checker (Side Panel & RSS Feed Mode - No API Key Needed)
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Channel Checker installed (Side Panel & RSS Mode - 100% Free, No API Key)!');

  // Configure side panel behavior: open side panel when clicking the toolbar action icon
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('SidePanel setPanelBehavior error:', error));
  }
});

// Configure side panel on startup/worker awake
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('SidePanel setPanelBehavior error:', error));
}

// Fallback: If action.onClicked triggers, open the side panel
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (e) {
        console.error('Failed to open side panel on click:', e);
      }
    }
  });
}

// Cache channel metadata to avoid re-fetching web pages repeatedly
const channelCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchChannelVideos') {
    fetchChannelVideos(request.channelUrl, request.date)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function fetchChannelVideos(channelUrl, date) {
  if (!channelUrl) {
    throw new Error('Link kênh trống');
  }

  // Step 1: Parse channel URL or ID
  const channelInfo = parseChannelUrl(channelUrl);
  let channelId = channelInfo.channelId;
  let channelTitle = '';
  let channelAvatar = '';
  let subscriberCount = null;

  const cacheKey = channelUrl.trim().toLowerCase();
  if (channelCache.has(cacheKey)) {
    const cached = channelCache.get(cacheKey);
    channelId = cached.channelId;
    channelTitle = cached.title || '';
    channelAvatar = cached.avatar || '';
    subscriberCount = cached.subscriberCount || null;
  }

  // Step 2: If we don't have channelId yet, resolve from channel web page
  if (!channelId) {
    const resolved = await resolveChannelFromWeb(channelUrl);
    channelId = resolved.channelId;
    if (resolved.title) channelTitle = resolved.title;
    if (resolved.avatar) channelAvatar = resolved.avatar;
    if (resolved.subscriberCount) subscriberCount = resolved.subscriberCount;

    channelCache.set(cacheKey, {
      channelId,
      title: channelTitle,
      avatar: channelAvatar,
      subscriberCount
    });
  }

  if (!channelId) {
    throw new Error('Không thể xác định channel ID từ URL này');
  }

  // Step 3: Fetch YouTube RSS XML
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const rssResponse = await fetch(rssUrl);

  if (!rssResponse.ok) {
    if (rssResponse.status === 404) {
      throw new Error('Kênh không tồn tại hoặc đã bị xóa');
    }
    throw new Error(`HTTP ${rssResponse.status}: Không thể tải RSS kênh`);
  }

  const xmlText = await rssResponse.text();

  // Step 4: Parse RSS XML
  const parsedFeed = parseRssFeed(xmlText);

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

  // If no avatar was extracted, fallback to the latest video's thumbnail
  if (!channelAvatar && parsedFeed.videos.length > 0) {
    channelAvatar = parsedFeed.videos[0].thumbnail;
  }

  // Cache resolved channel info
  if (channelTitle && !channelCache.has(cacheKey)) {
    channelCache.set(cacheKey, {
      channelId,
      title: channelTitle,
      avatar: channelAvatar,
      subscriberCount
    });
  }

  return {
    channel: {
      id: channelId,
      title: channelTitle || 'Kênh YouTube',
      thumbnail: channelAvatar || 'icons/icon48.png',
      subscriberCount: subscriberCount
    },
    videos: matchingVideos,
    date: date,
    count: matchingVideos.length
  };
}

function parseChannelUrl(url) {
  const trimmed = url.trim();

  // Direct channel ID: UC...
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return { channelId: trimmed };
  }

  // URL containing /channel/UC...
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
  if (channelMatch) {
    return { channelId: channelMatch[1] };
  }

  return { channelUrl: trimmed };
}

async function resolveChannelFromWeb(url) {
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const response = await fetch(targetUrl, {
    headers: {
      'Accept-Language': 'vi,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Không thể mở trang kênh YouTube`);
  }

  const html = await response.text();

  // 1. Channel ID
  let channelId = null;
  const rssLinkMatch = html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/);
  if (rssLinkMatch) {
    channelId = rssLinkMatch[1];
  } else {
    const canonicalMatch = html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (canonicalMatch) {
      channelId = canonicalMatch[1];
    } else {
      const browseIdMatch = html.match(/"browseId":"(UC[\w-]{22})"/);
      if (browseIdMatch) {
        channelId = browseIdMatch[1];
      } else {
        const channelIdMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
        if (channelIdMatch) {
          channelId = channelIdMatch[1];
        }
      }
    }
  }

  if (!channelId) {
    throw new Error('Không thể tìm thấy ID của kênh này');
  }

  // 2. Channel Title
  let title = '';
  const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
                     html.match(/<title>([\s\S]*?)(?:\s*-\s*YouTube)?<\/title>/i);
  if (titleMatch) {
    title = unescapeXml(titleMatch[1].trim());
  }

  // 3. Avatar
  let avatar = '';
  const avatarMatch = html.match(/<link\s+rel="image_src"\s+href="([^"]+)"/i) ||
                      html.match(/"avatar":\s*\{\s*"thumbnails":\s*\[\s*\{\s*"url":\s*"([^"]+)"/i) ||
                      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (avatarMatch) {
    avatar = avatarMatch[1];
  }

  // 4. Subscriber Count
  let subscriberCount = null;
  const subMatch = html.match(/"userInteractionCount":\s*"(\d+)"/);
  if (subMatch) {
    subscriberCount = subMatch[1];
  }

  return {
    channelId,
    title,
    avatar,
    subscriberCount
  };
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
