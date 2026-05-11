import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.modelType = 'custom';
    this.loadPromise = null;
  }

  async loadModel() {
    if (this.model) {
      return { success: true, backend: tf.getBackend() };
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
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

        const metadataUrl = '/model/metadata.json';
        const modelUrl = '/model/model.json';

        const [metadataResponse, modelResponse, weightsResponse] = await Promise.all([
          fetch(metadataUrl, { cache: 'no-store' }),
          fetch(modelUrl, { cache: 'no-store' }),
          fetch('/model/weights.bin', { cache: 'no-store' })
        ]);

        const [metadata, modelJson, weightsBuffer] = await Promise.all([
          metadataResponse.json(),
          modelResponse.json(),
          weightsResponse.arrayBuffer()
        ]);

        const weightSpecs = Array.isArray(modelJson.weightsManifest)
          ? modelJson.weightsManifest.flatMap((entry) => entry.weights || [])
          : [];

        const modelArtifacts = {
          modelTopology: modelJson.modelTopology,
          weightSpecs,
          weightData: weightsBuffer
        };

        const model = await tf.loadLayersModel(tf.io.fromMemory(modelArtifacts));

        this.model = model;
        this.labels = Array.isArray(metadata.labels) ? metadata.labels : [];
        this.modelType = 'custom';

        return { success: true, backend: tf.getBackend() };
      } catch (error) {
        this.model = null;
        console.error('Gagal memuat model:', error);
        throw error;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
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