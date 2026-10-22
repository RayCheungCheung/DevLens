# DevLens

<p align="center">
  <img src="../assets/lensy.svg" alt="Lensy" width="260" />
</p>

DevLens là trình duyệt dành cho lập trình viên, tập trung vào workflow.

Nó hiển thị cùng một URL đồng thời trong khung mobile và desktop, kèm console/network trực tiếp, HTTP interceptor và repeater, chỉnh sửa thiết kế trực tiếp, báo cáo reconnaissance, trợ lý AI và chuyển ngay sang editor.

## Tính năng chính

- Theme workspace đậm chất nhập vai trên tab strip, navigation bar và sidebar.
- Xem trước hai viewport với đồng bộ cuộn trang.
- Tab Groups hỗ trợ tên, màu, kéo thả, menu chuột phải và thu gọn.
- Split View hiển thị hai tab hiện có mà không tải lại trang.
- Bảo vệ WImH với content protection và overlay cảnh báo.
- DevTools tích hợp: Elements, Console, Network và Application.
- Omnibox thông minh với lịch sử, dấu trang, traffic và gợi ý hoàn thành.
- Cách ly workspace và profile bằng Electron partition riêng biệt.

## Công nghệ sử dụng

- Electron 44
- Vite 7
- React 19
- TypeScript (strict)
- Tailwind CSS 4

## Bắt đầu

Chạy các lệnh sau từ thư mục `outputs/devlens`:

| Lệnh | Mô tả |
| --- | --- |
| `npm install` | Cài dependencies |
| `npm run dev` | Chạy Vite và Electron với HMR |
| `npm run build` | Kiểm tra type rồi build out/ |
| `npm run start` | Chạy ứng dụng đã build |
| `npm run typecheck` | Chạy tsc --noEmit |

## Phím tắt

| Hành động | Phím tắt |
| --- | --- |
| Tab mới | `Ctrl+T` |
| Đóng tab | `Ctrl+W` |
| Tải lại trang | `Ctrl+R` |
| Tìm trong trang | `Ctrl+F` |
| Mở Settings | `Ctrl+,` |
| Tab riêng tư mới | `Ctrl+Shift+P` |
| Shell DevTools | `F12` |
| Panel Elements | `Ctrl+Shift+I` |
| Panel Console | `Ctrl+Shift+J` |
| Panel Network | `Ctrl+Shift+E` |
| Sidebar | `Ctrl+Shift+B` |
| Chế độ Ghost | `Ctrl+Shift+G` |
| Bảo vệ WImH | `Ctrl+Shift+H` |
| Tab gần nhất | `Ctrl+Tab` |

## Giấy phép

Dự án được phát hành theo [MIT License](../../LICENSE).

## Đóng góp

Chào đón issue và pull request. Hãy chạy `npm run typecheck` trước khi gửi thay đổi.

