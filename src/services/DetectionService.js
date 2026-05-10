import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import * as mobilenet from '@tensorflow-models/mobilenet';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.modelType = 'unknown';
  }

  async loadModel() {
    try {
      // Backend adaptive: prefer WebGPU, fallback WebGL.
      if (navigator.gpu) {
        await tf.setBackend('webgpu');
      } else {
        await tf.setBackend('webgl');
      }
      await tf.ready();

      const localModelURL = '/model/model.json';
      const metadataURL = '/model/metadata.json';

      try {
        // First, try Teachable Machine local model if available.
        const [loadedModel, metadataResponse] = await Promise.all([
          tf.loadLayersModel(localModelURL),
          fetch(metadataURL).then((res) => {
            if (!res.ok) {
              throw new Error('Metadata model lokal tidak ditemukan.');
            }
            return res.json();
          })
        ]);

        this.model = loadedModel;
        this.labels = metadataResponse.labels || [];
        this.modelType = 'local';
      } catch (localError) {
        console.warn('Model lokal tidak valid/tersedia. Fallback ke MobileNet.', localError);
        this.model = await mobilenet.load({
          version: 2,
          alpha: 1.0
        });
        this.labels = [];
        this.modelType = 'mobilenet';
      }

      return { success: true, backend: tf.getBackend() };
    } catch (error) {
      console.error('Gagal memuat model:', error);
      throw error;
    }
  }

  async predict(imageElement) {
    if (!this.model) throw new Error('Model belum siap.');

    if (this.modelType === 'mobilenet') {
      const predictions = await this.model.classify(imageElement, 1);
      if (!predictions.length) {
        return {
          isValid: false,
          className: 'Tidak terdeteksi',
          score: 0,
          confidence: 0
        };
      }

      const top = predictions[0];
      const confidence = Math.round(top.probability * 100);
      return {
        isValid: confidence >= 70,
        className: top.className,
        score: top.probability,
        confidence
      };
    }

    const result = tf.tidy(() => {
      const tensor = tf.browser.fromPixels(imageElement)
        .resizeBilinear([224, 224])
        .toFloat()
        .div(tf.scalar(255))
        .expandDims(0);

      const prediction = this.model.predict(tensor);
      return prediction.dataSync();
    });

    const maxProbability = Math.max(...result);
    const maxIndex = Array.from(result).indexOf(maxProbability);
    const confidence = Math.round(maxProbability * 100);

    return {
      isValid: confidence >= 70, // Threshold dari config
      className: this.labels[maxIndex],
      score: maxProbability,
      confidence: confidence
    };
  }

  isLoaded() { return !!this.model; }
}