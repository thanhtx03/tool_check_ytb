# 📦 Hướng dẫn cài đặt YouTube Channel Checker

## Cấu trúc thư mục extension
```
YoutubeChecked/
├── manifest.json       ← Cấu hình extension
├── popup.html          ← Giao diện popup
├── popup.css           ← Styles
├── popup.js            ← Logic giao diện
├── background.js       ← Logic gọi YouTube API
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Bước 1: Cài extension vào Chrome

1. Mở Chrome → gõ `chrome://extensions/` vào thanh địa chỉ
2. Bật **Developer mode** (góc trên phải)
3. Nhấn **Load unpacked**
4. Chọn thư mục: `C:\Users\metxt\OneDrive\Documents\Tool\YoutubeChecked`
5. Extension **YT Channel Checker** sẽ xuất hiện trên toolbar Chrome

---

## Bước 2: Lấy YouTube API Key (miễn phí)

### 2.1 Tạo Google Cloud Project
1. Vào [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Nhấn **Select a project** → **New Project**
3. Đặt tên (ví dụ: `YouTube-Checker`) → **Create**

### 2.2 Bật YouTube Data API v3
1. Vào **APIs & Services** → **Library**
2. Tìm kiếm `YouTube Data API v3`
3. Nhấn **Enable**

### 2.3 Tạo API Key
1. Vào **APIs & Services** → **Credentials**
2. Nhấn **+ Create Credentials** → **API Key**
3. Copy API Key (dạng `AIzaSy...`)

> [!TIP]
> Để bảo mật, nhấn **Restrict Key** → chọn **YouTube Data API v3** trong API restrictions.

> [!NOTE]
> Free tier cho phép **10.000 requests/ngày** — đủ dùng thông thường.

---

## Bước 3: Cài đặt API Key vào Extension

1. Click icon extension trên Chrome toolbar
2. Nhấn nút ⚙️ (Settings) góc trên phải
3. Dán API Key vào ô → nhấn **Lưu API Key**
4. Thông báo xanh "✓ Đã lưu API Key" = thành công!

---

## Cách sử dụng

1. **Dán link kênh YouTube** vào ô input  
   Hỗ trợ các định dạng:
   - `https://www.youtube.com/@channelhandle`
   - `https://www.youtube.com/channel/UCxxxxxxxx`
   - `https://www.youtube.com/c/channelname`
   - `https://www.youtube.com/user/username`

2. **Chọn ngày** cần kiểm tra (tối đa 7 ngày trước)  
   Có các nút nhanh: Hôm nay, Hôm qua, -2, -3, -7 ngày

3. Nhấn **Kiểm tra** → xem kết quả!

---

## Kết quả hiển thị

- 🖼️ **Avatar + tên kênh** + số subscribers + tổng video
- 📅 **Ngày được kiểm tra**
- 🔴 **Số lượng video** đăng trong ngày đó
- 📋 **Danh sách chi tiết** từng video:
  - Thumbnail
  - Tiêu đề video  
  - Giờ đăng
  - Click để mở video

---

## Lưu ý

- API YouTube chỉ cho phép tìm kiếm video trong khoảng thời gian ~7 ngày gần đây với độ chính xác cao
- Video Shorts cũng được tính vào danh sách
- API Key được lưu local trong Chrome, không gửi đi đâu
