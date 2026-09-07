import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Container, Button, Spinner, Badge } from 'react-bootstrap';
import { 
  FiArrowLeft, 
  FiRefreshCw, 
  FiHeart, 
  FiUsers,
  FiCamera,
  FiVideo,
  FiImage,
  FiTv,
  FiMaximize2,
  FiMinimize2
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function LiveWall() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [stats, setStats] = useState({ photos: 0, videos: 0, total: 0 });
  const slideshowRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    loadEvent();
    loadMedia();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('live-wall')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'media'
        },
        (payload) => {
          // Only show approved media from this event
          if (payload.new.event_id === event?.id && payload.new.approved) {
            const newMedia = {
              id: payload.new.id,
              type: payload.new.type,
              file_url: payload.new.file_url,
              uploaded_at: payload.new.uploaded_at
            };
            setMedia(prev => [newMedia, ...prev]);
            setStats(prev => ({
              ...prev,
              total: prev.total + 1,
              photos: prev.photos + (payload.new.type === 'photo' ? 1 : 0),
              videos: prev.videos + (payload.new.type === 'video' ? 1 : 0)
            }));
            
            // Show notification for new upload
            toast.success('New moment captured! 📸', {
              duration: 2000,
              position: 'bottom-center'
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventSlug]);

  // Auto-slideshow
  useEffect(() => {
    if (autoPlay && media.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % media.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [autoPlay, media.length]);

  // Handle fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const loadEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', eventSlug)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error('Error loading event:', error);
      toast.error('Event not found');
    }
  };

  const loadMedia = async () => {
    try {
      setLoading(true);
      
      // Get event ID first
      const { data: eventData } = await supabase
        .from('events')
        .select('id')
        .eq('slug', eventSlug)
        .single();

      if (!eventData) return;

      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventData.id)
        .eq('approved', true)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setMedia(data || []);
      
      const photos = data?.filter(m => m.type === 'photo').length || 0;
      const videos = data?.filter(m => m.type === 'video').length || 0;
      setStats({
        photos,
        videos,
        total: data?.length || 0
      });

    } catch (error) {
      console.error('Error loading media:', error);
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const getCurrentMedia = () => {
    if (media.length === 0) return null;
    return media[currentIndex];
  };

  const currentItem = getCurrentMedia();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark">
        <Spinner animation="border" variant="light" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="min-vh-100 bg-dark text-white"
      style={{ 
        background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)'
      }}
    >
      {/* Top Bar */}
      <div className="position-absolute top-0 start-0 end-0 p-3 p-md-4" style={{ zIndex: 100, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-3">
            <Link to={`/e/${eventSlug}`} className="text-white text-decoration-none">
              <Button variant="outline-light" size="sm" className="rounded-pill px-3">
                <FiArrowLeft size={16} className="me-1" />
                Back
              </Button>
            </Link>
            <div>
              <h5 className="fw-bold mb-0">{event?.name}</h5>
              <div className="d-flex gap-3 text-white-50 small">
                <span>{stats.total} moments</span>
                <span>•</span>
                <span>{stats.photos} photos</span>
                <span>•</span>
                <span>{stats.videos} videos</span>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-light"
              size="sm"
              onClick={toggleFullscreen}
              className="rounded-pill px-3"
            >
              {isFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Display */}
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', padding: '80px 20px 100px' }}>
        {media.length === 0 ? (
          <div className="text-center">
            <div className="display-1 mb-4">🎉</div>
            <h3 className="fw-bold mb-2">Waiting for Moments</h3>
            <p className="text-white-50">
              Photos and videos will appear here as guests upload them
            </p>
            <div className="mt-3">
              <div className="d-flex gap-3 justify-content-center">
                <div className="bg-white bg-opacity-10 rounded-3 p-3">
                  <FiCamera size={24} className="d-block mx-auto mb-1" />
                  <small>Scan QR to upload</small>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="position-relative w-100" style={{ maxWidth: '1200px' }}>
            {/* Main Media Display */}
            <div className="position-relative rounded-4 overflow-hidden" style={{ 
              aspectRatio: '16/9',
              backgroundColor: 'rgba(0,0,0,0.4)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              {currentItem && (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center">
                  {currentItem.type === 'photo' ? (
                    <img
                      src={currentItem.file_url}
                      alt="Event moment"
                      className="w-100 h-100"
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <video
                      src={currentItem.file_url}
                      controls
                      autoPlay
                      muted
                      className="w-100 h-100"
                      style={{ objectFit: 'contain' }}
                    />
                  )}
                </div>
              )}

              {/* Overlay Controls */}
              <div className="position-absolute bottom-0 start-0 end-0 p-4" style={{ 
                background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)'
              }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <Badge bg="light" className="text-dark px-3 py-2">
                      {currentItem?.type === 'photo' ? '📸 Photo' : '🎥 Video'}
                    </Badge>
                    <span className="text-white-50 ms-2 small">
                      {new Date(currentItem?.uploaded_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-light"
                      size="sm"
                      onClick={() => setAutoPlay(!autoPlay)}
                      className="rounded-pill px-3"
                    >
                      {autoPlay ? '⏸️ Pause' : '▶️ Play'}
                    </Button>
                    <Button
                      variant="outline-light"
                      size="sm"
                      onClick={() => setCurrentIndex(prev => (prev - 1 + media.length) % media.length)}
                      className="rounded-pill px-3"
                      disabled={media.length <= 1}
                    >
                      ◀ Prev
                    </Button>
                    <Button
                      variant="outline-light"
                      size="sm"
                      onClick={() => setCurrentIndex(prev => (prev + 1) % media.length)}
                      className="rounded-pill px-3"
                      disabled={media.length <= 1}
                    >
                      Next ▶
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            {media.length > 1 && (
              <div className="mt-3 hide-scrollbar" style={{ overflowX: 'auto' }}>
                <div className="d-flex gap-2" style={{ width: 'max-content' }}>
                  {media.map((item, index) => (
                    <div
                      key={item.id}
                      className={`rounded-3 overflow-hidden cursor-pointer ${index === currentIndex ? 'ring-2 ring-primary' : 'opacity-70'}`}
                      style={{ width: '80px', height: '60px', flexShrink: 0 }}
                      onClick={() => setCurrentIndex(index)}
                    >
                      {item.type === 'photo' ? (
                        <img
                          src={item.file_url}
                          alt={`Thumbnail ${index}`}
                          className="w-100 h-100"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : (
                        <div className="w-100 h-100 bg-dark d-flex align-items-center justify-content-center">
                          <FiVideo size={20} className="text-white-50" />
                        </div>
                      )}
                      {index === currentIndex && (
                        <div className="position-absolute top-0 start-0 end-0 bottom-0 bg-primary bg-opacity-25" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Stats Bar */}
      <div className="position-absolute bottom-0 start-0 end-0 p-3" style={{ 
        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        zIndex: 100
      }}>
        <div className="d-flex justify-content-center gap-4 text-white-50 small">
          <span className="d-flex align-items-center gap-1">
            <FiUsers size={14} />
            {Math.max(1, Math.floor(media.length / 3))} contributors
          </span>
          <span className="d-flex align-items-center gap-1">
            <FiHeart size={14} />
            {media.length} moments
          </span>
          <span className="d-flex align-items-center gap-1">
            <FiTv size={14} />
            Live
          </span>
        </div>
      </div>

      {/* Live Indicator */}
      <div className="position-absolute top-0 end-0 m-3 m-md-4" style={{ zIndex: 101 }}>
        <span className="badge bg-danger animate-pulse d-flex align-items-center gap-1 px-3 py-2">
          <span className="d-inline-block rounded-circle bg-white" style={{ width: '8px', height: '8px' }} />
          LIVE
        </span>
      </div>
    </div>
  );
}

export default LiveWall;