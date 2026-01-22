import os
import json
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import FileSystemStorage
from django.shortcuts import render
from django.conf import settings
from ultralytics import YOLO
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout

# 載入模型 (這裡僅用於獲取標籤清單，影像辨識已移至 consumers.py)
model = YOLO('yolov8n.pt')

# 全域狀態 (簡化版，因為影像串流狀態已移至 WebSocket)
state = {
    "history": []
}

# --- 核心功能：自動掃描 media 資料夾 ---
def sync_media_files():
    """掃描 media 資料夾，將未記錄的檔案自動加入 history"""
    media_root = settings.MEDIA_ROOT
    
    # 如果 media 資料夾不存在，就建立它
    if not os.path.exists(media_root):
        os.makedirs(media_root)
        # return  <-- 移除此行，讓建立資料夾後也能繼續往下執行 (雖然空資料夾不會掃到東西，但邏輯較一致)

    # 取得目前歷史紀錄中已有的檔名
    known_files = {item['name'] for item in state['history']}
    
    # 掃描磁碟上的檔案
    try:
        disk_files = os.listdir(media_root)
    except FileNotFoundError:
        return
    
    for filename in disk_files:
        # 過濾掉非影片/圖片檔案
        if not filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.jpg', '.png')):
            continue

        # 如果檔案在磁碟上但不在歷史紀錄中 -> 加入
        if filename not in known_files:
            file_path = os.path.join(media_root, filename)
            try:
                # 取得檔案最後修改時間
                timestamp = os.path.getmtime(file_path)
                time_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")
                
                # 生成新 ID
                new_id = len(state['history']) + 1
                while any(h['id'] == new_id for h in state['history']):
                    new_id += 1

                state['history'].append({
                    "id": new_id,
                    "name": filename,
                    "time": time_str
                })
                print(f"🔄 [Auto Sync] 發現並載入檔案: {filename}")
            except Exception as e:
                print(f"⚠️ 無法讀取檔案資訊 {filename}: {e}")

# --- API: 獲取歷史紀錄 ---
def get_history(request):
    # 每次前端請求歷史紀錄時，先執行同步
    sync_media_files()
    
    # 按照時間倒序排列 (新的在上面)
    sorted_history = sorted(state["history"], key=lambda x: x['time'], reverse=True)
    return JsonResponse({"history": sorted_history})

# --- API: 上傳影片 ---
@csrf_exempt
def upload_video(request):
    if request.method == 'POST':
        if not request.FILES.get('video'):
            return JsonResponse({"status": "fail", "message": "No file selected"}, status=400)
            
        try:
            video_file = request.FILES['video']
            fs = FileSystemStorage()
            # 儲存檔案
            filename = fs.save(video_file.name, video_file)
            
            # 雖然 get_history 會自動同步，但為了即時回傳給前端，這裡也手動加一下
            new_record = {
                "id": len(state["history"]) + 1,
                "name": filename,
                "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            state["history"].append(new_record)
            
            return JsonResponse({"status": "success", "record": new_record})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
    return JsonResponse({"status": "fail"}, status=400)

# --- API: 刪除紀錄與檔案 ---
@csrf_exempt
def delete_history(request, record_id):
    # 1. 找到要刪除的目標
    target = next((item for item in state["history"] if item["id"] == record_id), None)
    
    if target:
        # 2. 嘗試刪除實體檔案 (重要！否則同步時又會跑出來)
        file_path = os.path.join(settings.MEDIA_ROOT, target['name'])
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"🗑️ 已刪除實體檔案: {target['name']}")
            except Exception as e:
                print(f"⚠️ 刪除實體檔案失敗: {e}")

        # 3. 更新記憶體中的 list
        state["history"] = [r for r in state["history"] if r['id'] != record_id]
        
    return JsonResponse({"status": "success"})

# --- API: 獲取模型標籤 (下拉選單用) ---
def get_yolo_labels(request):
    """回傳 YOLO 模型支援的所有標籤名稱"""
    return JsonResponse({"labels": list(model.names.values())})

