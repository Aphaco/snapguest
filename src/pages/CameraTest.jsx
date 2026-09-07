import React, { useRef, useState } from 'react';

function CameraTest() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState(null);

  const testCamera = async () => {
    try {
      setStatus('Requesting camera...');
      setError(null);
      
      console.log('1. Checking if getUserMedia exists...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported');
      }
      
      console.log('2. Requesting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      console.log('3. Camera obtained!', stream);
      setStatus('✅ Camera working!');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('4. Video playing!');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError(err.message);
      setStatus('❌ Failed: ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-dark text-white min-vh-100">
      <h2>📸 Camera Test</h2>
      <p className="text-muted">Status: {status}</p>
      {error && <p className="text-danger">Error: {error}</p>}
      
      <button 
        onClick={testCamera} 
        className="btn btn-primary mb-3"
      >
        Test Camera
      </button>
      
      <div className="bg-black rounded" style={{ height: '400px', overflow: 'hidden' }}>
        <video 
          ref={videoRef} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
}

export default CameraTest;