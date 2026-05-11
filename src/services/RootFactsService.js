import { pipeline, env } from '@xenova/transformers';
import { TONE_CONFIG } from '../utils/config.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel() {
    if (this.isModelLoaded) return;

    try {
      const device = navigator.gpu ? 'webgpu' : 'wasm';

      this.generator = await pipeline(
        'text2text-generation',
        'Xenova/LaMini-Flan-T5-77M',
        {
          dtype: 'q4',
          device
        }
      );

      this.isModelLoaded = true;
      console.log('Model Generative AI berhasil dimuat.');
    } catch (error) {
      console.error('Gagal memuat model AI:', error);
      throw error;
    }
  }

  setTone(tone) {
    this.currentTone = tone;
  }

  async generateFacts(vegetableName) {
    if (!this.generator) throw new Error('Model Generative AI belum siap.');

    this.isGenerating = true;

    try {
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

  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }
}