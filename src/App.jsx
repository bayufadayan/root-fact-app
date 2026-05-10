import { useRef, useState, useEffect } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { CameraService } from './services/CameraService';
import { DetectionService } from './services/DetectionService';
import { RootFactsService } from './services/RootFactsService';
import { isValidDetection, APP_CONFIG } from './utils/config';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');

  // Sinkronisasi ref dengan state supaya loop selalu dapat nilai terbaru
  useEffect(() => {
    isRunningRef.current = state.isRunning;
  }, [state.isRunning]);

  // TODO [Basic] Inisialisasi layanan deteksi, kamera, dan generator fakta saat aplikasi dimuat
  useEffect(() => {
    let isMounted = true;

    const initServices = async () => {
      try {
        const camera = new CameraService();
        const detector = new DetectionService();
        const generator = new RootFactsService();

        actions.setServices({ camera, detector, generator });
        actions.setModelStatus('Memuat Model AI...');

        // Load Model Deteksi dulu
        await detector.loadModel();

        if (isMounted) {
          actions.setModelStatus('Model AI Siap');
        }
      } catch (error) {
        console.error('Gagal inisialisasi:', error);
        if (isMounted) {
          actions.setError('Gagal memuat model. Cek koneksi internetmu.');
          actions.setModelStatus('Error');
        }
      }
    };

    initServices();

    // TODO [Basic] Bersihkan sumber daya saat komponen ditinggalkan
    return () => {
      isMounted = false;
      if (state.services.camera) {
        state.services.camera.stopCamera();
      }
      if (detectionCleanupRef.current) {
        clearTimeout(detectionCleanupRef.current);
      }
    };
  }, []);

  // TODO [Basic] Fungsi untuk memulai loop deteksi
  const startDetectionLoop = async () => {
    const { camera, detector, generator } = state.services;

    if (!camera || !detector || !camera.isActive() || !isRunningRef.current) return;

    try {
      // Ambil frame dari canvas (captureFrame) bukan dari video langsung
      const frame = camera.captureFrame();

      if (frame) {
        const result = await detector.predict(frame);

        if (isValidDetection(result)) {
          actions.setAppState('analyzing');
          actions.setDetectionResult(result);

          handleToggleCamera(); // Stop kamera

          setTimeout(async () => {
            actions.setAppState('result');
            actions.setFunFactData(null);

            try {
              if (generator && generator.isReady()) {
                const fact = await generator.generateFacts(result.className);
                actions.setFunFactData(fact);
              }
            } catch (err) {
              actions.setFunFactData('error');
            }
          }, APP_CONFIG.analyzingDelay);

          return;
        }
      }
    } catch (error) {
      console.error('Detection Error:', error);
    }

    if (isRunningRef.current) {
      const fps = camera.getFPS();
      detectionCleanupRef.current = setTimeout(() => {
        requestAnimationFrame(startDetectionLoop);
      }, 1000 / fps);
    }
  };

  // TODO [Basic] Fungsi untuk memulai dan menghentikan kamera
  const handleToggleCamera = async (cameraType = 'default') => {
    const { camera } = state.services;
    if (!camera) return;

    if (state.isRunning) {
      // Matiin Kamera
      actions.setRunning(false);
      camera.stopCamera();
      if (detectionCleanupRef.current) {
        clearTimeout(detectionCleanupRef.current);
      }
    } else {
      // Nyalain Kamera
      try {
        actions.setError(null);
        actions.resetResults(); // Balik ke state idle

        await camera.startCamera(cameraType);
        actions.setRunning(true);

        // Mulai loop prediksi dengan sedikit jeda biar stream siap
        setTimeout(() => {
          startDetectionLoop();
        }, 500);
      } catch (error) {
        console.error(error);
        actions.setError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
      }
    }
  };

  // TODO [Advance] Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = (newTone) => {
    setCurrentTone(newTone);
    const { generator } = state.services;
    if (generator && generator.setTone) {
      generator.setTone(newTone);
    }
  };

  // TODO [Skilled] Fungsi untuk menyalin fakta ke clipboard
  const handleCopyFact = async () => {
    if (state.funFactData && state.funFactData !== 'error') {
      try {
        await navigator.clipboard.writeText(state.funFactData);
        alert('Fakta menarik berhasil disalin!');
      } catch (err) {
        console.error('Gagal menyalin:', err);
      }
    }
  };

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;