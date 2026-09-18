import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Spinner } from 'react-bootstrap';
import {
  FiArrowLeft,
  FiUpload,
  FiSliders,
  FiCheck,
  FiImage,
  FiX,
  FiCalendar,
  FiCamera,
  FiUsers,
  FiVideo
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './CreateEvent.css';

/* ============================================================
   PRESET COLORS
   ============================================================ */

const PRESET_COLORS = [
  { name: 'Aurora', value: '#8b5cf6' },
  { name: 'Ocean', value: '#0ea5e9' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Noir', value: '#111111' },
  { name: 'Coral', value: '#fb7185' }
];

const CAMERA_MODES = [
  { key: 'original', label: 'Original', description: 'Natural' },
  { key: 'disposable', label: 'Disposable', description: 'Fun & flash' },
  { key: 'film', label: 'Film', description: 'Soft & timeless' },
  { key: 'retro', label: 'Retro', description: 'Vintage' }
];

/* ============================================================
   COMPONENT
   ============================================================ */

function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [slugError, setSlugError] = useState('');

  const [coverImage, setCoverImage] = useState(null); // data URL for preview
  const [coverImageFile, setCoverImageFile] = useState(null); // raw File

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    event_date: '',
    description: '',
    guest_upload_limit: 10,
    video_max_duration: 15,
    status: 'active',
    camera_modes: ['original', 'disposable', 'film', 'retro'],
    primary_color: '#8b5cf6'
  });

  /* ============================================================
     HELPERS
     ============================================================ */

  const generateSlug = name =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  /* ============================================================
     COVER IMAGE
     ============================================================ */

  const handleCoverSelect = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }

    setCoverImageFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = ev => setCoverImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeCover = () => {
    setCoverImage(null);
    setCoverImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ============================================================
     FORM HANDLERS
     ============================================================ */

  const handleNameChange = e => {
    const name = e.target.value;
    const slug = generateSlug(name);

    setFormData(prev => ({ ...prev, name, slug }));
    setSlugError('');
  };

  const handleChange = e => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSlugChange = e => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '');
    setFormData(prev => ({ ...prev, slug }));
    setSlugError('');
  };

  const toggleCameraMode = mode => {
    setFormData(prev => ({
      ...prev,
      camera_modes: prev.camera_modes.includes(mode)
        ? prev.camera_modes.filter(m => m !== mode)
        : [...prev.camera_modes, mode]
    }));
  };

  const setColor = color => {
    setFormData(prev => ({ ...prev, primary_color: color }));
  };

  /* ============================================================
     SUBMIT
     ============================================================ */

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter an event name');
      return;
    }

    if (!formData.slug.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    if (!formData.event_date) {
      toast.error('Please select an event date');
      return;
    }

    setLoading(true);

    try {
      // Check slug
      const { data: existingEvent } = await supabase
        .from('events')
        .select('slug')
        .eq('slug', formData.slug)
        .maybeSingle();

      if (existingEvent) {
        setSlugError('This URL is already taken');
        setLoading(false);
        return;
      }

      // Upload cover image if provided
      let coverUrl = null;

      if (coverImageFile) {
        setUploadingCover(true);

        const ext = coverImageFile.name.split('.').pop() || 'jpg';
        const fileName = `covers/${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(fileName, coverImageFile, {
            cacheControl: '31536000',
            upsert: false
          });

        if (uploadError) {
          console.error('Cover upload error:', uploadError);
          toast.error('Cover image upload failed. Continuing without it.');
        } else {
          const { data: urlData } = supabase.storage
            .from('event-media')
            .getPublicUrl(fileName);

          coverUrl = urlData?.publicUrl || null;
        }

        setUploadingCover(false);
      }

      // Create event
      const { data, error } = await supabase
        .from('events')
        .insert([
          {
            name: formData.name.trim(),
            slug: formData.slug,
            event_date: formData.event_date,
            description: formData.description.trim(),
            cover_image: coverUrl,
            guest_upload_limit: formData.guest_upload_limit,
            video_max_duration: formData.video_max_duration,
            status: formData.status,
            camera_modes: formData.camera_modes,
            primary_color: formData.primary_color
          }
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          setSlugError('This URL is already taken');
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      toast.success('Event created! 🎉');
      navigate(`/event/${data.id}/edit`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div
      className="create-event-page"
      style={{ '--event-color': formData.primary_color }}
    >
      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="create-event-header">
        <Link to="/dashboard" className="create-back-button">
          <FiArrowLeft />
          <span>Back</span>
        </Link>

        <div className="create-header-title">
          <strong>Create Event</strong>
          <span>{user?.email}</span>
        </div>

        <div className="create-header-spacer" />
      </header>

      <main className="create-event-content">
        {/* ====================================================
            HERO / INTRO
            ==================================================== */}

        <section className="create-event-intro">
          <span className="create-event-eyebrow">NEW EVENT</span>

          <h1>Set the stage for something memorable.</h1>

          <p>
            Create your event, customise the guest experience, and
            generate a QR code in seconds.
          </p>
        </section>

        {/* ====================================================
            FORM
            ==================================================== */}

        <form onSubmit={handleSubmit} className="create-event-form">
          {/* ==============================================
              COVER IMAGE
              ============================================== */}

          <section className="create-event-card cover-card">
            <div className="create-card-header">
              <div>
                <span>EVENT BRANDING</span>
                <h2>Cover image</h2>
              </div>

              <FiImage />
            </div>

            <div className="cover-upload-area">
              {coverImage ? (
                <div className="cover-preview-wrapper">
                  <img
                    src={coverImage}
                    alt="Event cover"
                    className="cover-preview-image"
                  />

                  <div className="cover-preview-overlay">
                    <button
                      type="button"
                      className="cover-action-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FiUpload size={16} />
                      Change
                    </button>

                    <button
                      type="button"
                      className="cover-action-button danger"
                      onClick={removeCover}
                    >
                      <FiX size={16} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="cover-empty-state"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingCover}
                >
                  <span className="cover-empty-icon">
                    <FiUpload size={28} />
                  </span>

                  <strong>Upload a cover image</strong>

                  <span className="cover-empty-hint">
                    JPG, PNG, or WEBP · max 5MB
                  </span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                style={{ display: 'none' }}
              />
            </div>
          </section>

          {/* ==============================================
              BASIC DETAILS
              ============================================== */}

          <section className="create-event-card">
            <div className="create-card-header">
              <div>
                <span>THE BASICS</span>
                <h2>Event details</h2>
              </div>

              <FiCalendar />
            </div>

            <div className="create-form-grid">
              <label className="full">
                <span>Event name *</span>
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Sarah & David's Wedding"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  disabled={loading}
                />
                <small>This appears on the guest camera.</small>
              </label>

              <label className="full">
                <span>Event URL *</span>
                <div className="input-prefix-wrapper">
                  <span className="input-prefix">snapguest.com/e/</span>
                  <input
                    type="text"
                    name="slug"
                    placeholder="your-event"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    required
                    disabled={loading}
                    className={slugError ? 'has-error' : ''}
                  />
                </div>
                {slugError ? (
                  <small className="error-text">{slugError}</small>
                ) : (
                  <small>Use lowercase letters, numbers, and hyphens.</small>
                )}
              </label>

              <label>
                <span>Event date *</span>
                <input
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </label>

              <label>
                <span>Event status</span>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="active">Active — accepting uploads</option>
                  <option value="draft">Draft — not published</option>
                  <option value="closed">Closed — no uploads</option>
                </select>
              </label>

              <label className="full">
                <span>Description</span>
                <textarea
                  name="description"
                  placeholder="Tell guests what this event is about..."
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  disabled={loading}
                />
              </label>
            </div>
          </section>

          {/* ==============================================
              GUEST SETTINGS
              ============================================== */}

          <section className="create-event-card">
            <div className="create-card-header">
              <div>
                <span>GUEST EXPERIENCE</span>
                <h2>Capture settings</h2>
              </div>

              <FiSliders />
            </div>

            <div className="create-form-grid">
              <label>
                <span>
                  <FiCamera size={12} /> Uploads per guest
                </span>
                <input
                  type="number"
                  name="guest_upload_limit"
                  value={formData.guest_upload_limit}
                  onChange={handleChange}
                  min={1}
                  max={100}
                  disabled={loading}
                />
                <small>1–100 uploads per guest.</small>
              </label>

              <label>
                <span>
                  <FiVideo size={12} /> Max video length
                </span>
                <input
                  type="number"
                  name="video_max_duration"
                  value={formData.video_max_duration}
                  onChange={handleChange}
                  min={5}
                  max={60}
                  disabled={loading}
                />
                <small>5–60 seconds per video.</small>
              </label>
            </div>
          </section>

          {/* ==============================================
              CAMERA MODES
              ============================================== */}

          <section className="create-event-card">
            <div className="create-card-header">
              <div>
                <span>CAMERA EXPERIENCE</span>
                <h2>Guest filters</h2>
              </div>

              <FiCamera />
            </div>

            <p className="create-card-description">
              Choose which camera looks your guests can use.
            </p>

            <div className="camera-mode-grid">
              {CAMERA_MODES.map(mode => {
                const active = formData.camera_modes.includes(mode.key);

                return (
                  <button
                    type="button"
                    key={mode.key}
                    className={
                      active
                        ? 'camera-mode-option active'
                        : 'camera-mode-option'
                    }
                    onClick={() => toggleCameraMode(mode.key)}
                    disabled={loading}
                  >
                    <div className="camera-mode-icon">
                      {active && <FiCheck size={16} />}
                    </div>

                    <strong>{mode.label}</strong>
                    <span>{mode.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ==============================================
              COLOR
              ============================================== */}

          <section className="create-event-card">
            <div className="create-card-header">
              <div>
                <span>BRANDING</span>
                <h2>Event colour</h2>
              </div>

              <FiUsers />
            </div>

            <p className="create-card-description">
              This colour is used across the guest experience.
            </p>

            <div className="color-presets-grid">
              {PRESET_COLORS.map(color => {
                const isActive = formData.primary_color === color.value;

                return (
                  <button
                    type="button"
                    key={color.value}
                    className={
                      isActive
                        ? 'color-preset active'
                        : 'color-preset'
                    }
                    onClick={() => setColor(color.value)}
                    disabled={loading}
                    title={color.name}
                  >
                    <span
                      className="color-preset-swatch"
                      style={{ background: color.value }}
                    />

                    <span className="color-preset-name">{color.name}</span>

                    {isActive && (
                      <span className="color-preset-check">
                        <FiCheck size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <label className="custom-color-row">
              <span>Custom colour</span>

              <div className="custom-color-input">
                <input
                  type="color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  disabled={loading}
                />

                <strong>{formData.primary_color}</strong>
              </div>
            </label>
          </section>

          {/* ==============================================
              SUBMIT
              ============================================== */}

          <section className="create-submit-row">
            <button
              type="button"
              className="create-cancel-button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="create-submit-button"
              disabled={loading || uploadingCover}
            >
              {loading || uploadingCover ? (
                <>
                  <Spinner animation="border" size="sm" />
                  {uploadingCover ? 'Uploading…' : 'Creating…'}
                </>
              ) : (
                <>
                  <FiUpload />
                  Create Event
                </>
              )}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}

export default CreateEvent;