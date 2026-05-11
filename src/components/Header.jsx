import { Sprout } from 'lucide-react';

function Header({ modelStatus, secondaryStatus }) {
  const isModelReady = modelStatus.startsWith('Model AI Siap');

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Sprout size={20} />
          <span>RootFacts</span>
        </div>

        <div className="status-meta">
          <div className="status-pill">
            <span className={`status-dot ${isModelReady ? 'active' : ''}`}></span>
            <span>{modelStatus}</span>
          </div>
          {secondaryStatus && (
            <span className="status-subtext">{secondaryStatus}</span>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
