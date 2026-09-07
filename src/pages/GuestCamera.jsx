import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Container, Button, Spinner, Modal, Alert } from 'react-bootstrap';
import {
  FiCamera,
  FiVideo,
  FiX,
  FiImage,
  FiRefreshCw,
  FiUpload,
  FiTv
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './GuestCamera.css';

function GuestCamera() {
  const { eventSlug } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const isStartingCameraRef = useRef(false);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [mode, setMode] = useState('photo');
  const [cameraMode, setCameraMode] = useState('original');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedVideo, setCapturedVideo] = useState(null);
  const [capturedVideoBlob, setCapturedVideoBlob] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState([]);
  const [guestSession, setGuestSession] = useState(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadLimit, setUploadLimit] = useState(10);
  const [facingMode, setFacingMode] = useState('user');
  const [isRetrying, setIsRetrying] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isLaptop, setIsLaptop] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const showPermissionOverlay = !hasPermission && !isCameraReady;

  useEffect(() => {
    const init = async () => {
      await loadEvent();
      await createGuestSession();
      await detectDeviceType();

      const hasExistingPermission = await checkExistingPermission();
      if (hasExistingPermission) {
        await startCamera();
      } else {
        setupPermissionListener();
      }
    };
    init();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (capturedVideo) {
        URL.revokeObjectURL(capturedVideo);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    };
  }, [eventSlug]);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const loadEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', eventSlug)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error('Event not found');
        navigate('/');
        return;
      }

      setEvent(data);
      setUploadLimit(data.guest_upload_limit || 10);
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const createGuestSession = async () => {
    try {
      let token = localStorage.getItem(`guest_session_${eventSlug}`);

      if (token) {
        const { data, error } = await supabase
          .from('guest_sessions')
          .select('*')
          .eq('session_token', token)
          .single();

        if (data && !error) {
          setGuestSession(data);
          setUploadCount(data.upload_count || 0);
          return;
        }
      }

      const newToken = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

      const { data: eventData } = await supabase
        .from('events')
        .select('id')
        .eq('slug', eventSlug)
        .single();

      if (!eventData) return;

      const { data, error } = await supabase
        .from('guest_sessions')
        .insert([{
          event_id: eventData.id,
          session_token: newToken,
          upload_count: 0
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating guest session:', error);
        return;
      }

      localStorage.setItem(`guest_session_${eventSlug}`, newToken);
      setGuestSession(data);
      setUploadCount(0);

    } catch (error) {
      console.error('Error with guest session:', error);
    }
  };

  const detectDeviceType = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');

      console.log('Detecting device type...');
      console.log('Cameras found:', cameras.length);

      cameras.forEach((cam, i) => {
        console.log(`Camera ${i + 1}:`, cam.label || 'Unnamed');
      });

      const isLaptopDevice = cameras.length === 1 &&
        cameras[0].label &&
        !cameras[0].label.toLowerCase().includes('back') &&
        !cameras[0].label.toLowerCase().includes('rear') &&
        !cameras[0].label.toLowerCase().includes('environment');

      setIsLaptop(isLaptopDevice);

      if (isLaptopDevice) {
        console.log('🖥️ Laptop detected - using front camera');
        setFacingMode('user');
      } else {
        console.log('📱 Phone detected - using back camera');
        setFacingMode('environment');
      }
    } catch (error) {
      console.warn('Could not detect device type:', error);
      setFacingMode('user');
    }
  };

  const checkExistingPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        console.log('Existing permission state:', result.state);

        if (result.state === 'granted') {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.log('Cannot check permission, will try getUserMedia:', error);
      return false;
    }
  };

  const setupPermissionListener = () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' }).then((result) => {
          result.onchange = () => {
            console.log('Permission state changed to:', result.state);
            if (result.state === 'granted') {
              console.log('Permission granted! Starting camera...');
              startCamera();
            }
          };
        });
      }
    } catch (error) {
      console.log('Could not setup permission listener:', error);
    }
  };

  const startCamera = async () => {
    if (isStartingCameraRef.current) {
      console.log('startCamera already in progress, skipping duplicate call');
      return;
    }
    isStartingCameraRef.current = true;
    try {
      console.log('Starting camera...');
      setIsRetrying(true);
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      let useFacingMode = facingMode;

      if (isLaptop && facingMode === 'environment') {
        console.log('Laptop detected with environment mode - switching to user');
        useFacingMode = 'user';
        setFacingMode('user');
      }

      console.log('Using facing mode:', useFacingMode);

      const constraints = {
        video: {
          facingMode: useFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: mode === 'video'
      };

      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('Camera stream obtained successfully');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element not mounted');
      }

      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      console.log('srcObject set on video element');

      await new Promise((resolve, reject) => {
        if (videoRef.current.readyState >= 1) {
          console.log('Video metadata already loaded, skipping wait');
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 8000);

        videoRef.current.onloadedmetadata = () => {
          clearTimeout(timeout);
          console.log('Video metadata loaded');
          resolve();
        };

        videoRef.current.onerror = (e) => {
          clearTimeout(timeout);
          console.error('Video element error:', e);
          reject(new Error('Video element error'));
        };
      });

      await videoRef.current.play();
      console.log('Video playing');
      console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
      setIsCameraReady(true);
      setHasPermission(true);
      toast.success('Camera ready! 📸');
    } catch (error) {
      console.error('Error accessing camera:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);

      let errorMessage = 'Failed to start camera';

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera access denied. Please check your browser settings and allow camera access.';
        setHasPermission(false);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and refresh.';
        setHasPermission(false);
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application.';
        setHasPermission(false);
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage = 'Camera took too long to respond. Please try again.';
        setHasPermission(false);
      } else {
        errorMessage = `Camera error: ${error.message || 'Unknown error'}`;
        setHasPermission(false);
      }

      setCameraError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsRetrying(false);
      isStartingCameraRef.current = false;
    }
  };

  const checkPermissionAndRetry = async () => {
    setIsCheckingPermission(true);
    try {
      await detectDeviceType();
      await startCamera();
    } catch (error) {
      console.error('Error checking permission:', error);
      toast.error('Error checking camera permission. Please try again.');
    } finally {
      setIsCheckingPermission(false);
    }
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacingMode);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsCameraReady(false);
    await startCamera();
  };

  // ============================================================
  // CAPTURE PHOTO - FIXED filters
  // ============================================================
  const capturePhoto = () => {
    if (!videoRef.current || !isCameraReady) {
      console.log('Cannot capture - camera not ready');
      toast.error('Camera not ready. Please wait.');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas) {
        console.error('Canvas element not found');
        toast.error('Failed to capture: canvas not ready');
        return;
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      console.log('🎨 Applying filter:', cameraMode);
      
      // Apply effects
      if (cameraMode !== 'original') {
        applyCameraEffects(ctx, canvas.width, canvas.height);
      }

      const imageData = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedImage(imageData);
      setShowPreview(true);
      
      console.log('✅ Photo captured with filter:', cameraMode);
    } catch (error) {
      console.error('Error capturing photo:', error);
      toast.error('Failed to capture photo');
    }
  };

  // ============================================================
  // APPLY CAMERA EFFECTS - FIXED
  // ============================================================
  const applyCameraEffects = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    console.log('🎨 Applying effect:', cameraMode);

    switch (cameraMode) {
      case 'disposable':
        // Grain effect
        for (let i = 0; i < data.length; i += 4) {
          const grain = (Math.random() - 0.5) * 20;
          data[i] = Math.min(255, Math.max(0, data[i] + grain));
          data[i+1] = Math.min(255, Math.max(0, data[i+1] + grain));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + grain));
        }
        // Warm tint
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] + 10);
          data[i+2] = Math.max(0, data[i+2] - 5);
        }
        console.log('✅ Disposable filter applied');
        break;

      case 'film':
        // Film grain
        for (let i = 0; i < data.length; i += 4) {
          const grain = (Math.random() - 0.5) * 15;
          data[i] = Math.min(255, Math.max(0, data[i] + grain));
          data[i+1] = Math.min(255, Math.max(0, data[i+1] + grain));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + grain));
        }
        // Slight fade
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] + 15);
          data[i+1] = Math.min(255, data[i+1] + 15);
          data[i+2] = Math.min(255, data[i+2] + 15);
        }
        console.log('✅ Film filter applied');
        break;

      case 'retro':
        // 90s digital camera look
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, data[i] + 20);
          data[i+2] = Math.max(0, data[i+2] - 10);
        }
        // Reduce saturation
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i] + data[i+1] + data[i+2]) / 3;
          data[i] = data[i] * 0.8 + gray * 0.2;
          data[i+1] = data[i+1] * 0.8 + gray * 0.2;
          data[i+2] = data[i+2] * 0.8 + gray * 0.2;
        }
        console.log('✅ Retro filter applied');
        break;

      default:
        console.log('Original mode - no filter applied');
        break;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // ============================================================
  // START RECORDING - FIXED
  // ============================================================
  const startRecording = async () => {
    if (!streamRef.current || isRecording) return;

    chunksRef.current = [];
    const stream = streamRef.current;

    try {
      const mimeTypes = [
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
        'video/mp4'
      ];
      
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      console.log('🎥 Recording with MIME type:', selectedMimeType || 'default');

      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          const mimeType = selectedMimeType || 'video/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setCapturedVideo(url);
          setCapturedVideoBlob(blob);
          setShowPreview(true);
          setIsRecording(false);
          console.log('✅ Video recording completed');
        } catch (error) {
          console.error('Error creating video blob:', error);
          toast.error('Failed to process video');
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      console.log('✅ Recording started');

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      console.log('⏹️ Recording stopped');
    }
  };

  const handleShutterPress = () => {
    if (mode === 'photo') {
      capturePhoto();
    } else if (mode === 'video') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  // ============================================================
  // UPLOAD MEDIA - FIXED with count update
  // ============================================================
  const uploadMedia = async () => {
    if (!event) {
      toast.error('Event not loaded');
      return;
    }
    
    if (uploadCount >= uploadLimit) {
      toast.error(`Upload limit reached (${uploadLimit})`);
      return;
    }

    setUploading(true);

    try {
      let fileType;
      let fileExtension;
      let blob;

      if (capturedImage) {
        fileType = 'photo';
        fileExtension = 'jpg';
        const response = await fetch(capturedImage);
        blob = await response.blob();
      } else if (capturedVideoBlob) {
        fileType = 'video';
        fileExtension = 'webm';
        blob = capturedVideoBlob;
      } else {
        throw new Error('No media to upload');
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const file = new File([blob], fileName, { type: blob.type });

      console.log('📤 Uploading:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(`events/${event.id}/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('event-media')
        .getPublicUrl(`events/${event.id}/${fileName}`);

      const { error: insertError } = await supabase
        .from('media')
        .insert([{
          event_id: event.id,
          type: fileType,
          file_url: urlData.publicUrl,
          guest_session_id: guestSession?.id || 'anonymous'
        }]);

      if (insertError) throw insertError;

      // ✅ UPDATE THE COUNT
      if (guestSession) {
        const newCount = uploadCount + 1;
        console.log('📊 Updating count:', uploadCount, '→', newCount);
        
        const { error: sessionError } = await supabase
          .from('guest_sessions')
          .update({ 
            upload_count: newCount, 
            last_active_at: new Date().toISOString() 
          })
          .eq('id', guestSession.id);

        if (!sessionError) {
          setUploadCount(newCount);
          localStorage.setItem(`upload_count_${eventSlug}`, newCount);
          console.log('✅ Count updated to:', newCount);
        }
      }

      toast.success(`${fileType === 'photo' ? 'Photo' : 'Video'} uploaded! 📸`);
      setShowPreview(false);
      setCapturedImage(null);
      setCapturedVideo(null);
      setCapturedVideoBlob(null);

      if (capturedVideo) {
        URL.revokeObjectURL(capturedVideo);
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // LOAD GALLERY
  // ============================================================
  const loadGallery = async () => {
    if (!event) {
      toast.error('Event not loaded');
      return;
    }

    setGalleryLoading(true);
    
    try {
      console.log('📸 Loading gallery for event:', event.id);
      
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', event.id)
        .order('uploaded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      console.log('✅ Gallery data loaded:', data?.length || 0, 'items');
      
      setGalleryMedia(data || []);
      setShowGallery(true);
      
      if (data?.length === 0) {
        toast.info('No photos yet. Be the first to capture a moment!');
      }
    } catch (error) {
      console.error('Error loading gallery:', error);
      toast.error('Failed to load gallery');
    } finally {
      setGalleryLoading(false);
    }
  };

  const retake = () => {
    setShowPreview(false);
    setCapturedImage(null);
    setCapturedVideo(null);
    setCapturedVideoBlob(null);
    if (capturedVideo) {
      URL.revokeObjectURL(capturedVideo);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark">
        <Spinner animation="border" variant="light" />
      </div>
    );
  }

  return (
    <div className="camera-container position-relative">
      {showPermissionOverlay && (
        <div
          className="d-flex flex-column justify-content-center align-items-center text-white p-4"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            backgroundColor: 'rgba(0,0,0,0.92)'
          }}
        >
          <div className="text-center" style={{ maxWidth: '320px' }}>
            <div className="display-1 mb-4">📸</div>
            <h5 className="fw-bold mb-3">Camera Access Required</h5>
            <p className="text-muted small mb-4">
              To capture moments at {event?.name}, we need access to your camera.
            </p>
            {cameraError && (
              <Alert variant="danger" className="text-start small" style={{ fontSize: '12px' }}>
                {cameraError}
              </Alert>
            )}
            <div className="d-flex flex-column gap-2">
              <Button
                variant="primary"
                onClick={checkPermissionAndRetry}
                className="btn-mobile btn-primary-mobile rounded-pill px-5"
                disabled={isRetrying || isCheckingPermission}
              >
                {isRetrying || isCheckingPermission ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Requesting...
                  </>
                ) : (
                  'Allow Camera Access'
                )}
              </Button>
              <Button
                variant="outline-light"
                onClick={checkPermissionAndRetry}
                className="btn-mobile rounded-pill px-4"
                style={{ fontSize: '12px' }}
                disabled={isRetrying || isCheckingPermission}
              >
                Already allowed? Check again
              </Button>
              <small className="text-muted mt-2" style={{ fontSize: '10px' }}>
                {isLaptop ? '🖥️ Laptop detected - using front camera' : '📱 Using default camera'}
              </small>
            </div>
          </div>
        </div>
      )}

      <div className="camera-top-bar">
        <div>
          <div className="event-name">
            {event?.name}
          </div>
          <div className="text-white opacity-75 small" style={{ fontSize: '11px' }}>
            {event?.description || 'Capture the moment'}
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Link to={`/e/${eventSlug}/live`} className="text-decoration-none">
            <button
              className="camera-action-btn"
              style={{
                background: 'rgba(239, 68, 68, 0.3)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="View Live Wall"
            >
              <FiTv size={16} className="text-danger" />
            </button>
          </Link>

          <div className="upload-counter">
            {uploadCount}/{uploadLimit}
          </div>
          <button
            className="camera-close-btn"
            onClick={() => navigate('/')}
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      <div className="camera-viewport">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onError={(e) => {
            console.error('Video element error:', e);
            toast.error('Camera video error. Please try again.');
            setIsCameraReady(false);
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#000',
            display: showPermissionOverlay ? 'none' : 'block'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        {!showPermissionOverlay && !isCameraReady && (
          <div className="position-absolute top-50 start-50 translate-middle text-white text-center">
            <Spinner animation="border" variant="light" />
            <p className="mt-3 small">Starting camera...</p>
          </div>
        )}
      </div>

      {!showPermissionOverlay && (
        <div className="camera-controls">
          <div className="camera-mode-selector hide-scrollbar">
            {event?.camera_modes?.map((m) => (
              <button
                key={m}
                className={`mode-btn ${cameraMode === m ? 'active' : ''}`}
                onClick={() => setCameraMode(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="camera-shutter-row">
            <button
              className="camera-action-btn"
              onClick={switchCamera}
              title="Switch Camera"
            >
              <FiRefreshCw size={20} />
            </button>

            <div
              className={`camera-shutter ${isRecording ? 'recording' : ''}`}
              onClick={handleShutterPress}
            >
              <div className="camera-shutter-inner" />
            </div>

            <button
              className="camera-action-btn"
              onClick={loadGallery}
              title="View Gallery"
              disabled={galleryLoading}
            >
              {galleryLoading ? (
                <Spinner animation="border" size="sm" variant="light" />
              ) : (
                <FiImage size={20} />
              )}
            </button>
          </div>

          <div className="d-flex justify-content-center gap-3 mt-2">
            <button
              className={`btn btn-sm rounded-pill px-4 ${mode === 'photo' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setMode('photo')}
              style={{ fontSize: '12px' }}
            >
              <FiCamera size={14} className="me-1" />
              Photo
            </button>
            <button
              className={`btn btn-sm rounded-pill px-4 ${mode === 'video' ? 'btn-light' : 'btn-outline-light'}`}
              onClick={() => setMode('video')}
              style={{ fontSize: '12px' }}
            >
              <FiVideo size={14} className="me-1" />
              Video
            </button>
          </div>

          {isRecording && (
            <div className="text-center text-white mt-2">
              <span className="badge bg-danger animate-pulse">
                ● REC {recordingTime}s
              </span>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        show={showPreview}
        centered
        fullscreen="sm-down"
        dialogClassName="modal-dark"
        contentClassName="bg-dark border-0"
      >
        <Modal.Body className="d-flex flex-column p-0">
          <div className="position-relative flex-grow-1 d-flex align-items-center justify-content-center bg-dark">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Preview"
                className="img-fluid"
                style={{ maxHeight: '80vh', objectFit: 'contain' }}
                onError={(e) => {
                  console.error('Image preview error:', e);
                }}
              />
            ) : capturedVideo ? (
              <video
                src={capturedVideo}
                controls
                autoPlay
                className="w-100"
                style={{ maxHeight: '80vh' }}
                onError={(e) => {
                  console.error('Video preview error:', e);
                }}
              />
            ) : null}
          </div>

          <div className="p-4 bg-dark border-top border-secondary">
            <div className="d-flex gap-3">
              <Button
                variant="outline-light"
                onClick={retake}
                className="flex-grow-1 rounded-pill py-2"
                disabled={uploading}
              >
                <FiX size={18} className="me-2" />
                Retake
              </Button>
              <Button
                variant="primary"
                onClick={uploadMedia}
                className="flex-grow-1 rounded-pill py-2"
                disabled={uploading || uploadCount >= uploadLimit}
              >
                {uploading ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <FiUpload size={18} className="me-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            {uploadCount >= uploadLimit && (
              <div className="text-warning text-center small mt-2">
                You've reached your upload limit ({uploadLimit})
              </div>
            )}
          </div>
        </Modal.Body>
      </Modal>

      {/* Gallery Modal */}
      {showGallery && (
        <div
          className="position-fixed top-0 start-0 end-0 bottom-0"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.25s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowGallery(false);
            }
          }}
        >
          <div
            className="bg-white rounded-4 shadow-lg overflow-hidden"
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <FiImage size={18} />
                Live Gallery
                <span className="badge bg-secondary text-white ms-2">
                  {galleryMedia.length}
                </span>
              </h6>
              <button
                className="btn btn-sm btn-outline-secondary rounded-circle d-flex align-items-center justify-content-center"
                onClick={() => setShowGallery(false)}
                style={{ width: '32px', height: '32px' }}
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="p-2 overflow-auto" style={{ flex: 1, maxHeight: '60vh' }}>
              {galleryLoading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <span className="ms-3">Loading gallery...</span>
                </div>
              ) : galleryMedia.length === 0 ? (
                <div className="text-center py-5">
                  <div style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🖼️</div>
                  <h5 style={{ fontFamily: 'Playfair Display, serif' }}>No photos yet</h5>
                  <p className="text-muted">Be the first to capture a moment!</p>
                </div>
              ) : (
                <div className="gallery-grid">
                  {galleryMedia.map((item) => (
                    <div key={item.id} className="gallery-item">
                      {item.type === 'photo' ? (
                        <img
                          src={item.file_url}
                          alt="Event photo"
                          loading="lazy"
                          onError={(e) => {
                            console.error('Gallery image error:', e);
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext x="50" y="110" font-size="40"%3E📸%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <video
                          src={item.file_url}
                          muted
                          onError={(e) => {
                            console.error('Gallery video error:', e);
                          }}
                        />
                      )}
                      {item.type === 'video' && (
                        <div className="video-badge">
                          <FiVideo size={10} />
                          Video
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-top bg-light">
              <Button
                variant="primary"
                onClick={() => setShowGallery(false)}
                className="w-100 rounded-pill"
              >
                <FiCamera size={18} className="me-2" />
                Back to Camera
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestCamera;