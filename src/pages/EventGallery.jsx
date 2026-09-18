import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Spinner } from 'react-bootstrap';
import JSZip from 'jszip';
import {
  FiArrowLeft,
  FiImage,
  FiVideo,
  FiDownload,
  FiX,
  FiShare2,
  FiCamera,
  FiGrid,
  FiChevronLeft,
  FiChevronRight,
  FiArchive
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './EventGallery.css';

function EventGallery() {
  const { eventSlug } = useParams();

  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'photo' | 'video'
  const [downloading, setDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(null); // null or percent

  const touchStartX = useRef(null);

  /* ============================================================
     LOAD
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
     FILTERED MEDIA
  ============================================================ */

  const filteredMedia =
    filter === 'all'
      ? media
      : media.filter((item) => item.type === filter);

  const photoCount = media.filter((m) => m.type === 'photo').length;
  const videoCount = media.filter((m) => m.type === 'video').length;

  /* ============================================================
     DOWNLOAD SINGLE
  ============================================================ */

  const downloadSingle = async (item) => {
    if (downloading) return;
    setDownloading(true);

    try {
      const url = item.file_url;
      const ext = item.type === 'photo' ? 'jpg' : 'webm';
      const filename = `snapguest-${item.id.slice(0, 8)}.${ext}`;

      const response = await fetch(url);
      const blob = await response.blob();

      /* Try Web Share API first (best on iOS) */
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], filename, {
          type: blob.type || 'application/octet-stream'
        });

        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'SnapGuest moment'
            });
            toast.success('Saved to your device 📥');
            setDownloading(false);
            return;
          } catch (err) {
            if (err?.name === 'AbortError') {
              setDownloading(false);
              return;
            }
          }
        }
      }

      /* Fallback: anchor download */
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      toast.success('Saved to your device 📥');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Could not download this moment.');
    } finally {
      setDownloading(false);
    }
  };

  /* ============================================================
     DOWNLOAD ALL (ZIP)
  ============================================================ */

  const downloadAll = async () => {
    if (!media.length || zipProgress !== null) return;

    setZipProgress(0);

    const zip = new JSZip();

    try {
      const total = media.length;

      for (let i = 0; i < total; i++) {
        const item = media[i];

        try {
          const response = await fetch(item.file_url);
          const blob = await response.blob();

          const ext = item.type === 'photo' ? 'jpg' : 'webm';
          const filename = `${String(i + 1).padStart(3, '0')}-${item.id.slice(
            0,
            8
          )}.${ext}`;

          zip.file(filename, blob);
        } catch (err) {
          console.warn('Skipped item:', item.id, err);
        }

        setZipProgress(Math.round(((i + 1) / total) * 80));
      }

      setZipProgress(85);

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        },
        (metadata) => {
          // metadata.percent goes 0-100 during zip compression
          const p = 85 + Math.round((metadata.percent / 100) * 15);
          setZipProgress(Math.min(p, 100));
        }
      );

      /* Download the ZIP */
      const safeName =
        (event?.name || 'snapguest-event')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'snapguest-event';

      const filename = `${safeName}-moments.zip`;

      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

      toast.success('ZIP downloaded 📦');
    } catch (error) {
      console.error('ZIP error:', error);
      toast.error('Could not create the ZIP file.');
    } finally {
      setZipProgress(null);
    }
  };

  /* ============================================================
     SHARE
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
     LIGHTBOX
  ============================================================ */

  const openLightbox = (index) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  const goPrev = () => {
    if (selectedIndex === null) return;
    setSelectedIndex(
      (selectedIndex - 1 + filteredMedia.length) % filteredMedia.length
    );
  };

  const goNext = () => {
    if (selectedIndex === null) return;
    setSelectedIndex((selectedIndex + 1) % filteredMedia.length);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;

    const deltaX = e.changedTouches[0].screenX - touchStartX.current;

    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goPrev();
      } else {
        goNext();
      }
    }

    touchStartX.current = null;
  };

  useEffect(() => {
    if (selectedIndex === null) return;

    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape') closeLightbox();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex, filteredMedia.length]);

  /* ============================================================
     RENDER: LOADING
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
     RENDER
  ============================================================ */

  const currentItem =
    selectedIndex !== null ? filteredMedia[selectedIndex] : null;

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
            className="event-gallery-zip-button"
            onClick={downloadAll}
            disabled={zipProgress !== null}
          >
            {zipProgress !== null ? (
              <>
                <span className="mini-spinner light" />
                {zipProgress}%
              </>
            ) : (
              <>
                <FiArchive size={14} />
                Download All
              </>
            )}
          </button>
        )}
      </div>

      {/* ==========================================
          GRID
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
            {filteredMedia.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="event-gallery-item"
                onClick={() => openLightbox(index)}
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
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ==========================================
          LIGHTBOX
      =========================================== */}

      {currentItem && (
        <div
          className="event-gallery-lightbox"
          onClick={closeLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="event-gallery-lightbox-topbar"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="event-gallery-lightbox-counter">
              {selectedIndex + 1} / {filteredMedia.length}
            </span>

            <div className="event-gallery-lightbox-actions">
              <button
                type="button"
                className="event-gallery-lightbox-action"
                onClick={() => downloadSingle(currentItem)}
                disabled={downloading}
                title="Download this"
              >
                {downloading ? (
                  <span className="mini-spinner light" />
                ) : (
                  <FiDownload size={20} />
                )}
              </button>

              <button
                type="button"
                className="event-gallery-lightbox-action"
                onClick={closeLightbox}
                title="Close"
              >
                <FiX size={22} />
              </button>
            </div>
          </div>

          <div
            className="event-gallery-lightbox-media"
            onClick={(e) => e.stopPropagation()}
          >
            {currentItem.type === 'photo' ? (
              <img src={currentItem.file_url} alt="Event moment" />
            ) : (
              <video
                src={currentItem.file_url}
                controls
                autoPlay
                playsInline
              />
            )}
          </div>

          {filteredMedia.length > 1 && (
            <>
              <button
                type="button"
                className="event-gallery-lightbox-nav prev"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                aria-label="Previous"
              >
                <FiChevronLeft size={26} />
              </button>

              <button
                type="button"
                className="event-gallery-lightbox-nav next"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                aria-label="Next"
              >
                <FiChevronRight size={26} />
              </button>
            </>
          )}

          <div
            className="event-gallery-lightbox-hint"
            onClick={(e) => e.stopPropagation()}
          >
            Swipe or use arrows · tap the download icon to save
          </div>
        </div>
      )}
    </div>
  );
}

export default EventGallery;