import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import * as mobilenet from '@tensorflow-models/mobilenet';

const VEGETABLE_LABEL_MAP = [
  { keyword: 'carrot', label: 'Carrot' },
  { keyword: 'cucumber', label: 'Cucumber' },
  { keyword: 'broccoli', label: 'Broccoli' },
  { keyword: 'cabbage', label: 'Cabbage' },
  { keyword: 'cauliflower', label: 'Cauliflower' },
  { keyword: 'bell pepper', label: 'Paprika' },
  { keyword: 'chili', label: 'Chilli' },
  { keyword: 'eggplant', label: 'Eggplant' },
  { keyword: 'garlic', label: 'Garlic' },
  { keyword: 'onion', label: 'Onion' },
  { keyword: 'potato', label: 'Potato' },
  { keyword: 'spinach', label: 'Spinach' },
  { keyword: 'lettuce', label: 'Lettuce' },
  { keyword: 'corn', label: 'Corn' },
  { keyword: 'peas', label: 'Peas' },
  { keyword: 'ginger', label: 'Ginger' },
  { keyword: 'beet', label: 'Beetroot' },
  { keyword: 'turnip', label: 'Turnip' }
];

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.modelType = 'mobilenet';
  }

  async loadModel() {
    try {
      // Windows Chrome masih menampilkan warning WebGPU requestAdapter.
      // Untuk pengalaman bersih, gunakan WebGL di Windows.
      const isWindows = navigator.userAgent.toLowerCase().includes('windows');
      if (!isWindows && navigator.gpu) {
        await tf.setBackend('webgpu');
      } else {
        await tf.setBackend('webgl');
      }
      await tf.ready();

      // Gunakan model yang pasti valid untuk mencegah crash di runtime.
      this.model = await mobilenet.load({
        version: 2,
        alpha: 1.0
      });
      this.labels = [];
      this.modelType = 'mobilenet';

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
      const normalizedLabel = this.normalizeVegetableLabel(top.className);
      const confidence = Math.round(top.probability * 100);
      return {
        isValid: confidence >= 70,
        className: normalizedLabel,
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

  normalizeVegetableLabel(rawLabel) {
    const lowerLabel = rawLabel.toLowerCase();
    const matched = VEGETABLE_LABEL_MAP.find(({ keyword }) => lowerLabel.includes(keyword));
    if (matched) return matched.label;
    return rawLabel.split(',')[0].trim();
  }

  isLoaded() { return !!this.model; }
}