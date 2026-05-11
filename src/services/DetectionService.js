import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.modelType = 'custom';
  }

  async loadModel() {
    try {
      const isDev = import.meta.env.DEV;
      let preferredBackend = 'webgl';

      if (navigator.gpu) {
        preferredBackend = 'webgpu';
      }

      try {
        await tf.setBackend(preferredBackend);
      } catch (error) {
        console.warn(`Gagal memakai backend ${preferredBackend}, fallback ke webgl.`, error);
        await tf.setBackend('webgl');
      }

      await tf.ready();

      const modelVersion = import.meta.env.VITE_MODEL_VERSION || '1';
      const cacheSuffix = isDev ? `?v=${Date.now()}` : `?v=${modelVersion}`;
      const metadataUrl = `/model/metadata.json${cacheSuffix}`;
      const modelUrl = `/model/model.json${cacheSuffix}`;
      const requestInit = isDev ? { cache: 'no-store' } : undefined;

      const [metadata, model] = await Promise.all([
        fetch(metadataUrl, { cache: isDev ? 'no-store' : 'default' }).then((response) => response.json()),
        tf.loadLayersModel(modelUrl, { requestInit })
      ]);

      this.model = model;
      this.labels = Array.isArray(metadata.labels) ? metadata.labels : [];
      this.modelType = 'custom';

      return { success: true, backend: tf.getBackend() };
    } catch (error) {
      console.error('Gagal memuat model:', error);
      throw error;
    }
  }

  async predict(imageElement) {
    if (!this.model) throw new Error('Model belum siap.');

    const predictions = tf.tidy(() => {
      const tensor = tf.browser.fromPixels(imageElement)
        .resizeBilinear([224, 224])
        .toFloat()
        .div(255)
        .expandDims(0);

      const prediction = this.model.predict(tensor);
      return prediction.dataSync();
    });

    const result = Array.from(predictions);
    const maxProbability = Math.max(...result);
    const maxIndex = result.indexOf(maxProbability);
    const confidence = Math.round(maxProbability * 100);
    const className = this.labels[maxIndex] || 'Tidak diketahui';

    return {
      isValid: confidence >= 25,
      className,
      score: maxProbability,
      confidence
    };
  }

  isLoaded() { return !!this.model; }
}