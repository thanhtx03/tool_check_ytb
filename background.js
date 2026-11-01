// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube Channel Checker installed!');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchChannelVideos') {
    fetchChannelVideos(request.channelUrl, request.date, request.apiKey)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

async function fetchChannelVideos(channelUrl, date, apiKey) {
  // Extract channel ID or handle from URL
  const channelInfo = parseChannelUrl(channelUrl);
  
  let channelId = channelInfo.channelId;
  
  // If we have a handle or username, resolve to channel ID first
  if (channelInfo.handle || channelInfo.username) {
    channelId = await resolveChannelId(channelInfo, apiKey);
  }
  
  if (!channelId) {
    throw new Error('Không thể xác định channel ID từ URL này');
  }
  
  // Get channel info
  const channelData = await getChannelInfo(channelId, apiKey);
  
  // Calculate date range
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  // Search for videos in the date range
  const videos = await searchVideosInDateRange(channelId, startDate, endDate, apiKey);
  
  return {
    channel: channelData,
    videos: videos,
    date: date,
    count: videos.length
  };
}

function parseChannelUrl(url) {
  const patterns = [
    // https://www.youtube.com/channel/UCxxxxxx
    { regex: /youtube\.com\/channel\/(UC[\w-]+)/, key: 'channelId' },
    // https://www.youtube.com/@handle
    { regex: /youtube\.com\/@([\w.-]+)/, key: 'handle' },
    // https://www.youtube.com/c/username
    { regex: /youtube\.com\/c\/([\w.-]+)/, key: 'username' },
    // https://www.youtube.com/user/username
    { regex: /youtube\.com\/user\/([\w.-]+)/, key: 'legacyUsername' },
    // https://www.youtube.com/username (short form)
    { regex: /youtube\.com\/([\w.-]+)$/, key: 'username' },
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern.regex);
    if (match) {
      return { [pattern.key]: match[1] };
    }
  }
  
  // If it looks like a raw channel ID
  if (/^UC[\w-]{22}$/.test(url.trim())) {
    return { channelId: url.trim() };
  }
  
  throw new Error('URL kênh YouTube không hợp lệ. Vui lòng nhập đúng định dạng.');
}

async function resolveChannelId(channelInfo, apiKey) {
  let url;
  
  if (channelInfo.handle) {
    // Use forHandle parameter (new API)
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(channelInfo.handle)}&key=${apiKey}`;
  } else if (channelInfo.legacyUsername) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(channelInfo.legacyUsername)}&key=${apiKey}`;
  } else if (channelInfo.username) {
    // Try forHandle first (@ handles), then forUsername
    url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(channelInfo.username)}&key=${apiKey}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `HTTP ${response.status}: Lỗi kết nối API`);
  }
  
  const data = await response.json();
  
  if (data.items && data.items.length > 0) {
    return data.items[0].id;
  }
  
  // Fallback: try forUsername if forHandle failed
  if (channelInfo.username && !channelInfo.legacyUsername) {
    const url2 = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${encodeURIComponent(channelInfo.username)}&key=${apiKey}`;
    const resp2 = await fetch(url2);
    const data2 = await resp2.json();
    if (data2.items && data2.items.length > 0) {
      return data2.items[0].id;
    }
  }
  
  throw new Error('Không tìm thấy kênh. Vui lòng kiểm tra lại URL hoặc handle kênh.');
}

async function getChannelInfo(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `HTTP ${response.status}: Lỗi kết nối API`);
  }
  
  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('Không tìm thấy thông tin kênh');
  }
  
  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url || channel.snippet.thumbnails?.medium?.url,
    subscriberCount: channel.statistics?.subscriberCount,
    videoCount: channel.statistics?.videoCount,
    description: channel.snippet.description?.substring(0, 150)
  };
}

async function searchVideosInDateRange(channelId, startDate, endDate, apiKey) {
  const publishedAfter = startDate.toISOString();
  const publishedBefore = endDate.toISOString();
  
  let videos = [];
  let nextPageToken = null;
  
  do {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&publishedAfter=${publishedAfter}&publishedBefore=${publishedBefore}&maxResults=50&key=${apiKey}`;
    
    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: Lỗi kết nối API`);
    }
    
    const data = await response.json();
    
    if (data.items) {
      for (const item of data.items) {
        videos.push({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description?.substring(0, 100)
        });
      }
    }
    
    nextPageToken = data.nextPageToken;
    
    // Safety: max 5 pages (250 videos)
    if (videos.length >= 250) break;
    
  } while (nextPageToken);
  
  return videos;
}
