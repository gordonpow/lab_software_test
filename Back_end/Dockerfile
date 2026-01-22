# 1. 使用 Python 3.10 Slim 版本 (輕量化)
FROM python:3.10-slim

# 2. 設定容器內的工作目錄
WORKDIR /app

# 3. 安裝系統依賴 (OpenCV 必須)
# libgl1-mesa-glx 和 libglib2.0-0 是 cv2 跑起來的關鍵
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 4. 複製 requirements.txt 並安裝 Python 套件
# (確保你已經在 Back_end 資料夾執行過 pip freeze > requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 複製專案所有程式碼
COPY . .

# 6. 暴露 Django 預設 Port
EXPOSE 8000

# 7. 啟動指令 (使用 Daphne 支援 WebSocket)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]