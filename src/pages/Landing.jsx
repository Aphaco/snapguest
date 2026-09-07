import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-classic">
      {/* Navigation */}
      <nav className="classic-nav">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <span className="brand-icon">✦</span>
            SnapGuest
          </Link>
          <div className="nav-actions">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-classic-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-classic-outline">
                  Sign In
                </Link>
                <Link to="/login?mode=register" className="btn-classic-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Premium Event Photography
            </div>
            <h1 className="hero-title">
              Capture Every Moment
              <br />
              <span className="hero-title-accent">Through Everyone's Eyes</span>
            </h1>
            <p className="hero-description">
              The digital disposable camera for weddings and events. 
              Guests scan a QR code, take photos, and everyone's memories 
              appear in one beautiful gallery, no app download needed.
            </p>
            <div className="hero-actions">
              <Link to="/login?mode=register" className="btn-hero-primary">
                Start Your Event
              </Link>
              {/* <button className="btn-hero-secondary">
                Watch Demo
              </button> */}
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-phone-frame">
              <div className="phone-screen">
                <div className="phone-header">
                  <span className="phone-event-name">Sarah's Birthday</span>
                  <span className="phone-live-badge">● LIVE</span>
                </div>
                <div className="phone-camera-preview">
                  <span className="phone-camera-icon">📸</span>
                  <span className="phone-camera-text">Camera Ready</span>
                </div>
                <div className="phone-controls">
                  <button className="phone-btn photo">Photo</button>
                  <button className="phone-btn video">Video</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="features-header">
            <span className="features-label">How It Works</span>
            <h2 className="features-title">Three Simple Steps</h2>
            <p className="features-subtitle">
              From QR scan to lasting memories — in seconds.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-number">01</div>
              <div className="feature-icon">📱</div>
              <h3 className="feature-title">Scan QR Code</h3>
              <p className="feature-description">
                Guests scan the QR code on their table with their phone camera.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-number">02</div>
              <div className="feature-icon">📸</div>
              <h3 className="feature-title">Capture Moments</h3>
              <p className="feature-description">
                Take photos and videos with vintage camera modes right in the browser.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-number">03</div>
              <div className="feature-icon">🖼️</div>
              <h3 className="feature-title">Live Gallery</h3>
              <p className="feature-description">
                All uploads appear instantly in the shared event gallery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="classic-footer">
        <div className="footer-container">
          <p className="footer-text">© 2026 SnapGuest. All rights reserved.</p>
          <div className="footer-links">
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;