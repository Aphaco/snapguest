import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiImage,
  FiRefreshCw,
  FiRotateCw,
  FiShare2,
  FiTv,
  FiUpload,
  FiVideo,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './GuestCamera.css';

/* ============================================================
   FILTERS
============================================================ */

const FILTERS = {
  original: 'none',
  disposable:
    'sepia(0.35) contrast(1.15) saturate(1.3) brightness(1.05)',
  film:
    'sepia(0.5) contrast(1.1) saturate(0.85) brightness(1.08)',
  retro:
    'contrast(1.25) saturate(1.4) hue-rotate(-10deg) brightness(0.95)',
};

const FILTER_LABELS = {
  original: 'Original',
  disposable: 'Disposable',
  film: 'Film',
  retro: 'Retro',
};

/* ============================================================
   HELPERS
============================================================ */

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}`;
};

/* ============================================================
   DOWNLOAD HELPER
   ============================================================ */
/*
 * Tries the Web Share API first (best on iOS), then falls
 * back to a programmatic anchor download (best on Android/
 * desktop). Returns true if a save action was triggered.
 */
const saveFileToDevice = async (blob, filename) => {
  // ---- Try Web Share API (iOS Safari, some Android) ----
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    navigator.canShare
  ) {
    try {
      const file = new File([blob], filename, {
        type: blob.type || 'application/octet-stream',
      });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'SnapGuest moment',
        });
        return true;
      }
    } catch (error) {
      // User cancelled share → fall through to anchor download
      if (error?.name === 'AbortError') {
        return false;
      }
      console.warn('Share API failed, using anchor download:', error);
    }
  }

  // ---- Fallback: anchor download (Android/Desktop) ----
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (error) {
    console.error('Anchor download failed:', error);
    return false;
  }
};

/* ============================================================
   COMPONENT
============================================================ */

function GuestCamera() {
  const { eventSlug } = useParams();
  const navigate = useNavigate();

  /* -----------------------------
     Refs
  ----------------------------- */

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStageRef = useRef(null);

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isStartingCameraRef = useRef(false);
  const previewVideoUrlRef = useRef(null);

  /* -----------------------------
     Event / session
  ----------------------------- */

  const [event, setEvent] = useState(null);
  const [guestSession, setGuestSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [uploadCount, setUploadCount] = useState(0);
  const [uploadLimit, setUploadLimit] = useState(10);

  /* -----------------------------
     Camera
  ----------------------------- */

  const [hasPermission, setHasPermission] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraStarting, setCameraStarting] = useState(false);

  const [facingMode, setFacingMode] = useState('environment');
  const [isLaptop, setIsLaptop] = useState(false);

  /* -----------------------------
     Capture
  ----------------------------- */

  const [mode, setMode] = useState('photo');
  const [cameraMode, setCameraMode] = useState('original');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedVideo, setCapturedVideo] = useState(null);
  const [capturedVideoBlob, setCapturedVideoBlob] = useState(null);

  const [showPreview, setShowPreview] = useState(false);
  const [publishToWall, setPublishToWall] = useState(true);

  const [uploading, setUploading] = useState(false);

  /* -----------------------------
     Gallery
  ----------------------------- */

  const [galleryMedia, setGalleryMedia] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);

  /* -----------------------------
     Misc
  ----------------------------- */

  const [showFilters, setShowFilters] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  /* ============================================================
     FILTER
  ============================================================ */

  const getCurrentFilter = useCallback(() => {
    return FILTERS[cameraMode] || FILTERS.original;
  }, [cameraMode]);

  /* ============================================================
     LOAD EVENT
  ============================================================ */

  const loadEvent = useCallback(async () => {
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
        return null;
      }

      setEvent(data);
      setUploadLimit(data.guest_upload_limit || 10);

      return data;
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Failed to load event');
      return null;
    }
  }, [eventSlug, navigate]);

  /* ============================================================
     CREATE / RESTORE GUEST SESSION
  ============================================================ */

  const createGuestSession = useCallback(async (eventId) => {
    if (!eventId) return null;

    setSessionLoading(true);

    try {
      const storageKey = `guest_session_${eventSlug}`;

      let token = localStorage.getItem(storageKey);

      if (token) {
        const { data, error } = await supabase
          .from('guest_sessions')
          .select('*')
          .eq('session_token', token)
          .eq('event_id', eventId)
          .single();

        if (data && !error) {
          setGuestSession(data);
          setUploadCount(data.upload_count || 0);
          return data;
        }
      }

      token = createId();

      const { data, error } = await supabase
        .from('guest_sessions')
        .insert([
          {
            event_id: eventId,
            session_token: token,
            upload_count: 0,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Guest session creation failed:', error);
        throw error;
      }

      localStorage.setItem(storageKey, token);

      setGuestSession(data);
      setUploadCount(data.upload_count || 0);

      return data;
    } catch (error) {
      console.error('Error creating guest session:', error);
      toast.error(
        'Could not create your guest session. Please refresh and try again.'
      );
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, [eventSlug]);

  /* ============================================================
     DEVICE DETECTION
  ============================================================ */

  const detectDeviceType = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setFacingMode('user');
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();

      const cameras = devices.filter(
        (device) => device.kind === 'videoinput'
      );

      const hasBackCamera = cameras.some((camera) => {
        const label = (camera.label || '').toLowerCase();

        return (
          label.includes('back') ||
          label.includes('rear') ||
          label.includes('environment')
        );
      });

      if (hasBackCamera || cameras.length > 1) {
        setIsLaptop(false);
        setFacingMode('environment');
      } else {
        setIsLaptop(true);
        setFacingMode('user');
      }
    } catch (error) {
      console.warn('Could not detect device:', error);
      setFacingMode('user');
    }
  }, []);

  /* ============================================================
     CAMERA START
  ============================================================ */

  const startCamera = useCallback(
    async (requestedFacingMode = null) => {
      if (isStartingCameraRef.current) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Camera access is not supported by this browser.'
        );
        return;
      }

      isStartingCameraRef.current = true;
      setCameraStarting(true);
      setCameraError(null);

      try {
        const targetFacingMode =
          requestedFacingMode || facingMode || 'user';

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
          });

          streamRef.current = null;
        }

        setIsCameraReady(false);

        const constraints = {
          video: {
            facingMode: {
              ideal: targetFacingMode,
            },
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 1920,
            },
          },
          audio: true,
        };

        let stream;

        try {
          stream = await navigator.mediaDevices.getUserMedia(
            constraints
          );
        } catch (firstError) {
          console.warn(
            'Primary camera constraints failed:',
            firstError
          );

          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }

        streamRef.current = stream;

        setHasPermission(true);

        const video = videoRef.current;

        if (!video) {
          throw new Error('Camera preview element is not available.');
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        if (video.readyState < 1) {
          await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 3000);

            const handleMetadata = () => {
              clearTimeout(timeout);
              video.removeEventListener(
                'loadedmetadata',
                handleMetadata
              );
              resolve();
            };

            video.addEventListener(
              'loadedmetadata',
              handleMetadata
            );
          });
        }

        try {
          await video.play();
        } catch (playError) {
          console.warn(
            'Video play required retry:',
            playError
          );

          video.muted = true;
          await video.play().catch(() => {});
        }

        setIsCameraReady(true);
        setCameraError(null);

        return stream;
      } catch (error) {
        console.error('Camera error:', error);

        setIsCameraReady(false);

        if (
          error.name === 'NotAllowedError' ||
          error.name === 'PermissionDeniedError'
        ) {
          setHasPermission(false);
          setCameraError(
            'Camera access was denied. Allow camera access in your browser settings and try again.'
          );
        } else if (
          error.name === 'NotFoundError' ||
          error.name === 'DevicesNotFoundError'
        ) {
          setCameraError(
            'No camera was found on this device.'
          );
        } else if (error.name === 'NotReadableError') {
          setCameraError(
            'Your camera is being used by another application.'
          );
        } else if (error.name === 'OverconstrainedError') {
          setCameraError(
            'The selected camera mode is not available on this device.'
          );
        } else {
          setCameraError(
            error.message || 'Unable to start the camera.'
          );
        }

        return null;
      } finally {
        setCameraStarting(false);
        isStartingCameraRef.current = false;
      }
    },
    [facingMode]
  );

  /* ============================================================
     INITIALISE
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      setLoading(true);

      const eventData = await loadEvent();

      if (!mounted || !eventData) {
        setLoading(false);
        return;
      }

      await createGuestSession(eventData.id);
      await detectDeviceType();

      setLoading(false);

      setTimeout(() => {
        if (mounted) {
          startCamera();
        }
      }, 100);
    };

    initialise();

    return () => {
      mounted = false;

      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch (error) {
          console.warn(error);
        }

        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (previewVideoUrlRef.current) {
        URL.revokeObjectURL(previewVideoUrlRef.current);
        previewVideoUrlRef.current = null;
      }
    };
  }, [
    createGuestSession,
    detectDeviceType,
    loadEvent,
    startCamera,
  ]);

  /* ============================================================
     RECORDING TIMER
  ============================================================ */

  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setRecordingTime((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  /* ============================================================
     AUTO STOP VIDEO
  ============================================================ */

  useEffect(() => {
    if (!isRecording || !event?.video_max_duration) {
      return;
    }

    if (recordingTime >= Number(event.video_max_duration)) {
      stopRecording();
    }
  }, [
    recordingTime,
    isRecording,
    event?.video_max_duration,
  ]);

  /* ============================================================
     SWITCH CAMERA
  ============================================================ */

  const switchCamera = async () => {
    if (cameraStarting) return;

    const nextFacingMode =
      facingMode === 'environment' ? 'user' : 'environment';

    setFacingMode(nextFacingMode);

    await startCamera(nextFacingMode);
  };

  /* ============================================================
     RETRY CAMERA
  ============================================================ */

  const retryCamera = async () => {
    setCameraError(null);
    await detectDeviceType();
    await startCamera(facingMode);
  };

  /* ============================================================
     CAPTURE PHOTO
  ============================================================ */

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stage = cameraStageRef.current;

    if (!video || !canvas || !isCameraReady) {
      toast.error('Camera is not ready yet.');
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      toast.error('Camera is still preparing. Try again.');
      return;
    }

    try {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;

      const stageWidth = stage?.clientWidth || 900;
      const stageHeight = stage?.clientHeight || 1200;

      const sourceRatio = sourceWidth / sourceHeight;
      const targetRatio = stageWidth / stageHeight;

      let cropWidth = sourceWidth;
      let cropHeight = sourceHeight;
      let cropX = 0;
      let cropY = 0;

      if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio;
        cropX = (sourceWidth - cropWidth) / 2;
      } else {
        cropHeight = sourceWidth / targetRatio;
        cropY = (sourceHeight - cropHeight) / 2;
      }

      const outputWidth = Math.min(
        Math.round(cropWidth),
        1440
      );

      const outputHeight = Math.round(
        outputWidth / targetRatio
      );

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const context = canvas.getContext('2d', {
        alpha: false,
      });

      if (!context) {
        throw new Error('Could not create canvas context.');
      }

      context.save();

      context.filter = getCurrentFilter();

      context.drawImage(
        video,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        outputWidth,
        outputHeight
      );

      context.restore();

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error('Could not create the photo.');
            return;
          }

          const reader = new FileReader();

          reader.onloadend = () => {
            setCapturedImage(reader.result);
            setCapturedVideo(null);
            setCapturedVideoBlob(null);
            setPublishToWall(true);
            setShowPreview(true);
          };

          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.92
      );
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture photo.');
    }
  };

  /* ============================================================
     VIDEO MIME TYPE
  ============================================================ */

  const getSupportedVideoMimeType = () => {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];

    return (
      types.find((type) =>
        MediaRecorder.isTypeSupported(type)
      ) || ''
    );
  };

  /* ============================================================
     START RECORDING
  ============================================================ */

  const startRecording = async () => {
    if (!streamRef.current || !isCameraReady) {
      toast.error('Camera is not ready.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      toast.error(
        'Video recording is not supported on this browser.'
      );
      return;
    }

    if (uploadCount >= uploadLimit) {
      toast.error(
        `Upload limit reached (${uploadLimit}).`
      );
      return;
    }

    if (mediaRecorderRef.current) {
      return;
    }

    try {
      chunksRef.current = [];

      const mimeType = getSupportedVideoMimeType();

      const recorderOptions = mimeType
        ? { mimeType }
        : undefined;

      const recorder = new MediaRecorder(
        streamRef.current,
        recorderOptions
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error(
          'MediaRecorder error:',
          event.error
        );

        toast.error('Video recording failed.');

        setIsRecording(false);
      };

      recorder.onstop = () => {
        try {
          const finalMimeType =
            mimeType || 'video/webm';

          const blob = new Blob(chunksRef.current, {
            type: finalMimeType,
          });

          if (!blob.size) {
            throw new Error('Recorded video is empty.');
          }

          const url = URL.createObjectURL(blob);

          if (previewVideoUrlRef.current) {
            URL.revokeObjectURL(
              previewVideoUrlRef.current
            );
          }

          previewVideoUrlRef.current = url;

          setCapturedVideo(url);
          setCapturedVideoBlob(blob);
          setCapturedImage(null);
          setPublishToWall(true);
          setShowPreview(true);
          setIsRecording(false);
        } catch (error) {
          console.error(
            'Error processing recorded video:',
            error
          );

          toast.error('Could not process your video.');
          setIsRecording(false);
        }

        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;

      recorder.start(500);

      setRecordingTime(0);
      setIsRecording(true);

      toast.success('Recording started');
    } catch (error) {
      console.error(
        'Error starting recording:',
        error
      );

      mediaRecorderRef.current = null;
      setIsRecording(false);

      toast.error('Could not start video recording.');
    }
  };

  /* ============================================================
     STOP RECORDING
  ============================================================ */

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) return;

    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch (error) {
      console.error(
        'Error stopping recorder:',
        error
      );
    }
  };

  /* ============================================================
     SHUTTER
  ============================================================ */

  const handleShutterPress = () => {
    if (mode === 'photo') {
      capturePhoto();
      return;
    }

    if (mode === 'video') {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  /* ============================================================
     RETAKE
  ============================================================ */

  const retake = () => {
    setShowPreview(false);
    setCapturedImage(null);
    setCapturedVideo(null);
    setCapturedVideoBlob(null);

    if (previewVideoUrlRef.current) {
      URL.revokeObjectURL(
        previewVideoUrlRef.current
      );

      previewVideoUrlRef.current = null;
    }

    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
    }, 50);
  };

  /* ============================================================
     SAVE TO PHONE (NO UPLOAD)
  ============================================================ */
  /*
   * Downloads the captured media straight to the guest's
   * device. Does NOT touch Supabase, does NOT count toward
   * the upload limit.
   */

  const saveToPhone = async () => {
    if (!capturedImage && !capturedVideoBlob) {
      toast.error('There is nothing to save.');
      return;
    }

    setUploading(true);

    try {
      let blob;
      let filename;

      if (capturedImage) {
        // Convert base64 → blob
        const response = await fetch(capturedImage);
        blob = await response.blob();
        filename = `snapguest-${Date.now()}.jpg`;
      } else {
        blob = capturedVideoBlob;
        filename = `snapguest-${Date.now()}.${
          capturedVideoBlob?.type?.includes('mp4')
            ? 'mp4'
            : 'webm'
        }`;
      }

      const ok = await saveFileToDevice(blob, filename);

      if (ok) {
        toast.success('Saved to your device 📥');

        // Clean up preview, return to camera
        setShowPreview(false);
        setCapturedImage(null);
        setCapturedVideo(null);
        setCapturedVideoBlob(null);

        if (previewVideoUrlRef.current) {
          URL.revokeObjectURL(previewVideoUrlRef.current);
          previewVideoUrlRef.current = null;
        }

        setTimeout(() => {
          videoRef.current?.play().catch(() => {});
        }, 200);
      }
    } catch (error) {
      console.error('Save-to-phone error:', error);
      toast.error('Could not save to your device.');
    } finally {
      setUploading(false);
    }
  };

  /* ============================================================
     UPLOAD TO LIVE WALL
  ============================================================ */

  const uploadMedia = async () => {
    /* ---------- PATH A: Save to Phone (no upload) ---------- */
    if (!publishToWall) {
      await saveToPhone();
      return;
    }

    /* ---------- PATH B: Upload to Live Wall ---------- */

    if (!event) {
      toast.error('Event is not loaded.');
      return;
    }

    if (!guestSession) {
      toast.error(
        'Your guest session is not ready. Please refresh and try again.'
      );
      return;
    }

    if (uploadCount >= uploadLimit) {
      toast.error(
        `Upload limit reached (${uploadLimit}).`
      );
      return;
    }

    if (!capturedImage && !capturedVideoBlob) {
      toast.error('There is no captured media to upload.');
      return;
    }

    setUploading(true);

    let uploadedPath = null;

    try {
      let fileType;
      let fileExtension;
      let blob;

      if (capturedImage) {
        fileType = 'photo';
        fileExtension = 'jpg';

        const response = await fetch(capturedImage);

        if (!response.ok) {
          throw new Error(
            'Could not prepare the captured photo.'
          );
        }

        blob = await response.blob();
      } else if (capturedVideoBlob) {
        fileType = 'video';

        fileExtension = capturedVideoBlob.type.includes(
          'mp4'
        )
          ? 'mp4'
          : 'webm';

        blob = capturedVideoBlob;
      }

      if (!blob || !blob.size) {
        throw new Error(
          'The captured file is empty.'
        );
      }

      const fileName = `${Date.now()}-${createId()}.${fileExtension}`;

      const file = new File(
        [blob],
        fileName,
        {
          type:
            blob.type ||
            (fileType === 'photo'
              ? 'image/jpeg'
              : 'video/webm'),
        }
      );

      uploadedPath = `events/${event.id}/${fileName}`;

      const { error: storageError } =
        await supabase.storage
          .from('event-media')
          .upload(
            uploadedPath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type,
            }
          );

      if (storageError) {
        throw storageError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('event-media')
          .getPublicUrl(uploadedPath);

      const publicUrl =
        publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error(
          'Could not generate media URL.'
        );
      }

      const { data: mediaRow, error: mediaError } =
        await supabase
          .from('media')
          .insert([
            {
              event_id: event.id,
              type: fileType,
              file_url: publicUrl,
              guest_session_id: guestSession.id,
              approved: true,
            },
          ])
          .select()
          .single();

      if (mediaError) {
        throw mediaError;
      }

      const newCount = uploadCount + 1;

      const { error: sessionError } =
        await supabase
          .from('guest_sessions')
          .update({
            upload_count: newCount,
            last_active_at:
              new Date().toISOString(),
          })
          .eq('id', guestSession.id);

      if (sessionError) {
        console.warn(
          'Media uploaded but guest count could not be updated:',
          sessionError
        );
      }

      setUploadCount(newCount);

      setGuestSession((previous) =>
        previous
          ? {
              ...previous,
              upload_count: newCount,
            }
          : previous
      );

      toast.success(
        `${
          fileType === 'photo'
            ? 'Photo'
            : 'Video'
        } is live! 🎉`
      );

      setShowPreview(false);
      setCapturedImage(null);
      setCapturedVideo(null);
      setCapturedVideoBlob(null);

      if (previewVideoUrlRef.current) {
        URL.revokeObjectURL(
          previewVideoUrlRef.current
        );

        previewVideoUrlRef.current = null;
      }

      console.log('Uploaded media:', mediaRow);
    } catch (error) {
      console.error(
        'Upload error:',
        error
      );

      if (uploadedPath) {
        try {
          await supabase.storage
            .from('event-media')
            .remove([uploadedPath]);
        } catch (cleanupError) {
          console.warn(
            'Could not clean up uploaded file:',
            cleanupError
          );
        }
      }

      toast.error(
        error?.message ||
          'Failed to upload your media.'
      );
    } finally {
      setUploading(false);
    }
  };

  /* ============================================================
     LOAD GALLERY
  ============================================================ */

  const loadGallery = async () => {
    if (!event) {
      toast.error('Event is not loaded.');
      return;
    }

    setGalleryLoading(true);

    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', event.id)
        .eq('approved', true)
        .order('uploaded_at', {
          ascending: false,
        })
        .limit(50);

      if (error) throw error;

      setGalleryMedia(data || []);
      setShowGallery(true);
    } catch (error) {
      console.error(
        'Gallery error:',
        error
      );

      toast.error(
        'Could not load the live gallery.'
      );
    } finally {
      setGalleryLoading(false);
    }
  };

  /* ============================================================
     SHARE EVENT
  ============================================================ */

  const shareEvent = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            event?.name || 'Event',
          text:
            'Capture and share your moments!',
          url,
        });

        return;
      }

      await navigator.clipboard.writeText(url);

      toast.success(
        'Event link copied!'
      );
    } catch (error) {
      console.warn(
        'Share cancelled:',
        error
      );
    }
  };

  /* ============================================================
     RENDER: LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="guest-camera-loading">
        <div className="guest-camera-loader">
          <div className="guest-camera-loader-ring" />
          <span>Preparing camera</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="guest-camera-loading">
        <div className="guest-camera-error-card">
          <div className="guest-camera-error-icon">
            !
          </div>

          <h2>Event not found</h2>

          <p>
            This event may have ended or the
            link may be incorrect.
          </p>

          <Link
            to="/"
            className="guest-camera-primary-button"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (event.status !== 'active') {
    return (
      <div className="guest-camera-page guest-camera-page-closed">
        <div className="guest-camera-closed-card">
          <div className="guest-camera-brand-mark">
            ✦
          </div>

          <span className="guest-camera-eyebrow">
            {event.name}
          </span>

          <h1>
            {event.status === 'closed'
              ? 'Event Closed'
              : 'Coming Soon'}
          </h1>

          <p>
            {event.status === 'closed'
              ? 'Guest uploads are no longer available for this event.'
              : 'This event is not accepting guest uploads yet.'}
          </p>

          <Link
            to={`/e/${eventSlug}/live`}
            className="guest-camera-primary-button"
          >
            <FiTv />
            View Live Wall
          </Link>
        </div>
      </div>
    );
  }

  /* ============================================================
     MAIN UI
  ============================================================ */

  return (
    <div
      className={`guest-camera-page ${
        isRecording
          ? 'guest-camera-recording'
          : ''
      }`}
      style={{
        '--event-primary':
          event.primary_color ||
          '#ffffff',
      }}
    >
      {/* ==========================================
          TOP BAR
      =========================================== */}

      <header className="guest-camera-topbar">
      <Link
  to={`/e/${eventSlug}/gallery`}
  className="guest-camera-icon-button"
  aria-label="View gallery"
>
  <FiArrowLeft size={20} />
</Link>

        <div className="guest-camera-event-info">
          <span className="guest-camera-event-label">
            {event.name}
          </span>

          <span className="guest-camera-event-subtitle">
            Capture the moment
          </span>
        </div>

        <button
          type="button"
          className="guest-camera-icon-button"
          onClick={shareEvent}
          aria-label="Share event"
        >
          <FiShare2 size={18} />
        </button>
      </header>

      {/* ==========================================
          CAMERA AREA
      =========================================== */}

      <main className="guest-camera-main">
        <div
          ref={cameraStageRef}
          className={`guest-camera-stage ${
            isCameraReady
              ? 'is-ready'
              : 'is-loading'
          }`}
        >
          {/* CAMERA VIDEO */}

          <video
            ref={videoRef}
            className={`guest-camera-video ${
              facingMode === 'user'
                ? 'is-front-camera'
                : ''
            }`}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={() => {
              if (
                videoRef.current &&
                videoRef.current.srcObject
              ) {
                videoRef.current
                  .play()
                  .then(() => {
                    setIsCameraReady(true);
                  })
                  .catch(() => {});
              }
            }}
          />

          <div className="guest-camera-vignette" />

          <div className="guest-camera-overlay-top">
            <div className="guest-camera-status-pill">
              <span
                className={`guest-camera-status-dot ${
                  isRecording
                    ? 'recording'
                    : 'ready'
                }`}
              />

              {isRecording
                ? 'REC'
                : 'LIVE'}
            </div>

            {isRecording && (
              <div className="guest-camera-recording-time">
                <FiClock size={14} />
                {formatTime(
                  recordingTime
                )}
                {event.video_max_duration && (
                  <span>
                    /
                    {formatTime(
                      Number(
                        event.video_max_duration
                      )
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {cameraError && (
            <div className="guest-camera-error-overlay">
              <div className="guest-camera-error-icon">
                !
              </div>

              <h3>Camera unavailable</h3>

              <p>{cameraError}</p>

              <button
                type="button"
                className="guest-camera-retry-button"
                onClick={retryCamera}
                disabled={cameraStarting}
              >
                <FiRefreshCw
                  className={
                    cameraStarting
                      ? 'spin'
                      : ''
                  }
                />
                {cameraStarting
                  ? 'Trying...'
                  : 'Try Camera Again'}
              </button>
            </div>
          )}

          {!cameraError &&
            !isCameraReady && (
              <div className="guest-camera-preparing">
                <div className="guest-camera-preparing-spinner" />

                <strong>
                  Preparing your camera
                </strong>

                <span>
                  Allow camera access when
                  prompted
                </span>
              </div>
            )}

          {isCameraReady &&
            !isRecording &&
            showFilters && (
              <div className="guest-camera-filter-panel">
                <div className="guest-camera-filter-panel-title">
                  Choose your look
                </div>

                <div className="guest-camera-filter-list">
                  {Object.keys(FILTERS).map(
                    (filterName) => (
                      <button
                        key={filterName}
                        type="button"
                        className={`guest-camera-filter ${
                          cameraMode ===
                          filterName
                            ? 'active'
                            : ''
                        }`}
                        onClick={() =>
                          setCameraMode(
                            filterName
                          )
                        }
                      >
                        <span
                          className="guest-camera-filter-preview"
                          style={{
                            filter:
                              FILTERS[
                                filterName
                              ],
                          }}
                        >
                          A
                        </span>

                        <span>
                          {
                            FILTER_LABELS[
                              filterName
                            ]
                          }
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

          {isCameraReady && (
            <div className="guest-camera-overlay-bottom">
              <button
                type="button"
                className={`guest-camera-side-button ${
                  showFilters
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setShowFilters(
                    (previous) =>
                      !previous
                  )
                }
                disabled={isRecording}
              >
                <span className="guest-camera-side-button-icon">
                  ✨
                </span>

                <span>
                  {FILTER_LABELS[
                    cameraMode
                  ]}
                </span>
              </button>

              <button
                type="button"
                className={`guest-camera-shutter ${
                  mode === 'video'
                    ? 'video-mode'
                    : ''
                } ${
                  isRecording
                    ? 'recording'
                    : ''
                }`}
                onClick={
                  handleShutterPress
                }
                disabled={
                  cameraStarting ||
                  !isCameraReady ||
                  uploading
                }
                aria-label={
                  mode === 'photo'
                    ? 'Take photo'
                    : isRecording
                    ? 'Stop recording'
                    : 'Start recording'
                }
              >
                <span className="guest-camera-shutter-inner" />
              </button>

              <button
                type="button"
                className="guest-camera-side-button"
                onClick={switchCamera}
                disabled={
                  isRecording ||
                  cameraStarting
                }
              >
                <FiRotateCw size={20} />

                <span>
                  Flip
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="guest-camera-mode-switcher">
          <button
            type="button"
            className={
              mode === 'photo'
                ? 'active'
                : ''
            }
            onClick={() =>
              !isRecording &&
              setMode('photo')
            }
            disabled={isRecording}
          >
            <FiCamera size={16} />
            Photo
          </button>

          <button
            type="button"
            className={
              mode === 'video'
                ? 'active'
                : ''
            }
            onClick={() =>
              !isRecording &&
              setMode('video')
            }
            disabled={isRecording}
          >
            <FiVideo size={16} />
            Video
          </button>
        </div>

        <div className="guest-camera-footer">
          <button
            type="button"
            className="guest-camera-footer-action"
            onClick={loadGallery}
            disabled={galleryLoading}
          >
            <span className="guest-camera-footer-icon">
              {galleryLoading ? (
                <span className="mini-spinner" />
              ) : (
                <FiImage size={19} />
              )}
            </span>

            <span>
              <strong>Live Wall</strong>
              <small>
                See the moments
              </small>
            </span>
          </button>

          <div className="guest-camera-upload-counter">
            <span>
              {uploadCount}
            </span>
            <small>
              / {uploadLimit} uploads
            </small>
          </div>

          <Link
            to={`/e/${eventSlug}/live`}
            className="guest-camera-footer-action"
          >
            <span className="guest-camera-footer-icon">
              <FiTv size={19} />
            </span>

            <span>
              <strong>Wall</strong>
              <small>
                View live
              </small>
            </span>
          </Link>
        </div>

        <button
          type="button"
          className="guest-camera-info-button"
          onClick={() =>
            setShowInfo(
              (previous) =>
                !previous
            )
          }
        >
          <span>ⓘ</span>

          {showInfo
            ? 'Hide camera tips'
            : 'Camera tips'}
        </button>

        {showInfo && (
          <div className="guest-camera-info-panel">
            <div>
              <strong>📸 Photos</strong>
              <span>
                Tap the shutter, review your
                photo, then choose whether
                to post it.
              </span>
            </div>

            <div>
              <strong>🎥 Videos</strong>
              <span>
                Tap once to record and again
                to stop. Your video will
                appear in preview first.
              </span>
            </div>

            <div>
              <strong>✨ Filters</strong>
              <span>
                Try the different looks before
                capturing your moment.
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ==========================================
          PREVIEW
      =========================================== */}

      {showPreview && (
        <div className="guest-camera-preview-screen">
          <div className="guest-camera-preview-topbar">
            <button
              type="button"
              className="guest-camera-preview-close"
              onClick={retake}
              disabled={uploading}
            >
              <FiX size={22} />
            </button>

            <div>
              <span>
                {capturedImage
                  ? 'Photo preview'
                  : 'Video preview'}
              </span>

              <small>
                Review before sharing
              </small>
            </div>

            <span className="guest-camera-preview-number">
              {uploadCount + 1}/
              {uploadLimit}
            </span>
          </div>

          <div className="guest-camera-preview-content">
            <div className="guest-camera-preview-media">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Captured event moment"
                  className="guest-camera-preview-image"
                />
              ) : capturedVideo ? (
                <video
                  src={capturedVideo}
                  className="guest-camera-preview-video"
                  controls
                  autoPlay
                  muted
                  playsInline
                  loop
                />
              ) : null}

              <div className="guest-camera-preview-filter-badge">
                {capturedImage &&
                  FILTER_LABELS[
                    cameraMode
                  ]}
              </div>
            </div>

            {/* PUBLISH CHOICE */}

            <div className="guest-camera-publish-card">
              <div className="guest-camera-publish-heading">
                <div>
                  <strong>
                    What would you like to do?
                  </strong>

                  <span>
                    Choose what happens to this
                    capture.
                  </span>
                </div>

                <span className="guest-camera-publish-icon">
                  {publishToWall
                    ? '✨'
                    : '📥'}
                </span>
              </div>

              <div className="guest-camera-publish-options">
                <button
                  type="button"
                  className={
                    publishToWall
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setPublishToWall(true)
                  }
                  disabled={uploading}
                >
                  <div className="publish-option-icon">
                    <FiTv />
                  </div>

                  <div>
                    <strong>
                      Post to Live Wall
                    </strong>

                    <span>
                      Everyone at the event
                      will see it.
                    </span>
                  </div>

                  <span className="publish-check">
                    {publishToWall && (
                      <FiCheck />
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    !publishToWall
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setPublishToWall(false)
                  }
                  disabled={uploading}
                >
                  <div className="publish-option-icon private">
                    📥
                  </div>

                  <div>
                    <strong>
                      Save to Phone
                    </strong>

                    <span>
                      Keep it for yourself — no
                      upload.
                    </span>
                  </div>

                  <span className="publish-check">
                    {!publishToWall && (
                      <FiCheck />
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* ACTIONS */}

            <div className="guest-camera-preview-actions">
              <button
                type="button"
                className="guest-camera-retake-button"
                onClick={retake}
                disabled={uploading}
              >
                <FiRefreshCw />
                Retake
              </button>

              <button
                type="button"
                className="guest-camera-upload-button"
                onClick={uploadMedia}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="upload-spinner" />
                    {publishToWall
                      ? 'Uploading...'
                      : 'Saving...'}
                  </>
                ) : (
                  <>
                    {publishToWall ? (
                      <>
                        <FiUpload />
                        Post Moment
                      </>
                    ) : (
                      <>
                        <FiDownload />
                        Save to Phone
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          GALLERY DRAWER
      =========================================== */}

      {showGallery && (
        <div className="guest-camera-gallery-overlay">
          <div className="guest-camera-gallery-panel">
            <div className="guest-camera-gallery-header">
              <div>
                <span className="gallery-live-indicator">
                  <span />
                  LIVE
                </span>

                <h2>
                  {event.name}
                </h2>

                <p>
                  Latest moments from the
                  event
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowGallery(false)
                }
                className="guest-camera-gallery-close"
              >
                <FiX size={22} />
              </button>
            </div>

            {galleryMedia.length === 0 ? (
              <div className="guest-camera-gallery-empty">
                <div>📸</div>

                <h3>
                  No moments yet
                </h3>

                <p>
                  Be the first guest to
                  capture one.
                </p>
              </div>
            ) : (
              <div className="guest-camera-gallery-grid">
                {galleryMedia.map(
                  (item) => (
                    <div
                      className="guest-camera-gallery-item"
                      key={item.id}
                    >
                      {item.type ===
                      'photo' ? (
                        <img
                          src={
                            item.file_url
                          }
                          alt="Event moment"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={
                            item.file_url
                          }
                          muted
                          playsInline
                          autoPlay
                          loop
                          preload="metadata"
                        />
                      )}

                      {item.type ===
                        'video' && (
                        <span className="gallery-video-badge">
                          <FiVideo />
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            <Link
              to={`/e/${eventSlug}/live`}
              className="guest-camera-open-wall"
            >
              <FiTv />
              Open Full Live Wall
            </Link>
          </div>
        </div>
      )}

      {/* Hidden canvas used for photo capture */}

      <canvas
        ref={canvasRef}
        className="guest-camera-hidden-canvas"
      />
    </div>
  );
}

export default GuestCamera;