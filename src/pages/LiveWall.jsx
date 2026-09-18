import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Spinner } from 'react-bootstrap';
import {
  FiArrowLeft,
  FiMaximize2,
  FiMinimize2,
  FiCamera,
  FiVideo,
  FiPause,
  FiPlay,
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiX
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './LiveWall.css';

function LiveWall() {
  const { eventSlug } = useParams();

  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [newMoment, setNewMoment] = useState(false);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const slideshowTimerRef = useRef(null);

  const stats = {
    photos: media.filter(item => item.type === 'photo').length,
    videos: media.filter(item => item.type === 'video').length,
    total: media.length
  };

  const currentItem = media[currentIndex] || null;

  // ============================================================
  // LOAD EVENT + MEDIA
  // ============================================================

  const loadEventAndMedia = useCallback(async () => {
    try {
      setLoading(true);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', eventSlug)
        .single();

      if (eventError) throw eventError;

      setEvent(eventData);

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventData.id)
        .eq('approved', true)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      if (mediaError) throw mediaError;

      setMedia(mediaData || []);
      setCurrentIndex(0);

    } catch (error) {
      console.error('Live wall loading error:', error);
      toast.error('Unable to load live wall');
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadEventAndMedia();
  }, [loadEventAndMedia]);

  // ============================================================
  // REALTIME SUBSCRIPTION
  // ============================================================

  useEffect(() => {
    if (!event?.id) return;

    console.log('📡 Starting Live Wall realtime for:', event.id);

    const channel = supabase
      .channel(`live-wall-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'media',
          filter: `event_id=eq.${event.id}`
        },
        (payload) => {
          const newMedia = payload.new;

          console.log('📸 New media received:', newMedia);

          // Only display approved media
          if (!newMedia?.approved) {
            console.log('Media not approved yet — ignoring');
            return;
          }

          setMedia(prev => {
            if (prev.some(item => item.id === newMedia.id)) {
              return prev;
            }

            return [newMedia, ...prev];
          });

          setCurrentIndex(0);

          // Trigger new moment animation
          setNewMoment(true);

          setTimeout(() => {
            setNewMoment(false);
          }, 1800);

          toast.success(
            newMedia.type === 'video'
              ? '🎥 New video just arrived!'
              : '📸 New moment just arrived!',
            {
              duration: 1800,
              position: 'bottom-center'
            }
          );
        }
      )
      .subscribe((status) => {
        console.log('📡 Live Wall realtime status:', status);
      });

    return () => {
      console.log('📡 Closing Live Wall realtime');

      supabase.removeChannel(channel);
    };
  }, [event?.id]);

  // ============================================================
  // AUTO SLIDESHOW
  // ============================================================

  useEffect(() => {
    if (slideshowTimerRef.current) {
      clearTimeout(slideshowTimerRef.current);
    }

    if (!autoPlay || media.length <= 1 || !currentItem) {
      return;
    }

    // Give videos more time to play
    const delay = currentItem.type === 'video' ? 8000 : 5000;

    slideshowTimerRef.current = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % media.length);
    }, delay);

    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  }, [autoPlay, currentIndex, media.length, currentItem]);

  // ============================================================
  // FULLSCREEN
  // ============================================================

  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreen);

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreen
      );
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // ============================================================
  // NAVIGATION
  // ============================================================

  const nextMedia = () => {
    if (!media.length) return;

    setCurrentIndex(prev => (prev + 1) % media.length);
  };

  const previousMedia = () => {
    if (!media.length) return;

    setCurrentIndex(
      prev => (prev - 1 + media.length) % media.length
    );
  };

  const goToMedia = (index) => {
    setCurrentIndex(index);
  };

  // ============================================================
  // VIDEO AUTOPLAY
  // ============================================================

  useEffect(() => {
    if (!videoRef.current || currentItem?.type !== 'video') {
      return;
    }

    const video = videoRef.current;

    video.currentTime = 0;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (error) {
        console.log('Autoplay blocked:', error);
      }
    };

    playVideo();
  }, [currentItem]);

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="live-wall-loading">
        <div className="live-wall-loading-content">
          <div className="live-wall-loading-logo">
            ✦
          </div>

          <Spinner animation="border" variant="light" />

          <p>Preparing the live wall...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div
      ref={containerRef}
      className={`live-wall-container ${
        isFullscreen ? 'live-wall-fullscreen-mode' : ''
      }`}
    >

      {/* ========================================================
          BACKGROUND
      ======================================================== */}

      <div className="live-wall-background">
        <div className="live-wall-orb live-wall-orb-one" />
        <div className="live-wall-orb live-wall-orb-two" />
      </div>

      {/* ========================================================
          TOP BAR
      ======================================================== */}

      <header className="live-wall-top-bar">

        <div className="live-wall-brand-area">

          <Link
            to={`/e/${eventSlug}`}
            className="live-wall-back"
          >
            <FiArrowLeft size={17} />
          </Link>

          <div className="live-wall-event-info">

            <div className="live-wall-event-label">
              LIVE EVENT WALL
            </div>

            <h1>
              {event?.name || 'Event'}
            </h1>

            <div className="live-wall-stats">
              <span>
                <strong>{stats.total}</strong> moments
              </span>

              <span className="live-wall-dot-divider">
                •
              </span>

              <span>
                <FiCamera size={12} />
                {stats.photos}
              </span>

              <span>
                <FiVideo size={12} />
                {stats.videos}
              </span>
            </div>

          </div>

        </div>

        <div className="live-wall-top-actions">

          <div className="live-status">
            <span />
            LIVE
          </div>

          <button
            className="live-wall-icon-btn"
            onClick={() => setShowThumbnails(prev => !prev)}
            title="Toggle gallery"
          >
            {showThumbnails ? (
              <FiX size={18} />
            ) : (
              <FiGrid size={18} />
            )}
          </button>

          <button
            className="live-wall-icon-btn"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            {isFullscreen ? (
              <FiMinimize2 size={18} />
            ) : (
              <FiMaximize2 size={18} />
            )}
          </button>

        </div>

      </header>

      {/* ========================================================
          MAIN
      ======================================================== */}

      <main className="live-wall-main">

        {media.length === 0 ? (

          <div className="live-wall-empty">

            <div className="live-wall-empty-icon">
              <FiCamera size={42} />
            </div>

            <div className="live-wall-empty-eyebrow">
              WAITING FOR THE FIRST MOMENT
            </div>

            <h2>
              The wall is ready.
            </h2>

            <p>
              Guests can scan the event QR code and start
              capturing memories.
            </p>

            <div className="live-wall-scan-hint">
              <span className="scan-icon">
                ✦
              </span>

              <span>
                Scan QR → Capture → Share
              </span>
            </div>

          </div>

        ) : (

          <div className="live-wall-stage">

            {/* ==================================================
                MEDIA
            ================================================== */}

            <div
              className={`live-wall-media-frame ${
                newMoment ? 'new-moment-animation' : ''
              }`}
            >

              <div className="live-wall-media-inner">

                {currentItem?.type === 'photo' ? (

                  <img
                    key={currentItem.id}
                    src={currentItem.file_url}
                    alt="Event moment"
                    className="live-wall-image"
                    draggable="false"
                  />

                ) : (

                  <video
                    key={currentItem.id}
                    ref={videoRef}
                    src={currentItem.file_url}
                    className="live-wall-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    controls={false}
                    onEnded={() => {
                      if (autoPlay) {
                        nextMedia();
                      }
                    }}
                    onError={(e) => {
                      console.error(
                        'Live wall video error:',
                        e
                      );
                    }}
                  />

                )}

                {/* Vignette */}
                <div className="live-wall-vignette" />

                {/* Media type */}
                <div className="live-wall-media-type">

                  {currentItem?.type === 'video' ? (
                    <>
                      <FiVideo size={13} />
                      VIDEO
                    </>
                  ) : (
                    <>
                      <FiCamera size={13} />
                      PHOTO
                    </>
                  )}

                </div>

                {/* Live badge */}
                <div className="live-wall-live-badge">
                  <span />
                  LIVE
                </div>

              </div>

              {/* =================================================
                  NAVIGATION
              ================================================= */}

              {media.length > 1 && (
                <>
                  <button
                    className="live-wall-side-btn left"
                    onClick={previousMedia}
                    aria-label="Previous"
                  >
                    <FiChevronLeft size={25} />
                  </button>

                  <button
                    className="live-wall-side-btn right"
                    onClick={nextMedia}
                    aria-label="Next"
                  >
                    <FiChevronRight size={25} />
                  </button>
                </>
              )}

              {/* =================================================
                  BOTTOM CONTROL BAR
              ================================================= */}

              <div className="live-wall-control-bar">

                <button
                  className="live-wall-control"
                  onClick={() => setAutoPlay(prev => !prev)}
                  title={
                    autoPlay
                      ? 'Pause slideshow'
                      : 'Play slideshow'
                  }
                >
                  {autoPlay ? (
                    <FiPause size={17} />
                  ) : (
                    <FiPlay size={17} />
                  )}
                </button>

                <div className="live-wall-progress">

                  {media.map((item, index) => (
                    <button
                      key={item.id}
                      className={`live-wall-progress-segment ${
                        index === currentIndex
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => goToMedia(index)}
                      aria-label={`View moment ${index + 1}`}
                    />
                  ))}

                </div>

                <div className="live-wall-position">
                  {String(currentIndex + 1).padStart(2, '0')}
                  {' / '}
                  {String(media.length).padStart(2, '0')}
                </div>

              </div>

            </div>

            {/* ==================================================
                CAPTION
            ================================================== */}

            <div className="live-wall-caption">

              <div>
                <span className="caption-label">
                  CAPTURED AT THE EVENT
                </span>

                <span className="caption-line" />
              </div>

              <span className="caption-number">
                #{String(media.length - currentIndex).padStart(3, '0')}
              </span>

            </div>

          </div>
        )}

      </main>

      {/* ========================================================
          THUMBNAIL STRIP
      ======================================================== */}

      {showThumbnails && media.length > 1 && (

        <aside className="live-wall-thumbnails">

          <div className="live-wall-thumbnails-header">

            <span>
              RECENT MOMENTS
            </span>

            <span>
              {media.length}
            </span>

          </div>

          <div className="live-wall-thumbnails-scroll">

            {media.map((item, index) => (

              <button
                key={item.id}
                className={`live-wall-thumbnail ${
                  index === currentIndex
                    ? 'active'
                    : ''
                }`}
                onClick={() => goToMedia(index)}
              >

                {item.type === 'photo' ? (

                  <img
                    src={item.file_url}
                    alt={`Moment ${index + 1}`}
                    loading="lazy"
                  />

                ) : (

                  <video
                    src={item.file_url}
                    muted
                    playsInline
                    preload="metadata"
                  />

                )}

                <span className="thumbnail-type">

                  {item.type === 'video' ? (
                    <FiVideo size={10} />
                  ) : (
                    <FiCamera size={10} />
                  )}

                </span>

              </button>

            ))}

          </div>

        </aside>
      )}

      {/* ========================================================
          BOTTOM BRAND
      ======================================================== */}

      <div className="live-wall-footer">
        <span>POWERED BY</span>
        <strong>SNAPGUEST</strong>
      </div>

    </div>
  );
}

export default LiveWall;