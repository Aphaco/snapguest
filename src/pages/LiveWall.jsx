import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Spinner, Badge } from 'react-bootstrap';
import { 
  FiArrowLeft, 
  FiMaximize2, 
  FiMinimize2,
  FiImage,
  FiVideo,
  FiCamera
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
  const [stats, setStats] = useState({ photos: 0, videos: 0, total: 0 });
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
      <div className="live-wall-loading">
        <Spinner animation="border" variant="light" />
      </div>
    );
  }

  return (
    <div className="live-wall-container">
      {/* Top Bar */}
      <div className="live-wall-top-bar">
        <div className="live-wall-header">
          <Link to={`/e/${eventSlug}`} className="live-wall-back">
            <FiArrowLeft size={18} />
            <span className="d-none d-sm-inline">Back</span>
          </Link>
          <div className="live-wall-title">
            <h5 className="live-wall-name">{event?.name}</h5>
            <div className="live-wall-stats">
              <span>{stats.total} moments</span>
              <span>•</span>
              <span>{stats.photos} photos</span>
              <span>•</span>
              <span>{stats.videos} videos</span>
            </div>
          </div>
        </div>
        <button
          className="live-wall-fullscreen"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
        </button>
      </div>

      {/* Main Display */}
      <div className="live-wall-main">
        {media.length === 0 ? (
          <div className="live-wall-empty">
            <div className="live-wall-empty-icon">🎉</div>
            <h3 className="live-wall-empty-title">Waiting for Moments</h3>
            <p className="live-wall-empty-text">
              Photos and videos will appear here as guests upload them
            </p>
            <div className="live-wall-empty-hint">
              <FiCamera size={20} />
              <span>Scan QR to upload</span>
            </div>
          </div>
        ) : (
          <div className="live-wall-media-wrapper">
            <div className="live-wall-media">
              {currentItem && (
                <>
                  {currentItem.type === 'photo' ? (
                    <img
                      src={currentItem.file_url}
                      alt="Event moment"
                      className="live-wall-image"
                    />
                  ) : (
                    <video
                      src={currentItem.file_url}
                      controls
                      autoPlay
                      muted
                      className="live-wall-video"
                    />
                  )}
                </>
              )}
            </div>

            {/* Mobile Controls - Bottom */}
            <div className="live-wall-mobile-controls">
              <button
                className="live-wall-control-btn"
                onClick={() => setAutoPlay(!autoPlay)}
              >
                {autoPlay ? '⏸' : '▶'}
              </button>
              <button
                className="live-wall-control-btn"
                onClick={() => setCurrentIndex(prev => (prev - 1 + media.length) % media.length)}
                disabled={media.length <= 1}
              >
                ◀
              </button>
              <span className="live-wall-counter">
                {currentIndex + 1}/{media.length}
              </span>
              <button
                className="live-wall-control-btn"
                onClick={() => setCurrentIndex(prev => (prev + 1) % media.length)}
                disabled={media.length <= 1}
              >
                ▶
              </button>
            </div>

            {/* Badge */}
            <div className="live-wall-badge">
              <span className="live-wall-live-dot"></span>
              LIVE
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails - Desktop Only */}
      {media.length > 1 && (
        <div className="live-wall-thumbnails">
          <div className="live-wall-thumbnails-scroll">
            {media.map((item, index) => (
              <div
                key={item.id}
                className={`live-wall-thumbnail ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              >
                {item.type === 'photo' ? (
                  <img src={item.file_url} alt={`Thumbnail ${index}`} />
                ) : (
                  <div className="live-wall-thumbnail-video">
                    <FiVideo size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveWall;