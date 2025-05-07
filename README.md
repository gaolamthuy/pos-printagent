# 🖨️ GLT POS Print Agent

Tác vụ in hóa đơn / tem nhãn cho hệ thống POS, sử dụng ExpressJS + Puppeteer + pdf-to-printer.

## 🚀 Cài đặt nhanh

```bash
git clone https://github.com/yourname/glt-nodejs-printagent
cd glt-nodejs-printagent
npm install
```

## ⚙️ Cấu hình

- `.env` file:
- `config.json`: cấu hình máy in và định dạng (đã có sẵn)

## ▶️ Chạy app

```bash
npm start
```

Chọn:

1. Start server để nhận job in.
2. Test print hóa đơn.
3. Test print nhãn.

## 📂 Logs

Tự động ghi log mỗi ngày tại thư mục `logs/`. Log cũ hơn 7 ngày sẽ tự xoá.

## 🛠️ Phụ thuộc

- Chrome / Chromium (cấu hình đường dẫn trong `config.json`)
- Máy in cài trên Windows (kiểm tra tên đúng)

## ℹ️ Payload ví dụ gửi đến `/print`:

```json
{
  "print_agent_id": "id_abc",
  "doc_type": "invoice",
  "doc_ref": {
    "code": "HD057559"
  }
}
```

```json
{
  "print_agent_id": "id_abc",
  "doc_type": "label",
  "doc_ref": {
    "code": "2021101",
    "quantity": 2,
    "copies": 3
  }
}
```