# --- API: 設定模式 (保留接口以防前端呼叫，但主要邏輯在 WebSocket) ---
@csrf_exempt
def set_mode(request):
    return JsonResponse({"status": "success", "message": "Mode handled by WebSocket"})

# --- API: 獲取計數 (保留接口以防舊版前端呼叫) ---
def get_count(request):
    return JsonResponse({"status": "deprecated", "message": "Use WebSocket for real-time data"})

# --- 首頁渲染 (若使用 Django Template) ---
def index(request):
    return render(request, 'index.html')

# --- API: 註冊 ---
@csrf_exempt
def register(request):
    if request.method == 'GET':
        return render(request, 'register.html')
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            email = data.get('email', '')

            if not username or not password:
                return JsonResponse({"status": "fail", "message": "Username and password are required"}, status=400)

            if User.objects.filter(username=username).exists():
                return JsonResponse({"status": "fail", "message": "Username already exists"}, status=400)

            user = User.objects.create_user(username=username, password=password, email=email)
            return JsonResponse({"status": "success", "message": "User registered successfully"})
        except json.JSONDecodeError:
            return JsonResponse({"status": "fail", "message": "Invalid JSON"}, status=400)
    return JsonResponse({"status": "fail", "message": "Method not allowed"}, status=405)


# --- API: 登入 ---
@csrf_exempt
def login_view(request):
    if request.method == 'GET':
        return render(request, 'login.html')
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')

            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                # 登入成功後，立刻同步一次 media 檔案，確保歷史紀錄是最新的
                sync_media_files()
                return JsonResponse({"status": "success", "message": "Login successful"})
            else:
                return JsonResponse({"status": "fail", "message": "Invalid credentials"}, status=401)
        except json.JSONDecodeError:
            return JsonResponse({"status": "fail", "message": "Invalid JSON"}, status=400)
    return JsonResponse({"status": "fail", "message": "Method not allowed"}, status=405)

# --- API: 刪除帳號 ---
@csrf_exempt
def delete_account(request):
    if request.method == 'DELETE':
        if not request.user.is_authenticated:
             return JsonResponse({"status": "fail", "message": "Not authenticated"}, status=401)
        
        try:
            request.user.delete()
            return JsonResponse({"status": "success", "message": "Account deleted successfully"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)
            
    return JsonResponse({"status": "fail", "message": "Method not allowed"}, status=405)

# --- API: 登出 ---
@csrf_exempt
def logout_view(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({"status": "success", "message": "Logout successful"})
    return JsonResponse({"status": "fail", "message": "Method not allowed"}, status=405)


# --- API: 個人資料設定 ---
@csrf_exempt
def profile_view(request):
    if not request.user.is_authenticated:
        # 如果是 GET 請求但沒登入，導回登入頁（或回傳 401，視需求而定，這邊為了體驗直接導回登入頁較好）
        if request.method == 'GET':
             return render(request, 'login.html')
        return JsonResponse({"status": "fail", "message": "Not authenticated"}, status=401)

    if request.method == 'GET':
        # return render(request, 'profile.html', {'user': request.user})
        # 修改為回傳 JSON 供 React 前端使用
        return JsonResponse({
            "status": "success",
            "data": {
                "username": request.user.username,
                "email": request.user.email
            }
        })

    if request.method == 'PUT':
        try:
            data = json.loads(request.body)
            new_username = data.get('username')
            new_email = data.get('email')
            new_password = data.get('password')

            user = request.user
            
            # Simple validation: Check if username exists if it's being changed
            if new_username and new_username != user.username:
                if User.objects.filter(username=new_username).exists():
                     return JsonResponse({"status": "fail", "message": "Username already taken"}, status=400)
                user.username = new_username

            if new_email is not None:
                user.email = new_email

            if new_password:
                user.set_password(new_password)

            user.save()

            # If password changed, update session hash to keep user logged in
            if new_password:
                login(request, user)

            return JsonResponse({"status": "success", "message": "Profile updated successfully"})
        except json.JSONDecodeError:
            return JsonResponse({"status": "fail", "message": "Invalid JSON"}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)

    return JsonResponse({"status": "fail", "message": "Method not allowed"}, status=405)


