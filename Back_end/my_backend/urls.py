from django.contrib import admin
from django.urls import path
# 修正匯入名稱：將 update_config 改為 set_mode
from core.views import set_mode, get_count, upload_video, get_history, delete_history, index , get_yolo_labels, register, login_view, logout_view, delete_account, profile_view
from django.conf import settings
from django.conf.urls.static import static
urlpatterns = [
    path('', index, name='home'),
    path('admin/', admin.site.urls),
    # path('video/', video_feed, name='video_feed'),
    # 這裡也要對應修改
    path('set_mode/', set_mode, name='set_mode'), 
    path('get_count/', get_count, name='get_count'),             
    path('upload/', upload_video, name='upload_video'),
    path('history/', get_history, name='get_history'),
    path('labels/', get_yolo_labels, name='get_yolo_labels'),
    path('delete/<int:record_id>/', delete_history, name='delete_history'),
    path('register/', register, name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('delete_account/', delete_account, name='delete_account'),
    path('profile/', profile_view, name='profile'),
    
]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)