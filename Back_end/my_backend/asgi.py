import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path
from core.consumers import VideoConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'my_backend.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter([
        # 這裡的路徑必須跟前端 WebSocket 連線網址完全一致
        path("ws/video/", VideoConsumer.as_asgi()), 
    ]),
})