# --- Stage 1: Build (編譯階段) ---
# 使用 Node 18 來進行編譯
FROM node:18-alpine AS build

WORKDIR /app

# 先複製 package.json 安裝依賴 (利用 Docker Cache 加速)
COPY package.json package-lock.json ./
RUN npm install

# 複製所有程式碼
COPY . .

# 開始打包 (這會產生一個 build 資料夾)
RUN npm run build

# --- Stage 2: Production (生產階段) ---
# 使用 Nginx 來伺服網頁
FROM nginx:alpine

# 從 Stage 1 複製編譯好的 build 資料夾到 Nginx 目錄
COPY --from=build /app/build /usr/share/nginx/html

# 複製我們剛寫的 nginx 設定檔
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 Port
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]