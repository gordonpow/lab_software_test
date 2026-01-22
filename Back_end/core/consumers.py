import json
import base64
import numpy as np
import cv2
from channels.generic.websocket import AsyncWebsocketConsumer
from ultralytics import YOLO

# Load model here as well (or import from views if possible, but separate load is safer for now to avoid circular imports or thread issues)
model = YOLO('yolov8n.pt')

class VideoConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if 'image' not in data:
                return

            img_bytes = base64.b64decode(data['image'].split(',')[1])
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            # Execution
            results = model(frame, verbose=False)

            detections = []
            for r in results:
                for box in r.boxes:
                    detections.append({
                        "box": box.xyxy[0].tolist(),
                        "label": model.names[int(box.cls[0])],
                        "conf": float(box.conf[0])
                    })

            # --- Debug ---
            if len(detections) > 0:
                print(f"✅ Detection success: found {len(detections)} objects")

            await self.send(text_data=json.dumps({
                "detections": detections,
                "all_counts": {model.names[int(c)]: (results[0].boxes.cls == c).sum().item() for c in results[0].boxes.cls.unique()} if len(results[0].boxes) > 0 else {}
            }))
        except Exception as e:
            print(f"Error in VideoConsumer: {e}")