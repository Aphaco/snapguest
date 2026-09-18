import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

import {
  FiArrowLeft,
  FiSave,
  FiTrash2,
  FiSliders,
  FiCheck,
  FiDownload,
  FiImage,
  FiVideo,
  FiUsers,
  FiCalendar,
  FiCopy,
  FiEye,
  FiTv,
  FiCamera,
  FiExternalLink,
  FiShare2
} from 'react-icons/fi';

import { FaQrcode } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import './EditEvent.css';

/* ============================================================
   CAMERA FILTER OPTIONS
   ============================================================ */

const CAMERA_MODES = [
  {
    key: 'original',
    label: 'Original',
    description: 'Natural'
  },
  {
    key: 'disposable',
    label: 'Disposable',
    description: 'Fun & flash'
  },
  {
    key: 'film',
    label: 'Film',
    description: 'Soft & timeless'
  },
  {
    key: 'retro',
    label: 'Retro',
    description: 'Vintage'
  },
  {
    key: 'warm',
    label: 'Warm',
    description: 'Golden'
  },
  {
    key: 'cool',
    label: 'Cool',
    description: 'Clean'
  },
  {
    key: 'noir',
    label: 'Noir',
    description: 'Classic'
  }
];

function EditEvent() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [event, setEvent] = useState(null);

  const [mediaStats, setMediaStats] = useState({
    photos: 0,
    videos: 0,
    total: 0,
    guests: 0
  });

  const [showQR, setShowQR] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    event_date: '',
    description: '',
    guest_upload_limit: 10,
    video_max_duration: 15,
    status: 'active',
    camera_modes: [
      'original',
      'disposable',
      'film',
      'retro'
    ],
    primary_color: '#8b5cf6'
  });

  /* ============================================================
     FETCH
     ============================================================ */

  const fetchEvent = async () => {
    try {
      setLoading(true);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) {
        throw eventError;
      }

      if (!eventData) {
        throw new Error('Event not found');
      }

      setEvent(eventData);

      setFormData({
        name: eventData.name || '',
        slug: eventData.slug || '',
        event_date: eventData.event_date || '',
        description: eventData.description || '',
        guest_upload_limit: eventData.guest_upload_limit || 10,
        video_max_duration: eventData.video_max_duration || 15,
        status: eventData.status || 'active',
        camera_modes: Array.isArray(eventData.camera_modes)
          ? eventData.camera_modes
          : ['original', 'disposable', 'film', 'retro'],
        primary_color: eventData.primary_color || '#8b5cf6'
      });

      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('type')
        .eq('event_id', eventId);

      if (!mediaError) {
        const photos = mediaData.filter(item => item.type === 'photo').length;
        const videos = mediaData.filter(item => item.type === 'video').length;

        setMediaStats({
          photos,
          videos,
          total: mediaData.length,
          guests: 0
        });
      }

      const { count: guestCount } = await supabase
        .from('guest_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);

      setMediaStats(previous => ({
        ...previous,
        guests: guestCount || 0
      }));
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  /* ============================================================
     FORM
     ============================================================ */

  const handleChange = event => {
    const { name, value, type } = event.target;

    setFormData(previous => ({
      ...previous,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const toggleCameraMode = mode => {
    setFormData(previous => {
      const exists = previous.camera_modes.includes(mode);

      if (exists && previous.camera_modes.length === 1) {
        toast.error('Keep at least one camera mode enabled.');
        return previous;
      }

      return {
        ...previous,
        camera_modes: exists
          ? previous.camera_modes.filter(item => item !== mode)
          : [...previous.camera_modes, mode]
      };
    });
  };

  /* ============================================================
     SAVE
     ============================================================ */

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter an event name.');
      return;
    }

    if (!formData.event_date) {
      toast.error('Please select an event date.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: formData.name.trim(),
          event_date: formData.event_date,
          description: formData.description.trim(),
          guest_upload_limit: Math.max(
            1,
            Math.min(100, Number(formData.guest_upload_limit) || 10)
          ),
          video_max_duration: Math.max(
            5,
            Math.min(60, Number(formData.video_max_duration) || 15)
          ),
          status: formData.status,
          camera_modes: formData.camera_modes,
          primary_color: formData.primary_color,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      toast.success('Event updated successfully ✨');

      await fetchEvent();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.message || 'Failed to update event.');
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     DELETE
     ============================================================ */

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${event?.name}" permanently?\n\nThis will remove the event and its media records.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const { data: mediaData } = await supabase
        .from('media')
        .select('file_url')
        .eq('event_id', eventId);

      if (mediaData?.length) {
        const storagePaths = mediaData
          .map(item => {
            try {
              const url = new URL(item.file_url);
              const marker = '/event-media/';
              const index = url.pathname.indexOf(marker);

              if (index === -1) {
                return null;
              }

              return decodeURIComponent(
                url.pathname.slice(index + marker.length)
              );
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (storagePaths.length) {
          await supabase.storage.from('event-media').remove(storagePaths);
        }
      }

      await supabase.from('media').delete().eq('event_id', eventId);
      await supabase.from('guest_sessions').delete().eq('event_id', eventId);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      toast.success('Event deleted.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete event.');
    } finally {
      setDeleting(false);
    }
  };

  /* ============================================================
     EVENT URLS
     ============================================================ */

  const eventUrl = `${window.location.origin}/e/${formData.slug}`;
  const galleryUrl = `${window.location.origin}/e/${formData.slug}/gallery`;

  /* ============================================================
     COPY EVENT URL
     ============================================================ */

  const copyEventUrl = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast.success('Event link copied!');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  /* ============================================================
     SHARE GALLERY
     ============================================================ */

  const shareGallery = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${event?.name || 'Event'} Gallery`,
          text: 'Revisit the moments from our event 📸',
          url: galleryUrl
        });
        return;
      }

      await navigator.clipboard.writeText(galleryUrl);
      toast.success('Gallery link copied!');
    } catch (error) {
      console.warn('Share cancelled:', error);

      // Fallback: try clipboard if share was cancelled
      try {
        await navigator.clipboard.writeText(galleryUrl);
        toast.success('Gallery link copied!');
      } catch {
        toast.error('Could not share the gallery link.');
      }
    }
  };

  /* ============================================================
     QR DOWNLOAD
     ============================================================ */

  const downloadQR = () => {
    const svg = document.getElementById('event-qr-code');

    if (!svg) {
      toast.error('QR code is not ready.');
      return;
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8'
    });

    const url = URL.createObjectURL(svgBlob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `snapguest-${formData.slug}-qr.svg`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    toast.success('QR code downloaded!');
  };

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="edit-event-loading">
        <div>✦</div>
        <span>Loading event…</span>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div
      className="edit-event-page"
      style={{
        '--event-color': formData.primary_color
      }}
    >
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="edit-event-header">
        <Link to="/dashboard" className="edit-back-button">
          <FiArrowLeft />
          <span>Dashboard</span>
        </Link>

        <div>
          <strong>Event Settings</strong>
          <span>{event.name}</span>
        </div>

        <button
          type="button"
          className="edit-save-top"
          onClick={() =>
            document.getElementById('event-settings-form')?.requestSubmit()
          }
          disabled={saving}
        >
          <FiSave />
          <span>Save</span>
        </button>
      </header>

      <main className="edit-event-content">

        {/* ====================================================
            EVENT HERO
            ==================================================== */}

        <section className="event-settings-hero">
          <div
            className="event-color-orb"
            style={{
              background: formData.primary_color
            }}
          />

          <div className="event-hero-copy">
            <span>EVENT CONTROL CENTRE</span>
            <h1>{event.name}</h1>
            <p>
              Control how guests capture, share and experience your event.
            </p>
          </div>

          <div className="event-status-pill">
            <span className={formData.status} />
            {formData.status}
          </div>
        </section>

        {/* ====================================================
            STATS
            ==================================================== */}

        <section className="event-stats-row">
          <div>
            <FiImage />
            <strong>{mediaStats.photos}</strong>
            <span>Photos</span>
          </div>

          <div>
            <FiVideo />
            <strong>{mediaStats.videos}</strong>
            <span>Videos</span>
          </div>

          <div>
            <FiUsers />
            <strong>{mediaStats.guests}</strong>
            <span>Guests</span>
          </div>

          <div>
            <FiCamera />
            <strong>{formData.guest_upload_limit}</strong>
            <span>Per guest</span>
          </div>
        </section>

        {/* ====================================================
            QUICK ACTIONS
            ==================================================== */}

        <section className="quick-actions">
          <Link to={`/e/${formData.slug}`} className="quick-action">
            <FiCamera />
            <span>Open Camera</span>
          </Link>

          <Link to={`/e/${formData.slug}/live`} className="quick-action">
            <FiTv />
            <span>Live Wall</span>
          </Link>

          <Link to={`/e/${formData.slug}/gallery`} className="quick-action">
            <FiImage />
            <span>Gallery</span>
          </Link>

          <button
            type="button"
            className="quick-action"
            onClick={() => setShowQR(previous => !previous)}
          >
            <FaQrcode />
            <span>Event QR</span>
          </button>

          <button
            type="button"
            className="quick-action quick-action-accent"
            onClick={shareGallery}
          >
            <FiShare2 />
            <span>Share Gallery</span>
          </button>
        </section>

        {/* ====================================================
            QR
            ==================================================== */}

        {showQR && (
          <section className="settings-card qr-settings-card">
            <div className="settings-card-heading">
              <div>
                <span>EVENT ACCESS</span>
                <h2>Guest QR Code</h2>
              </div>
              <FaQrcode />
            </div>

            <div className="qr-layout">
              <div className="qr-code-box">
                <QRCodeSVG
                  id="event-qr-code"
                  value={eventUrl}
                  size={210}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#111111"
                />
              </div>

              <div className="qr-info">
                <strong>Scan to join the event camera</strong>
                <p>
                  Guests scan this code with their phones to start capturing
                  moments.
                </p>

                <div className="event-url-box">
                  <span>{eventUrl}</span>
                  <button type="button" onClick={copyEventUrl}>
                    <FiCopy />
                  </button>
                </div>

                <button
                  type="button"
                  className="qr-download-button"
                  onClick={downloadQR}
                >
                  <FiDownload />
                  Download QR
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            GALLERY SHARE CARD
            ==================================================== */}

        <section className="settings-card gallery-share-card">
          <div className="settings-card-heading">
            <div>
              <span>AFTER THE EVENT</span>
              <h2>Share the gallery</h2>
            </div>
            <FiShare2 />
          </div>

          <p className="settings-description">
            After the event, send this link to the host so guests can revisit
            and download their favourite moments.
          </p>

          <div className="event-url-box">
            <span>{galleryUrl}</span>

            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(galleryUrl);
                  toast.success('Gallery link copied!');
                } catch {
                  toast.error('Could not copy the link.');
                }
              }}
            >
              <FiCopy />
            </button>
          </div>

          <div className="gallery-share-actions">
            <button
              type="button"
              className="gallery-share-primary"
              onClick={shareGallery}
            >
              <FiShare2 />
              Share with Host
            </button>

            <Link
              to={`/e/${formData.slug}/gallery`}
              className="gallery-share-secondary"
            >
              <FiEye />
              Preview Gallery
            </Link>
          </div>
        </section>

        {/* ====================================================
            FORM
            ==================================================== */}

        <form id="event-settings-form" onSubmit={handleSubmit}>
          {/* BASIC DETAILS */}

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span>EVENT DETAILS</span>
                <h2>The basics</h2>
              </div>
              <FiCalendar />
            </div>

            <div className="settings-form-grid">
              <label>
                <span>Event name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={saving}
                />
              </label>

              <label>
                <span>Event date</span>
                <input
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                  disabled={saving}
                />
              </label>

              <label className="full">
                <span>Description</span>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  disabled={saving}
                  placeholder="Tell guests a little about this event…"
                />
              </label>
            </div>
          </section>

          {/* GUEST SETTINGS */}

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span>GUEST EXPERIENCE</span>
                <h2>Capture settings</h2>
              </div>
              <FiSliders />
            </div>

            <div className="settings-form-grid">
              <label>
                <span>Uploads per guest</span>
                <input
                  type="number"
                  name="guest_upload_limit"
                  min="1"
                  max="100"
                  value={formData.guest_upload_limit}
                  onChange={handleChange}
                  disabled={saving}
                />
                <small>How many moments each guest can share.</small>
              </label>

              <label>
                <span>Maximum video length</span>
                <input
                  type="number"
                  name="video_max_duration"
                  min="5"
                  max="60"
                  value={formData.video_max_duration}
                  onChange={handleChange}
                  disabled={saving}
                />
                <small>Maximum video duration in seconds.</small>
              </label>

              <label>
                <span>Event status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="active">Active — accepting uploads</option>
                  <option value="draft">Draft — not published</option>
                  <option value="closed">Closed — no uploads</option>
                </select>
              </label>

              <label>
                <span>Event colour</span>
                <div className="color-picker-row">
                  <input
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    disabled={saving}
                  />
                  <strong>{formData.primary_color}</strong>
                </div>
              </label>
            </div>
          </section>

          {/* CAMERA FILTERS */}

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <span>CAMERA EXPERIENCE</span>
                <h2>Guest filters</h2>
              </div>
              <FiCamera />
            </div>

            <p className="settings-description">
              Give guests different looks they can use while taking photos at
              the event.
            </p>

            <div className="camera-mode-grid">
              {CAMERA_MODES.map(cameraMode => {
                const active = formData.camera_modes.includes(cameraMode.key);

                return (
                  <button
                    type="button"
                    key={cameraMode.key}
                    className={
                      active ? 'camera-mode-card active' : 'camera-mode-card'
                    }
                    onClick={() => toggleCameraMode(cameraMode.key)}
                    disabled={saving}
                  >
                    <div className="camera-mode-preview">
                      {active && <FiCheck />}
                    </div>
                    <strong>{cameraMode.label}</strong>
                    <span>{cameraMode.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SAVE */}

          <section className="settings-submit">
            <button
              type="submit"
              className="primary-settings-button"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="button-loader" />
                  Saving changes…
                </>
              ) : (
                <>
                  <FiSave />
                  Save Event Settings
                </>
              )}
            </button>

            <button
              type="button"
              className="secondary-settings-button"
              onClick={() => navigate('/dashboard')}
              disabled={saving || deleting}
            >
              Cancel
            </button>
          </section>
        </form>

        {/* ====================================================
            DANGER ZONE
            ==================================================== */}

        <section className="danger-zone">
          <div>
            <span>DANGER ZONE</span>
            <h3>Delete this event</h3>
            <p>
              This permanently removes the event and its media records.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            <FiTrash2 />
            {deleting ? 'Deleting…' : 'Delete Event'}
          </button>
        </section>

        {/* ====================================================
            MOBILE FOOTER
            ==================================================== */}

        <footer className="edit-event-footer">
          <span>Signed in as</span>
          <strong>{user?.email}</strong>

          <a href={eventUrl} target="_blank" rel="noreferrer">
            <FiExternalLink />
            Public event
          </a>
        </footer>
      </main>
    </div>
  );
}

export default EditEvent;