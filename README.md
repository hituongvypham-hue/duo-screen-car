# DuoScreen CarPlay Multi-Screen Dashboard (Clone 100%)

Bản sao mã nguồn hoàn chỉnh 100% chức năng từ [duoscreen.vercel.app](https://duoscreen.vercel.app/) dành cho màn hình ô tô / CarPlay / Android Auto / máy tính bảng hoặc trình duyệt web.

---

## 🚀 Cách khởi chạy ngay lập tức

Dự án đã được thiết lập sẵn sàng, không cần cài đặt thêm thư viện phức tạp.

### Bước 1: Mở terminal tại thư mục dự án
```bash
cd C:\Users\DUPC\.gemini\antigravity-ide\scratch\duoscreen-app
```

### Bước 2: Chạy server
```bash
npm start
# hoặc: node server.js
```

### Bước 3: Mở trình duyệt
Truy cập: **[http://localhost:3333](http://localhost:3333)**

---

## 🛠 Cấu trúc thư mục mã nguồn

```
duoscreen-app/
├── api/                        # Serverless Functions (dùng cho Vercel & API local)
│   ├── yt-search.js            # Tìm kiếm video YouTube (API backend)
│   └── tts.js                  # Proxy Google Text-to-Speech phát giọng nói tiếng Việt
├── assets/                     # Toàn bộ mã nguồn bundle JavaScript & CSS
│   ├── index-B9oCIx6t.js       # Toàn bộ logic Dashboard React, HUD, VTV, Map, Player
│   └── index-cs40xI45.css      # Toàn bộ Style Tailwind, Glassmorphism, Animation
├── original_dist/              # Bản gốc đã trích xuất từ server tác giả
├── public/                     # Thư mục chứa tài nguyên tĩnh
├── server.js                   # Node.js Server tích hợp đầy đủ static server và cả 2 API
├── vercel.json                 # Cấu hình 1-click deploy lên Vercel
├── package.json                # Thông tin dự án và scripts
└── README.md                   # Hướng dẫn chi tiết
```

---

## 🎯 Toàn bộ tính năng hoạt động 100%

### 1. Bảng HUB (Cockpit Đồng hồ & Cảnh báo tốc độ)
- **Đồng hồ đo tốc độ thực tế từ GPS thiết bị**: Hiển thị tốc độ lớn (KM/H), hướng xe (Bắc, Đông, Tây, Nam, độ dốc), tốc độ Max đạt được trong chuyến đi, tổng quãng đường đã đi.
- **Tùy chỉnh bù sai số GPS (GPS Offset)**: Cho phép tinh chỉnh từ `-25 km/h` đến `+25 km/h` để đồng bộ chính xác 100% với contermet trên xe hơi.
- **Mô phỏng xe di chuyển (Animated Car SVG)**: Đồ họa xe thể thao với bánh xe quay theo tốc độ thực, đèn pha bật sáng khi chạy, chuyển màu đỏ khi vượt tốc độ.
- **Cảnh báo khu dân cư & Giới hạn tốc độ tự động**: Kết nối trực tiếp OpenStreetMap Overpass API (`overpass-api.de`) để quét biển báo và ranh giới đô thị xung quanh tọa độ GPS.
- **Âm thanh giọng nói cảnh báo tiếng Việt (TTS)**: Phát âm thanh qua Google Translate TTS proxy tiếng Việt ("Bạn đang vào khu dân cư tốc độ tối đa 50 km/h", "Hết khu dân cư", "Vượt quá tốc độ").
- **Dự báo thời tiết & vị trí hiện tại**: Tích hợp Open-Meteo API theo thời gian thực (nhiệt độ, độ ẩm, sức gió, trạng thái thời tiết).
- **Chủ đề HUD (Themes)**: Carbon Sport, Racing M-Sport, Cyberpunk Neon, Eco Emerald, Classic Amber HUD, Stealth Matte Black.

### 2. Giải trí & Truyền hình (Media & TV)
- **Xem truyền hình VTV Go trực tuyến**: Tích hợp sẵn các kênh truyền hình quốc gia:
  - VTV1 (Thời sự)
  - VTV3 (Giải trí)
  - VTV2 (Khoa giáo)
  - VTV Cần Thơ
  - VTV Go Trang chủ
- **Kho bài hát & YouTube Player**: 
  - Gợi ý sẵn danh mục lái xe: Nhạc GenZ, Tuyển tập TDEEP HOUSE, Remix Lái Xe, Chill Nhẹ Nhàng, Nonstop Bass Cực Mạnh...
  - Tìm kiếm video / ca sĩ / bài hát hoặc dán link YouTube bất kỳ.
  - Hỗ trợ **tìm kiếm bằng giọng nói tiếng Việt** (Web Speech Recognition API).
  - Trình phát video YouTube PiP / nhúng điều khiển mượt mà, hỗ trợ phím Media trên vô lăng (`Next`, `Prev`, `Play/Pause`).
  - Quản lý danh sách phát yêu thích & Lịch sử nghe nhạc (lưu tự động `localStorage`).

### 3. Bản đồ dẫn đường (Map)
- Tích hợp nhúng bản đồ Google Maps tương tác trực tiếp.
- Thanh tìm kiếm địa điểm kết hợp Photon Komoot Geocoding API.
- Các nút truy cập nhanh địa điểm đã lưu.

### 4. Đa nhiệm chia màn hình thông minh (Split-Screen Control)
- **Chế độ xem linh hoạt**: Bảng HUB, Bản đồ Map, Chia đôi (Split), hoặc Toàn màn hình Media.
- **Bố cục Ngang / Dọc**: Phù hợp cả màn hình ngang thông thường và màn hình dọc kiểu Tesla / VinFast.
- **Tỷ lệ phân chia tùy biến**: Các tỷ lệ đặt sẵn `50:50`, `60:40`, `40:60`, `70:30`, `30:70` hoặc kéo thả trực tiếp thanh trượt giữa 2 màn hình.
- **Nút Swap**: Hoán đổi vị trí trái / phải hoặc trên / dưới chỉ với 1 chạm.

---

## ☁️ Hướng dẫn tự Deploy lên Vercel (Miễn phí)

Nếu bạn muốn có một tên miền riêng (ví dụ `my-carplay.vercel.app`) giống như bản gốc:

1. Đăng ký tài khoản tại [vercel.com](https://vercel.com).
2. Tạo một GitHub Repository mới và đẩy toàn bộ thư mục `duoscreen-app` lên GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy duoscreen clone"
   git branch -M main
   git remote add origin <url-repo-cua-ban>
   git push -u origin main
   ```
3. Trên trang Vercel, chọn **Add New** -> **Project** -> Chọn repo vừa tạo.
4. Bấm **Deploy**. Nhờ đã có sẵn `vercel.json` và thư mục `api/`, trang web của bạn sẽ hoạt động 100% ngay lập tức.
