import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Spinner } from 'react-bootstrap';
import {
  FiArrowLeft,
  FiImage,
  FiVideo,
  FiDownload,
  FiX,
  FiShare2,
  FiCamera,
  FiGrid,
  FiMaximize2
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './EventGallery.css';

function EventGallery() {
  const { eventSlug } = useParams();

  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'photo' | 'video'

  const [downloadingAll, setDownloadingAll] = useState(false);

  /* ============================================================
     LOAD EVENT + MEDIA
     ============================================================ */

  useEffect(() => {
    loadEventAndMedia();
  }, [eventSlug]);

  const loadEventAndMedia = async () => {
    try {
      setLoading(true);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', eventSlug)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        toast.error('Event not found');
        return;
      }

      setEvent(eventData);

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('event_id', eventData.id)
        .eq('approved', true)
        .order('uploaded_at', { ascending: false });

      if (mediaError) throw mediaError;
      setMedia(mediaData || []);
    } catch (error) {
      console.error('Error loading gallery:', error);
      toast.error('Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     DOWNLOAD SINGLE
     ============================================================ */

  const downloadSingle = async (item) => {
    try {
      const url = item.file_url;
      const ext = item.type === 'photo' ? 'jpg' : 'webm';
      const filename = `snapguest-${item.id.slice(0, 8)}.${ext}`;

      // Fetch the file as a blob so we can force-download it
      const response = await fetch(url);
      const blob = await response.blob();

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(blobUrl);

      toast.success('Saved to your device 📥');
    } catch (error) {
      console.error('Download error:', error);

      // Fallback: open in new tab
      window.open(item.file_url, '_blank');
    }
  };

  /* ============================================================
     DOWNLOAD ALL
     ============================================================ */

  const downloadAll = async () => {
    if (!media.length) return;

    setDownloadingAll(true);
    toast.success('Starting download…');

    try {
      // Download sequentially to avoid overwhelming the browser
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        await downloadSingle(item);

        // Small delay so the browser doesn't block rapid downloads
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      toast.success('All moments downloaded! 🎉');
    } catch (error) {
      console.error('Download all error:', error);
      toast.error('Some downloads may have failed.');
    } finally {
      setDownloadingAll(false);
    }
  };

  /* ============================================================
     SHARE GALLERY LINK
     ============================================================ */

  const shareGallery = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.name || 'Event Gallery',
          text: 'Revisit the moments from our event 📸',
          url
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast.success('Gallery link copied!');
    } catch (error) {
      console.warn('Share cancelled:', error);
    }
  };

  /* ============================================================
     FILTERED MEDIA
     ============================================================ */

  const filteredMedia =
    filter === 'all'
      ? media
      : media.filter((item) => item.type === filter);

  const photoCount = media.filter((m) => m.type === 'photo').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="event-gallery-loading">
        <div className="event-gallery-loading-mark">✦</div>
        <Spinner animation="border" />
        <p>Loading gallery…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-gallery-loading">
        <div className="event-gallery-empty-card">
          <div className="event-gallery-empty-icon">📸</div>
          <h2>Event not found</h2>
          <p>This link may have expired or is incorrect.</p>
          <Link to="/" className="event-gallery-primary-button">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  /* ============================================================
     MAIN RENDER
     ============================================================ */

  return (
    <div className="event-gallery-page">
      {/* ==========================================
          HEADER
      =========================================== */}

      <header className="event-gallery-header">
        <Link to={`/e/${eventSlug}`} className="event-gallery-icon-button">
          <FiArrowLeft size={20} />
        </Link>

        <div className="event-gallery-title-block">
          <h1>{event.name}</h1>
          <p>
            {media.length} moments · {photoCount} photos · {videoCount} videos
          </p>
        </div>

        <button
          type="button"
          className="event-gallery-icon-button"
          onClick={shareGallery}
          aria-label="Share gallery"
        >
          <FiShare2 size={18} />
        </button>
      </header>

      {/* ==========================================
          TOOLBAR
      =========================================== */}

      <div className="event-gallery-toolbar">
        <div className="event-gallery-filters">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            <FiGrid size={14} />
            All
          </button>

          <button
            type="button"
            className={filter === 'photo' ? 'active' : ''}
            onClick={() => setFilter('photo')}
          >
            <FiImage size={14} />
            Photos
          </button>

          <button
            type="button"
            className={filter === 'video' ? 'active' : ''}
            onClick={() => setFilter('video')}
          >
            <FiVideo size={14} />
            Videos
          </button>
        </div>

        {media.length > 0 && (
          <button
            type="button"
            className="event-gallery-download-all"
            onClick={downloadAll}
            disabled={downloadingAll}
          >
            {downloadingAll ? (
              <>
                <Spinner animation="border" size="sm" />
                Downloading…
              </>
            ) : (
              <>
                <FiDownload size={14} />
                Download All
              </>
            )}
          </button>
        )}
      </div>

      {/* ==========================================
          CONTENT
      =========================================== */}

      <main className="event-gallery-content">
        {filteredMedia.length === 0 ? (
          <div className="event-gallery-empty">
            <div className="event-gallery-empty-icon">🖼️</div>
            <h3>
              {media.length === 0
                ? 'No moments yet'
                : 'Nothing in this filter'}
            </h3>
            <p>
              {media.length === 0
                ? 'Be the first to capture a memory at this event.'
                : 'Try selecting a different filter.'}
            </p>

            {media.length === 0 && (
              <Link
                to={`/e/${eventSlug}`}
                className="event-gallery-primary-button"
              >
                <FiCamera size={16} />
                Open Camera
              </Link>
            )}
          </div>
        ) : (
          <div className="event-gallery-grid">
            {filteredMedia.map((item) => (
              <button
                key={item.id}
                type="button"
                className="event-gallery-item"
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === 'photo' ? (
                  <img
                    src={item.file_url}
                    alt="Event moment"
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

                {item.type === 'video' && (
                  <span className="event-gallery-video-badge">
                    <FiVideo size={12} />
                  </span>
                )}

                <span className="event-gallery-zoom-hint">
                  <FiMaximize2 size={12} />
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ==========================================
          FULLSCREEN VIEWER
      =========================================== */}

      {selectedMedia && (
        <div
          className="event-gallery-viewer"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="event-gallery-viewer-topbar">
            <span className="event-gallery-viewer-counter">
              {filteredMedia.findIndex((m) => m.id === selectedMedia.id) + 1}
              {' / '}
              {filteredMedia.length}
            </span>

            <div className="event-gallery-viewer-actions">
              <button
                type="button"
                className="event-gallery-viewer-action"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadSingle(selectedMedia);
                }}
                title="Download"
              >
                <FiDownload size={20} />
              </button>

              <button
                type="button"
                className="event-gallery-viewer-action"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMedia(null);
                }}
                title="Close"
              >
                <FiX size={22} />
              </button>
            </div>
          </div>

          <div
            className="event-gallery-viewer-media"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMedia.type === 'photo' ? (
              <img
                src={selectedMedia.file_url}
                alt="Event moment"
              />
            ) : (
              <video
                src={selectedMedia.file_url}
                controls
                autoPlay
                playsInline
              />
            )}
          </div>

          <div className="event-gallery-viewer-hint">
            Tap the download icon to save this to your phone
          </div>
        </div>
      )}
    </div>
  );
}

export default EventGallery;