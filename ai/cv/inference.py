"""
inference.py
------------
Production inference logic for the Women's Safety Smart City CV pipeline.
Loads YOLOv8n (person detection) + MobileNetV2 (crowd density classification)
and runs the AnomalyDetector on a single image/frame.

Usage:
    from inference import CrowdAnalysisPipeline
    pipeline = CrowdAnalysisPipeline()
    result   = pipeline.predict(image_bytes)
"""

import io
import time
import logging
from collections import defaultdict, deque
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from ultralytics import YOLO

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
DENSITY_CLASSES    = ["EMPTY", "LOW", "MEDIUM", "HIGH"]
DENSITY_THRESHOLDS = [0, 2, 6, 16]          # person-count → class boundaries
MODELS_DIR         = Path("models")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Inference device: {DEVICE}")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Person Detector (YOLOv8n)
# ─────────────────────────────────────────────────────────────────────────────

class PersonDetector:
    """
    Wraps YOLOv8n to detect only the 'person' class (COCO class 0).

    Model loading priority:
        1. models/yolov8n.pt  (your saved weights)
        2. 'yolov8n.pt'       (ultralytics auto-download fallback)
    """

    CONF_THRESHOLD = 0.40
    IOU_THRESHOLD  = 0.45

    def __init__(self):
        local_weights = MODELS_DIR / "yolov8n.pt"
        weight_path   = str(local_weights) if local_weights.exists() else "yolov8n.pt"
        logger.info(f"Loading YOLOv8n from: {weight_path}")
        self.model = YOLO(weight_path)
        self.model.to(DEVICE)
        self._inference_times: list[float] = []

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Args:
            frame: BGR uint8 array  (H × W × 3)
        Returns:
            list of {bbox, conf, center, area}
        """
        t0 = time.perf_counter()
        results = self.model(
            frame,
            conf=self.CONF_THRESHOLD,
            iou=self.IOU_THRESHOLD,
            classes=[0],
            verbose=False,
        )
        self._inference_times.append(time.perf_counter() - t0)

        detections = []
        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                conf = float(box.conf[0].cpu().numpy())
                detections.append({
                    "bbox":   (x1, y1, x2, y2),
                    "conf":   round(conf, 4),
                    "center": ((x1 + x2) // 2, (y1 + y2) // 2),
                    "area":   (x2 - x1) * (y2 - y1),
                })
        return detections

    @property
    def avg_fps(self) -> float:
        if not self._inference_times:
            return 0.0
        return 1.0 / float(np.mean(self._inference_times[-50:]))


# ─────────────────────────────────────────────────────────────────────────────
# 2. Crowd Density Classifier (MobileNetV2 Transfer Learning)
# ─────────────────────────────────────────────────────────────────────────────

def _build_mobilenetv2(num_classes: int = 4) -> nn.Module:
    """
    Builds the MobileNetV2 architecture with the custom 4-class head.
    Must match the architecture used during training exactly so that
    saved weights load without shape errors.
    """
    base = models.mobilenet_v2(weights=None)
    base.classifier = nn.Sequential(
        nn.Dropout(0.2),
        nn.Linear(base.last_channel, 256),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(256, num_classes),
    )
    return base


class CrowdDensityClassifier:
    """
    Loads a fine-tuned MobileNetV2 from models/mobilenetv2_crowd.pth.
    Falls back to rule-based count classification if the weight file is absent.
    """

    _TRANSFORM = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                             std=[0.229, 0.224, 0.225]),
    ])

    def __init__(self):
        weight_path = MODELS_DIR / "mobilenetv2_crowd.pth"
        self._use_model = weight_path.exists()

        if self._use_model:
            logger.info(f"Loading MobileNetV2 weights from: {weight_path}")
            self._model = _build_mobilenetv2(num_classes=len(DENSITY_CLASSES))
            state = torch.load(weight_path, map_location=DEVICE)
            # Support both raw state-dict and checkpoint dicts
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            self._model.load_state_dict(state)
            self._model.to(DEVICE).eval()
            logger.info("MobileNetV2 classifier loaded ✓")
        else:
            logger.warning(
                f"Weight file not found at {weight_path}. "
                "Falling back to rule-based density classification."
            )
            self._model = None

    # ── public ────────────────────────────────────────────────────────────────

    def classify(self, frame_bgr: np.ndarray, person_count: int) -> tuple[str, float]:
        """
        Returns:
            (density_label, confidence)   e.g. ("HIGH", 0.87)
        """
        if not self._use_model or self._model is None:
            return self._rule_based(person_count), 1.0

        try:
            img    = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
            tensor = self._TRANSFORM(img).unsqueeze(0).to(DEVICE)

            with torch.no_grad():
                probs = torch.softmax(self._model(tensor), dim=1).cpu().numpy()[0]

            idx  = int(np.argmax(probs))
            conf = float(probs[idx])

            # Blend: fall back to count-rule when model is uncertain
            return (DENSITY_CLASSES[idx], conf) if conf >= 0.50 \
                   else (self._rule_based(person_count), conf)
        except Exception as exc:
            logger.warning(f"Classifier error: {exc}. Using rule-based fallback.")
            return self._rule_based(person_count), 1.0

    @staticmethod
    def _rule_based(count: int) -> str:
        if count <= 1:   return "EMPTY"
        if count <= 5:   return "LOW"
        if count <= 15:  return "MEDIUM"
        return "HIGH"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Anomaly Detector (stateful, reset per-request for single-image inference)
# ─────────────────────────────────────────────────────────────────────────────

class AnomalyDetector:
    """
    Tracks person centres across frames to detect movement anomalies.
    For single-image prediction the detector is stateless (no prior history),
    so only proximity-based checks (FIGHTING) are active per frame.
    Supply a persistent instance for video/stream use.
    """

    RUNNING_SPEED   = 45
    FIGHTING_DIST   = 80
    FIGHT_MIN_SPEED = 30
    LOITER_FRAMES   = 60
    LOITER_RADIUS   = 15
    SCATTER_SPEED   = 35
    HISTORY_LEN     = 90

    def __init__(self):
        self.tracks       = defaultdict(lambda: deque(maxlen=self.HISTORY_LEN))
        self.frame_count  = 0
        self.prev_centers: list = []
        self.anomaly_log:  list = []

    def reset(self):
        self.__init__()

    def update(self, detections: list[dict]) -> list[dict]:
        self.frame_count += 1
        centers    = [d["center"] for d in detections]
        anomalies  = []
        active_ids = [self._nearest_track(c) for c in centers]

        for tid, center in zip(active_ids, centers):
            self.tracks[tid].append(center)

        # Running
        for tid in active_ids:
            hist = self.tracks[tid]
            if len(hist) >= 2:
                dx = hist[-1][0] - hist[-2][0]
                dy = hist[-1][1] - hist[-2][1]
                speed = float(np.sqrt(dx**2 + dy**2))
                if speed > self.RUNNING_SPEED:
                    anomalies.append({
                        "type":     "RUNNING",
                        "severity": "MEDIUM",
                        "track_id": tid,
                        "speed":    round(speed, 1),
                        "message":  f"Running detected (speed={speed:.0f}px/frame)",
                    })

        # Fighting
        if len(centers) >= 2:
            for i in range(len(centers)):
                for j in range(i + 1, len(centers)):
                    dist = float(np.sqrt(
                        (centers[i][0] - centers[j][0]) ** 2 +
                        (centers[i][1] - centers[j][1]) ** 2
                    ))
                    if dist < self.FIGHTING_DIST:
                        ti, tj = active_ids[i], active_ids[j]
                        hi, hj = self.tracks[ti], self.tracks[tj]
                        if len(hi) >= 2 and len(hj) >= 2:
                            si = float(np.sqrt((hi[-1][0]-hi[-2][0])**2 + (hi[-1][1]-hi[-2][1])**2))
                            sj = float(np.sqrt((hj[-1][0]-hj[-2][0])**2 + (hj[-1][1]-hj[-2][1])**2))
                            if si > self.FIGHT_MIN_SPEED and sj > self.FIGHT_MIN_SPEED:
                                anomalies.append({
                                    "type":      "FIGHTING",
                                    "severity":  "HIGH",
                                    "track_ids": (ti, tj),
                                    "distance":  round(dist, 1),
                                    "message":   f"Possible fight (dist={dist:.0f}px)",
                                })

        # Loitering
        for tid in active_ids:
            hist = self.tracks[tid]
            if len(hist) >= self.LOITER_FRAMES:
                recent = list(hist)[-self.LOITER_FRAMES:]
                xs = [c[0] for c in recent]
                ys = [c[1] for c in recent]
                spread = float(np.sqrt(np.var(xs) + np.var(ys)))
                if spread < self.LOITER_RADIUS:
                    anomalies.append({
                        "type":     "LOITERING",
                        "severity": "MEDIUM",
                        "track_id": tid,
                        "spread":   round(spread, 2),
                        "message":  f"Loitering detected (stationary {self.LOITER_FRAMES} frames)",
                    })

        # Sudden scatter
        if self.prev_centers and centers:
            if len(centers) >= 3 and len(self.prev_centers) >= 3:
                prev_c = np.array(self.prev_centers)
                curr_c = np.array(centers)
                prev_dists = np.sqrt(((prev_c - prev_c.mean(axis=0)) ** 2).sum(axis=1))
                curr_dists = np.sqrt(((curr_c - curr_c.mean(axis=0)) ** 2).sum(axis=1))
                scatter = float(curr_dists.mean()) - float(prev_dists.mean())
                if scatter > self.SCATTER_SPEED:
                    anomalies.append({
                        "type":     "SUDDEN_SCATTER",
                        "severity": "HIGH",
                        "scatter":  round(scatter, 1),
                        "message":  f"Sudden crowd scatter (Δ={scatter:.0f}px)",
                    })

        self.prev_centers = centers
        for a in anomalies:
            a["frame"] = self.frame_count
            self.anomaly_log.append(a)

        return anomalies

    def _nearest_track(self, center, threshold: int = 60) -> int:
        best_id, best_dist = None, threshold
        cx, cy = center
        for tid, hist in self.tracks.items():
            if not hist:
                continue
            lx, ly = hist[-1]
            d = float(np.sqrt((cx - lx) ** 2 + (cy - ly) ** 2))
            if d < best_dist:
                best_dist, best_id = d, tid
        if best_id is None:
            best_id = max(self.tracks.keys(), default=-1) + 1
        return best_id


# ─────────────────────────────────────────────────────────────────────────────
# 4. Unified Pipeline
# ─────────────────────────────────────────────────────────────────────────────

class CrowdAnalysisPipeline:
    """
    Single entry-point for the FastAPI service.

    For single-image (stateless) requests:
        result = pipeline.predict(image_bytes)

    For video/stream (stateful) requests, reuse the same pipeline instance
    and call predict() per frame — the AnomalyDetector accumulates history.
    Call pipeline.reset() between unrelated sessions.
    """

    def __init__(self):
        logger.info("Initialising CrowdAnalysisPipeline …")
        self.detector   = PersonDetector()
        self.classifier = CrowdDensityClassifier()
        self.anomaly    = AnomalyDetector()
        logger.info("Pipeline ready ✓")

    def reset(self):
        """Reset stateful components between independent video sessions."""
        self.anomaly.reset()

    def predict(self, image_bytes: bytes) -> dict:
        """
        Args:
            image_bytes: raw bytes from an uploaded image file

        Returns:
            {
              "prediction":  "HIGH",
              "confidence":  0.87,
              "extra": {
                "person_count":    14,
                "crowd_density":   "HIGH",
                "anomaly_detected": true,
                "anomalies":       [ {type, severity, message, …} ],
                "detections":      [ {bbox, conf, center, area}, … ],
                "safety_score":    30,
                "inference_ms":    42.1
              }
            }
        """
        t0 = time.perf_counter()

        # ── Decode ──────────────────────────────────────────────────────────
        frame = self._decode(image_bytes)

        # ── Detect ──────────────────────────────────────────────────────────
        detections = self.detector.detect(frame)
        person_count = len(detections)

        # ── Classify density ────────────────────────────────────────────────
        density, conf = self.classifier.classify(frame, person_count)

        # ── Detect anomalies ────────────────────────────────────────────────
        anomalies = self.anomaly.update(detections)
        anomaly_detected = len(anomalies) > 0

        # ── Safety score ────────────────────────────────────────────────────
        safety_score = self._compute_safety(density, anomalies)

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            "prediction": density,
            "confidence": round(conf, 4),
            "extra": {
                "person_count":     person_count,
                "crowd_density":    density,
                "anomaly_detected": anomaly_detected,
                "anomalies":        anomalies,
                "detections":       detections,
                "safety_score":     safety_score,
                "inference_ms":     elapsed_ms,
            },
        }

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _decode(image_bytes: bytes) -> np.ndarray:
        """Decode raw bytes → BGR numpy array."""
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            # Fallback via PIL for edge-case formats (HEIC, TIFF …)
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            frame   = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        return frame

    @staticmethod
    def _compute_safety(density: str, anomalies: list[dict]) -> int:
        base    = {"EMPTY": 95, "LOW": 80, "MEDIUM": 55, "HIGH": 30}
        penalty = {"HIGH": 20, "MEDIUM": 10, "LOW": 5}
        score   = base.get(density, 70)
        for a in anomalies:
            score -= penalty.get(a.get("severity", "LOW"), 5)
        return max(0, min(100, score))
