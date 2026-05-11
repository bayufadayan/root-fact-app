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
  const isMountedRef = useRef(true);
  const hasAutoStartedRef = useRef(false);
  const servicesRef = useRef(state.services);
  const [currentTone, setCurrentTone] = useState('normal');

  // Sinkronisasi ref dengan state supaya loop selalu dapat nilai terbaru
  useEffect(() => {
    isRunningRef.current = state.isRunning;
  }, [state.isRunning]);

  useEffect(() => {
    servicesRef.current = state.services;
  }, [state.services]);

  const stopDetectionLoop = () => {
    if (detectionCleanupRef.current) {
      clearTimeout(detectionCleanupRef.current);
      detectionCleanupRef.current = null;
    }
  };

  const startDetectionLoop = async () => {
    const { camera, detector, generator } = servicesRef.current;

    if (!camera || !detector || !camera.isActive() || !isRunningRef.current) {
      return;
    }

    try {
      const frame = camera.captureFrame();

      if (frame) {
        const result = await detector.predict(frame);

        if (isValidDetection(result)) {
          actions.setAppState('analyzing');
          actions.setDetectionResult(result);
          actions.setFunFactData(null);

          stopDetectionLoop();
          camera.stopCamera();
          actions.setRunning(false);

          setTimeout(async () => {
            if (!isMountedRef.current) {
              return;
            }

            actions.setAppState('result');

            try {
              if (generator && generator.isReady()) {
                const fact = await generator.generateFacts(result.className);
                actions.setFunFactData(fact);
              } else {
                actions.setFunFactData('error');
              }
            } catch (error) {
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

  const handleToggleCamera = async (cameraType = 'default') => {
    const { camera } = servicesRef.current;

    if (!camera) {
      return;
    }

    if (camera.isActive() || isRunningRef.current) {
      actions.setRunning(false);
      camera.stopCamera();
      stopDetectionLoop();
      return;
    }

    try {
      actions.setError(null);
      actions.resetResults();

      await camera.startCamera(cameraType);
      actions.setRunning(true);

      setTimeout(() => {
        if (isMountedRef.current) {
          startDetectionLoop();
        }
      }, 350);
    } catch (error) {
      console.error(error);
      actions.setError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
    }
  };

  useEffect(() => {
    let isMounted = true;
    let progressTimer = null;

    const initServices = async () => {
      try {
        const camera = new CameraService();
        const detector = new DetectionService();
        const generator = new RootFactsService();

        actions.setServices({ camera, detector, generator: null });
        let progress = 0;
        actions.setModelStatus(`Memuat Model AI... ${progress}%`);

        progressTimer = setInterval(() => {
          if (!isMounted) return;
          progress = Math.min(progress + 5, 95);
          actions.setModelStatus(`Memuat Model AI... ${progress}%`);
        }, 250);

        // Load model deteksi lebih dulu agar scan cepat tersedia.
        await detector.loadModel();
        progress = 55;
        if (isMounted) {
          actions.setModelStatus(`Memuat Model AI... ${progress}%`);
        }

        progress = 100;

        if (isMounted) {
          actions.setServices({ camera, detector, generator: null });
          actions.setModelStatus(`Model AI Siap (${progress}%)`);
          isMountedRef.current = true;
        }

        // Model generatif diload di background agar kamera bisa langsung mulai scan.
        generator.loadModel().then(() => {
          if (!isMountedRef.current) {
            return;
          }

          const currentServices = servicesRef.current;
          actions.setServices({
            camera: currentServices.camera,
            detector: currentServices.detector,
            generator
          });
        }).catch((error) => {
          console.warn('Model fun fact gagal dimuat. Aplikasi lanjut mode deteksi.', error);
        });
      } catch (error) {
        console.error('Gagal inisialisasi:', error);
        if (isMounted) {
          actions.setError('Gagal memuat model. Cek koneksi internetmu.');
          actions.setModelStatus('Error');
        }
      } finally {
        if (progressTimer) {
          clearInterval(progressTimer);
        }
      }
    };

    initServices();

    // TODO [Basic] Bersihkan sumber daya saat komponen ditinggalkan
    return () => {
      isMounted = false;
      isMountedRef.current = false;
      stopDetectionLoop();
      if (progressTimer) {
        clearInterval(progressTimer);
      }

      const { camera } = servicesRef.current;
      if (camera) {
        camera.stopCamera();
      }
    };
  }, []);

  // Kamera otomatis menyala sekali saat model siap untuk memicu izin kamera.
  useEffect(() => {
    if (!hasAutoStartedRef.current && state.modelStatus.includes('Model AI Siap') && state.services.camera) {
      hasAutoStartedRef.current = true;

      const autoStartTimer = setTimeout(() => {
        if (isMountedRef.current) {
          handleToggleCamera('default');
        }
      }, 1000);

      return () => clearTimeout(autoStartTimer);
    }
  }, [state.modelStatus, state.services.camera]);

  // TODO [Advance] Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = (newTone) => {
    setCurrentTone(newTone);
    const { generator } = servicesRef.current;
    if (generator && generator.setTone) {
      generator.setTone(newTone);
    }
  };

  useEffect(() => {
    const { generator } = state.services;
    if (generator && generator.setTone) {
      generator.setTone(currentTone);
    }
  }, [state.services.generator, currentTone]);

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