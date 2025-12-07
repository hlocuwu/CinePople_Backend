# 🎬 Ciné Booking Backend API

Đây là hệ thống Backend cho ứng dụng đặt vé xem phim (Ciné Booking App), cung cấp toàn bộ API xử lý nghiệp vụ từ quản lý phim, rạp, suất chiếu đến quy trình đặt vé thời gian thực và thanh toán.

## 📋 Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt & Cấu hình (Localhost)](#cài-đặt--cấu-hình-localhost)
- [Biến môi trường (.env)](#biến-môi-trường-env)
- [Hướng dẫn chạy Server](#hướng-dẫn-chạy-server)
- [Tài liệu API (Swagger)](#tài-liệu-api-swagger)
- [Quy trình Test (Postman)](#quy-trình-test-postman)
- [Deploy (Docker & Kubernetes)](#deploy-docker--kubernetes)

## 🛠 Công nghệ sử dụng

- **Core**: Node.js, Express, TypeScript
- **Database**: Google Firestore (NoSQL) - Realtime Database
- **Auth**: Firebase Authentication (Verify ID Token)
- **Payment**: Tích hợp ZaloPay Sandbox, MoMo Sandbox & Simulator
- **Validation**: class-validator, class-transformer
- **DevOps**: Docker, Helm, Azure Kubernetes Service (AKS), GitHub Actions

## 💻 Yêu cầu hệ thống

- **Node.js**: v16 trở lên
- **npm** hoặc **yarn**
- **Tài khoản Firebase**:
  - Cần file `serviceAccountKey.json` (thông tin Admin SDK) để kết nối Database
  - Bật Authentication (Email/Password & Google)
  - Tạo Firestore Database

## ⚙️ Cài đặt & Cấu hình (Localhost)

### 1. Clone dự án

```bash
git clone https://github.com/hlocuwu/CinePople_Backend.git
cd cine-backend
```

### 2. Cài đặt thư viện

```bash
npm install
```

### 3. Cấu hình biến môi trường (.env)

Tạo file `.env` tại thư mục gốc. Copy nội dung dưới đây và điền thông tin thật của bạn:

```env
# --- Server Config ---
PORT=5000
NODE_ENV=development
# Thay bằng IP Public của bạn nếu deploy, local thì để localhost
SERVER_URL=http://localhost:5000

# --- Firebase Admin SDK Config ---
# Lấy các thông tin này trong Firebase Console -> Project Settings -> Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

#QUAN TRỌNG: Private Key phải để trong dấu ngoặc kép.
# Thay các dấu xuống dòng trong file JSON gốc bằng \n
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggOjAgEAAoIBAQD...\n-----END PRIVATE KEY-----\n"

## 🚀 Hướng dẫn chạy Server

### Chạy môi trường Development (Khuyên dùng)

Server sẽ tự động restart khi sửa code.

```bash
npm run dev
```

Terminal báo: `Server is running on port 3000` là thành công.

### Build & Chạy Production

```bash
npm run build
npm start
```

## 📖 Tài liệu API (Swagger)

Dự án tích hợp sẵn Swagger UI. Sau khi chạy server, truy cập:

👉 **http://localhost:5000/api-docs**

### Cách Authorize (Đăng nhập) trên Swagger

Hầu hết API đều yêu cầu Token. Do dùng Firebase, bạn không thể đăng nhập trực tiếp trên Swagger mà cần:

1. Lấy `idToken` từ Postman hoặc App Client
2. Bấm nút 🔓 **Authorize** trên Swagger
3. Nhập: `Bearer <idToken_cua_ban>`

## 🧪 Quy trình Test API

### Bước 1: Lấy Firebase ID Token

Sử dụng **Postman** hoặc **curl** để gọi API Firebase Authentication:

#### Với Postman:
- **Method**: `POST`
- **URL**: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=[YOUR_WEB_API_KEY]`
- **Body** (JSON):
  ```json
  {
    "email": "admin@test.com",
    "password": "your-password",
    "returnSecureToken": true
  }
  ```

#### Với curl:
```bash
curl -X POST \
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=[YOUR_WEB_API_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@test.com",
    "password": "your-password",
    "returnSecureToken": true
  }'
```

Copy chuỗi `idToken` từ response.

### Bước 2: Test API trên Swagger UI

1. Truy cập: **http://localhost:5000/api-docs**
2. Bấm nút 🔓 **Authorize** ở góc trên bên phải
3. Nhập: `Bearer <idToken_vua_lay_duoc>`
4. Bấm **Authorize** và đóng popup

### Bước 3: Thực hiện các API Test

Giờ bạn có thể test toàn bộ API trực tiếp trên Swagger:

## 🐳 Deploy (Docker & Kubernetes)

### 1. Build Docker Image

```bash
docker build -t <your-acr>.azurecr.io/cine-backend:latest .
docker push <your-acr>.azurecr.io/cine-backend:latest
```

### 2. Deploy với Helm Chart


```bash
helm upgrade --install cine-release ./infra/helm/cine-chart
```

---