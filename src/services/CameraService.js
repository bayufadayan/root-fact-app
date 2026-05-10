export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = {
      fps: 30,
      facingMode: 'environment'
    };
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error('MediaDevices API tidak didukung.');
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput');
  }

  async startCamera(cameraType = 'default') {
    this.stopCamera();
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: cameraType === 'front' ? 'user' : 'environment'
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.video) {
        this.video.srcObject = this.stream;
        return new Promise((resolve) => {
          this.video.onloadedmetadata = () => {
            this.video.play();
            resolve(true);
          };
        });
      }
    } catch (error) {
      throw error;
    }
  }

  // Fungsi baru untuk menangkap frame agar AI lebih stabil
  captureFrame() {
    if (!this.video || !this.canvas || this.video.paused) return null;
    const context = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas;
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  setFPS(fps) { this.config.fps = Number(fps); }
  getFPS() { return this.config.fps; }
  isActive() { return !!this.stream && this.stream.active; }
}