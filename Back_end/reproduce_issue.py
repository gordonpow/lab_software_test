
import os
import django
from django.test import RequestFactory, Client
from django.core.files.uploadedfile import SimpleUploadedFile

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "my_backend.settings")
django.setup()

from core.views import upload_video

def test_upload():
    client = Client()
    # Create a dummy video file
    video_content = b"fake video content"
    video = SimpleUploadedFile("test_video.mp4", video_content, content_type="video/mp4")
    
    print("Attempting upload...")
    response = client.post('/upload/', {'video': video})
    
    print(f"Status Code: {response.status_code}")
    print(f"Content: {response.content.decode('utf-8')}")

if __name__ == "__main__":
    test_upload()
