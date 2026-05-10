import { pipeline, env } from '@xenova/transformers';
import { TONE_CONFIG } from '../utils/config.js';

// Opsional: Memastikan model ditarik dari Hugging Face Hub (CDN)
env.allowLocalModels = false;

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  // TODO [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // TODO [Advance] Implementasikan strategi Backend Adaptive
  async loadModel() {
    if (this.isModelLoaded) return;

    try {
      // Backend Adaptive: Menggunakan WebGPU jika tersedia, fallback ke WASM
      let device = 'webgpu';
      if (!navigator.gpu) {
        console.warn('WebGPU tidak tersedia untuk Transformers.js, fallback ke WASM.');
        device = 'wasm';
      }

      // Inisialisasi pipeline dengan model text-generation yang ringan
      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/LaMini-Flan-T5-77M', // Model yang cukup ringan untuk dijalankan di peramban
        {
          dtype: 'q4', // Sesuai tips submission agar model tidak terlalu berat
          device: device
        }
      );

      this.isModelLoaded = true;
      console.log('Model Generative AI berhasil dimuat.');
    } catch (error) {
      console.error('Gagal memuat model AI:', error);
      throw error;
    }
  }

  // TODO [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    this.currentTone = tone;
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  // TODO [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // TODO [Advance] Implemenasikan parameter tone untuk mengatur nada fakta yang dihasilkan
  async generateFacts(vegetableName) {
    if (!this.generator) throw new Error('Model Generative AI belum siap.');

    this.isGenerating = true;

    try {
      // Kriteria 2: Karena keterbatasan, berikan prompt menggunakan bahasa Inggris.
      let toneInstruction = 'Make it interesting and educational.';

      switch (this.currentTone) {
      case 'funny':
        toneInstruction = 'Make it very funny and hilarious.';
        break;
      case 'professional':
        toneInstruction = 'Explain it scientifically and formally.';
        break;
      case 'casual':
        toneInstruction = 'Keep it chill, casual, and friendly.';
        break;
      }

      const prompt = `Tell me one short, unique fun fact about ${vegetableName}. ${toneInstruction}`;

      // Parameter untuk menjaga performa (Kriteria Skilled)
      const result = await this.generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true
      });

      this.isGenerating = false;

      if (result && result.length > 0) {
        return result[0].generated_text.trim();
      }

      return `Wow, that's a nice ${vegetableName}! But I'm speechless right now.`;
    } catch (error) {
      this.isGenerating = false;
      console.error('Gagal menghasilkan fakta:', error);
      throw error;
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }
}