# B2 FastAPI Service — Quick Reference

## Directory layout

```
fastapi_service/
├── app.py              # FastAPI routes
├── inference.py        # Model loading + prediction logic
├── requirements.txt
└── models/             # ← put your weight files here
    ├── yolov8n.pt              (YOLOv8n — auto-downloaded if absent)
    └── mobilenetv2_crowd.pth  (your fine-tuned head — falls back to rule-based if absent)
```

## Run locally

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Save MobileNetV2 weights from Colab

Add this cell at the end of your Colab notebook (Section 8):

```python
import os, torch
os.makedirs('models', exist_ok=True)
torch.save(density_classifier.model.state_dict(), 'models/mobilenetv2_crowd.pth')
from google.colab import files
files.download('models/mobilenetv2_crowd.pth')
```

Then place the downloaded file in `fastapi_service/models/`.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Health ping |
| GET | /health | Model-loaded status |
| POST | /predict | Single frame → density + anomalies |
| POST | /predict/batch | Up to 10 frames (stateful anomaly detection) |

## Example cURL

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@frame.jpg" | python3 -m json.tool
```

## Example response

```json
{
  "prediction": "HIGH",
  "confidence": 0.87,
  "extra": {
    "person_count": 14,
    "crowd_density": "HIGH",
    "anomaly_detected": true,
    "anomalies": [
      { "type": "RUNNING", "severity": "MEDIUM", "message": "Running detected (speed=52px/frame)", "frame": 1 }
    ],
    "detections": [
      { "bbox": [120, 80, 200, 310], "conf": 0.87, "center": [160, 195], "area": 14400 }
    ],
    "safety_score": 30,
    "inference_ms": 42.1
  }
}
```
