import React, { useEffect, useRef, useState } from 'react';
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
  FiShare2,
  FiUpload,
  FiX
} from 'react-icons/fi';

import { FaQrcode } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import './EditEvent.css';

/* ============================================================
   CAMERA FILTER OPTIONS
   ============================================================ */

const CAMERA_MODES = [
  { key: 'original', label: 'Original', description: 'Natural' },
  { key: 'disposable', label: 'Disposable', description: 'Fun & flash' },
  { key: 'film', label: 'Film', description: 'Soft & timeless' },
  { key: 'retro', label: 'Retro', description: 'Vintage' },
  { key: 'warm', label: 'Warm', description: 'Golden' },
  { key: 'cool', label: 'Cool', description: 'Clean' },
  { key: 'noir', label: 'Noir', description: 'Classic' }
];

function EditEvent() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const coverInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [event, setEvent] = useState(null);

  const [mediaStats, setMediaStats] = useState({
    photos: 0,
    videos: 0,
    total: 0,
    guests: 0
  });

  const [showQR, setShowQR] = useState(false);

  /* ---------------------------------------------
     COVER IMAGE STATE
  --------------------------------------------- */

  const [coverPreview, setCoverPreview] = useState(null); // data URL
  const [coverFile, setCoverFile] = useState(null);       // raw File
  const [coverRemoved, setCoverRemoved] = useState(false); // user clicked remove

  /* ---------------------------------------------
     FORM DATA
  --------------------------------------------- */

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    event_date: '',
    description: '',
    guest_upload_limit: 10,
    video_max_duration: 15,
    status: 'active',
    camera_modes: ['original', 'disposable', 'film', 'retro'],
    primary_color: '#8b5cf6',
    cover_image: null
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

      if (eventError) throw eventError;
      if (!eventData) throw new Error('Event not found');

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
        primary_color: eventData.primary_color || '#8b5cf6',
        cover_image: eventData.cover_image || null
      });

      // Set cover preview from existing cover
      if (eventData.cover_image) {
        setCoverPreview(eventData.cover_image);
      } else {
        setCoverPreview(null);
      }

      setCoverFile(null);
      setCoverRemoved(false);

      /* Media stats */
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('type')
        .eq('event_id', eventId);

      if (!mediaError) {
        const photos = mediaData.filter((item) => item.type === 'photo').length;
        const videos = mediaData.filter((item) => item.type === 'video').length;

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

      setMediaStats((previous) => ({
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
     COVER IMAGE HANDLERS
  ============================================================ */

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setCoverFile(file);
    setCoverRemoved(false);

    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCoverRemove = () => {
    setCoverFile(null);
    setCoverPreview(null);
    setCoverRemoved(true);

    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  /* ============================================================
     FORM
     ============================================================ */

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const toggleCameraMode = (mode) => {
    setFormData((previous) => {
      const exists = previous.camera_modes.includes(mode);

      if (exists && previous.camera_modes.length === 1) {
        toast.error('Keep at least one camera mode enabled.');
        return previous;
      }

      return {
        ...previous,
        camera_modes: exists
          ? previous.camera_modes.filter((item) => item !== mode)
          : [...previous.camera_modes, mode]
      };
    });
  };

  /* ============================================================
     SAVE
  ============================================================ */

  const handleSubmit = async (e) => {
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
      /* ---------------------------------------------
         1. UPLOAD NEW COVER IF PROVIDED
      --------------------------------------------- */

      let newCoverUrl = formData.cover_image;

      if (coverFile) {
        setUploadingCover(true);

        const ext = coverFile.name.split('.').pop() || 'jpg';
        const fileName = `covers/${eventId}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(fileName, coverFile, {
            cacheControl: '31536000',
            upsert: true
          });

        if (uploadError) {
          console.error('Cover upload error:', uploadError);
          toast.error('Cover upload failed. Continuing without changes.');
        } else {
          const { data: urlData } = supabase.storage
            .from('event-media')
            .getPublicUrl(fileName);

          newCoverUrl = urlData?.publicUrl || null;
        }

        setUploadingCover(false);
      } else if (coverRemoved) {
        // User removed the cover
        newCoverUrl = null;
      }

      /* ---------------------------------------------
         2. UPDATE EVENT
      --------------------------------------------- */

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
          cover_image: newCoverUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) throw error;

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

    if (!confirmed) return;

    setDeleting(true);

    try {
      const { data: mediaData } = await supabase
        .from('media')
        .select('file_url')
        .eq('event_id', eventId);

      if (mediaData?.length) {
        const storagePaths = mediaData
          .map((item) => {
            try {
              const url = new URL(item.file_url);
              const marker = '/event-media/';
              const index = url.pathname.indexOf(marker);
              if (index === -1) return null;
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

      if (error) throw error;

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
     URLS
  ============================================================ */

  const eventUrl = `${window.location.origin}/e/${formData.slug}`;
  const galleryUrl = `${window.location.origin}/e/${formData.slug}/gallery`;

  const copyEventUrl = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast.success('Event link copied!');
    } catch {
      toast.error('Could not copy the link.');
    }
  };

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

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div
      className="edit-event-page"
      style={{
        '--event-color': formData.primary_color
      }}
    >
      {/* HEADER */}

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
          disabled={saving || uploadingCover}
        >
          <FiSave />
          <span>Save</span>
        </button>
      </header>

      <main className="edit-event-content">

        {/* ==================================================
            EVENT HERO — NOW USES COVER IMAGE
        ================================================== */}

        <section
          className="event-settings-hero"
          style={
            coverPreview
              ? {
                  backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.85)), url(${coverPreview})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
              : {}
          }
        >
          {!coverPreview && (
            <div
              className="event-color-orb"
              style={{ background: formData.primary_color }}
            />
          )}

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

        {/* ==================================================
            STATS
        ================================================== */}

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

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

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
            onClick={() => setShowQR((previous) => !previous)}
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

        {/* ==================================================
            QR
        ================================================== */}

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

        {/* ==================================================
            GALLERY SHARE CARD
        ================================================== */}

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

        {/* ==================================================
            FORM
        ================================================== */}

        <form id="event-settings-form" onSubmit={handleSubmit}>

          {/* ==================================================
              COVER IMAGE CARD — NEW
          ================================================== */}

          <section className="settings-card cover-edit-card">
            <div className="settings-card-heading">
              <div>
                <span>EVENT BRANDING</span>
                <h2>Cover image</h2>
              </div>
              <FiImage />
            </div>

            <p className="settings-description">
              This image appears on your dashboard and across the guest
              experience.
            </p>

            <div className="cover-edit-area">
              {coverPreview ? (
                <div className="cover-edit-preview">
                  <img src={coverPreview} alt="Event cover" />

                  <div className="cover-edit-overlay">
                    <button
                      type="button"
                      className="cover-edit-btn"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={saving}
                    >
                      <FiUpload size={14} />
                      Change
                    </button>

                    <button
                      type="button"
                      className="cover-edit-btn danger"
                      onClick={handleCoverRemove}
                      disabled={saving}
                    >
                      <FiX size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="cover-edit-empty"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={saving || uploadingCover}
                >
                  <span className="cover-edit-empty-icon">
                    <FiUpload size={24} />
                  </span>
                  <strong>Upload a cover image</strong>
                  <span className="cover-edit-empty-hint">
                    JPG, PNG, or WEBP · max 5MB
                  </span>
                </button>
              )}

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                style={{ display: 'none' }}
              />
            </div>

            {uploadingCover && (
              <div className="cover-edit-uploading">
                <span className="button-loader" />
                Uploading cover image…
              </div>
            )}
          </section>

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
              {CAMERA_MODES.map((cameraMode) => {
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
              disabled={saving || uploadingCover}
            >
              {saving || uploadingCover ? (
                <>
                  <span className="button-loader" />
                  {uploadingCover ? 'Uploading cover…' : 'Saving changes…'}
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

        {/* DANGER ZONE */}

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

        {/* FOOTER */}

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