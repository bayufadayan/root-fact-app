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
    this.loadPromise = null;
  }

  async loadModel(onProgress) {
    if (this.isModelLoaded) return this.generator;

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const device = navigator.gpu ? 'webgpu' : 'wasm';

        if (typeof onProgress === 'function') {
          onProgress('Memuat fakta AI... 0%');
        }

        this.generator = await pipeline(
          'text2text-generation',
          'Xenova/LaMini-Flan-T5-77M',
          {
            dtype: 'q4',
            device,
            progress_callback: (progress) => {
              if (typeof onProgress !== 'function') {
                return;
              }

              if (progress?.status === 'progress' && progress.file) {
                const percent = Math.round(progress.progress || 0);
                const label = progress.file.includes('decoder')
                  ? 'Memuat fakta AI (decoder)'
                  : progress.file.includes('encoder')
                    ? 'Memuat fakta AI (encoder)'
                    : 'Mengunduh fakta AI';

                onProgress(`${label}... ${percent}%`);
              }
            }
          }
        );

        this.isModelLoaded = true;
        if (typeof onProgress === 'function') {
          onProgress('Model AI Siap');
        }

        console.log('Model Generative AI berhasil dimuat.');
        return this.generator;
      } catch (error) {
        this.generator = null;
        this.isModelLoaded = false;
        console.error('Gagal memuat model AI:', error);
        throw error;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  setTone(tone) {
    this.currentTone = tone;
  }

  async generateFacts(vegetableName) {
    if (!this.generator) {
      await this.loadModel();
    }

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