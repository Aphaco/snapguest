import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Card, Form, Button, Spinner, Alert } from 'react-bootstrap';
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
  FiEye
} from 'react-icons/fi';

import { FaQrcode } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

function EditEvent() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  const [mediaStats, setMediaStats] = useState({ photos: 0, videos: 0, total: 0 });
  const [showQR, setShowQR] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    event_date: '',
    description: '',
    guest_upload_limit: 10,
    video_max_duration: 15,
    status: 'active',
    camera_modes: ['original', 'disposable', 'film'],
    primary_color: '#0ea5e9'
  });

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      
      setEvent(eventData);
      setFormData({
        name: eventData.name || '',
        slug: eventData.slug || '',
        event_date: eventData.event_date || '',
        description: eventData.description || '',
        guest_upload_limit: eventData.guest_upload_limit || 10,
        video_max_duration: eventData.video_max_duration || 15,
        status: eventData.status || 'active',
        camera_modes: eventData.camera_modes || ['original', 'disposable', 'film'],
        primary_color: eventData.primary_color || '#0ea5e9'
      });

      // Fetch media stats
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('type', { count: 'exact', head: false })
        .eq('event_id', eventId);

      if (!mediaError && mediaData) {
        const photos = mediaData.filter(m => m.type === 'photo').length;
        const videos = mediaData.filter(m => m.type === 'video').length;
        setMediaStats({ photos, videos, total: mediaData.length });
      }

    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    });
  };

  const toggleCameraMode = (mode) => {
    setFormData({
      ...formData,
      camera_modes: formData.camera_modes.includes(mode)
        ? formData.camera_modes.filter(m => m !== mode)
        : [...formData.camera_modes, mode]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: formData.name.trim(),
          event_date: formData.event_date,
          description: formData.description.trim(),
          guest_upload_limit: formData.guest_upload_limit,
          video_max_duration: formData.video_max_duration,
          status: formData.status,
          camera_modes: formData.camera_modes,
          primary_color: formData.primary_color,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (error) throw error;

      toast.success('Event updated successfully! ✅');
      fetchEvent(); // Refresh data

    } catch (error) {
      console.error('Error updating event:', error);
      toast.error(error.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This will delete all media permanently.')) {
      return;
    }

    try {
      setLoading(true);
      
      // Delete media from storage first
      const { data: mediaData } = await supabase
        .from('media')
        .select('file_url')
        .eq('event_id', eventId);

      if (mediaData && mediaData.length > 0) {
        const files = mediaData.map(m => m.file_url.split('/').pop());
        await supabase.storage
          .from('event-media')
          .remove(files);
      }

      // Delete media records
      await supabase
        .from('media')
        .delete()
        .eq('event_id', eventId);

      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast.success('Event deleted successfully');
      navigate('/dashboard');

    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code-canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `qr-${formData.slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('QR code downloaded!');
    }
  };

  const copyEventUrl = () => {
    const url = `${window.location.origin}/e/${formData.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const eventUrl = `${window.location.origin}/e/${formData.slug}`;

  return (
    <div className="pb-5">
      {/* Mobile Navigation */}
      <nav className="nav-mobile d-flex align-items-center">
        <Link to="/dashboard" className="text-decoration-none d-flex align-items-center text-dark">
          <FiArrowLeft size={20} className="me-2" />
          <span className="brand">Back</span>
        </Link>
        <span className="ms-auto text-muted small">{user?.email}</span>
      </nav>

      <Container fluid className="px-3 py-3">
        {/* Event Header */}
        <div className="mb-3">
          <div className="d-flex align-items-start justify-content-between">
            <div>
              <h4 className="fw-bold mb-1">{event?.name}</h4>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <span className="text-muted small d-flex align-items-center gap-1">
                  <FiCalendar size={12} />
                  {new Date(event?.event_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                <span className={`badge bg-${event?.status === 'active' ? 'success' : event?.status === 'draft' ? 'warning' : 'secondary'}`}>
                  {event?.status.toUpperCase()}
                </span>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              className="rounded-pill"
              style={{ fontSize: '12px' }}
            >
              <FiTrash2 size={14} />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stat-grid mb-3">
          <div className="stat-card">
            <div className="icon-wrapper bg-primary bg-opacity-10">
              <FiImage size={18} className="text-primary" />
            </div>
            <div>
              <div className="stat-number">{mediaStats.photos}</div>
              <div className="stat-label">Photos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-wrapper bg-danger bg-opacity-10">
              <FiVideo size={18} className="text-danger" />
            </div>
            <div>
              <div className="stat-number">{mediaStats.videos}</div>
              <div className="stat-label">Videos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-wrapper bg-success bg-opacity-10">
              <FiUsers size={18} className="text-success" />
            </div>
            <div>
              <div className="stat-number">{mediaStats.total}</div>
              <div className="stat-label">Total Media</div>
            </div>
          </div>
        </div>

        {/* QR Code & Quick Actions */}
        <div className="mb-3">
          <Card className="border-0 card-elevated">
            <Card.Body className="p-3">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-light rounded-3 p-2" style={{ width: '80px', height: '80px' }}>
                  {showQR ? (
                    <QRCode
                      id="qr-code-canvas"
                      value={eventUrl}
                      size={80}
                      level="H"
                      includeMargin
                    />
                  ) : (
                    <div className="d-flex align-items-center justify-content-center h-100">
                      <FaQrcode size={40} className="text-muted" />
                    </div>
                  )}
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-semibold" style={{ fontSize: '13px' }}>Event QR Code</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-primary"
                      onClick={() => setShowQR(!showQR)}
                      style={{ fontSize: '11px' }}
                    >
                      {showQR ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  <div className="d-flex align-items-center gap-1 text-muted small">
                    <span className="text-truncate" style={{ maxWidth: '120px' }}>
                      {eventUrl}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-primary"
                      onClick={copyEventUrl}
                      style={{ fontSize: '11px' }}
                    >
                      <FiCopy size={12} />
                    </Button>
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={downloadQR}
                      className="d-flex align-items-center gap-1 rounded-pill px-3"
                      style={{ fontSize: '11px' }}
                    >
                      <FiDownload size={12} />
                      Download QR
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      as={Link}
                      to={`/e/${formData.slug}`}
                      className="d-flex align-items-center gap-1 rounded-pill px-3"
                      style={{ fontSize: '11px' }}
                    >
                      <FiEye size={12} />
                      View Event
                    </Button>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Edit Form */}
        <Card className="border-0 card-elevated">
          <Card.Body className="p-3 p-md-4">
            <Form onSubmit={handleSubmit} className="form-mobile">
              {/* Event Name */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event Name *</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={saving}
                  className="form-control"
                />
              </Form.Group>

              {/* Event Date */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event Date *</Form.Label>
                <Form.Control
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                  disabled={saving}
                  className="form-control"
                />
              </Form.Group>

              {/* Description */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={saving}
                  className="form-control"
                  style={{ resize: 'none' }}
                />
              </Form.Group>

              <hr className="my-3" />

              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <FiSliders size={18} />
                Guest Settings
              </h6>

              {/* Upload Limit */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Uploads per Guest</Form.Label>
                <Form.Control
                  type="number"
                  name="guest_upload_limit"
                  value={formData.guest_upload_limit}
                  onChange={handleChange}
                  min={1}
                  max={100}
                  disabled={saving}
                  className="form-control"
                />
              </Form.Group>

              {/* Video Duration */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Max Video (seconds)</Form.Label>
                <Form.Control
                  type="number"
                  name="video_max_duration"
                  value={formData.video_max_duration}
                  onChange={handleChange}
                  min={5}
                  max={60}
                  disabled={saving}
                  className="form-control"
                />
              </Form.Group>

              {/* Status */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event Status</Form.Label>
                <Form.Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={saving}
                  className="form-select"
                >
                  <option value="active">🟢 Active - Guests can upload</option>
                  <option value="draft">🟡 Draft - Not published</option>
                  <option value="closed">🔴 Closed - No uploads</option>
                </Form.Select>
              </Form.Group>

              <hr className="my-3" />

              <h6 className="fw-bold mb-3">Camera Modes</h6>

              <div className="d-flex flex-wrap gap-2 mb-3">
                {['original', 'disposable', 'film', 'retro'].map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={formData.camera_modes.includes(mode) ? 'primary' : 'outline-secondary'}
                    size="sm"
                    onClick={() => toggleCameraMode(mode)}
                    className="rounded-pill px-3 py-1 d-flex align-items-center gap-1"
                    style={{ fontSize: '12px' }}
                    disabled={saving}
                  >
                    {formData.camera_modes.includes(mode) && <FiCheck size={12} />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Primary Color */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Primary Color</Form.Label>
                <div className="d-flex align-items-center gap-3">
                  <Form.Control
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    style={{ width: '50px', height: '40px', padding: '2px' }}
                    disabled={saving}
                    className="form-control"
                  />
                  <span className="text-muted small">{formData.primary_color}</span>
                </div>
              </Form.Group>

              {/* Submit Buttons */}
              <div className="d-flex flex-column flex-sm-row gap-2 mt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  className="btn-mobile btn-primary-mobile"
                >
                  {saving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave size={18} />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate('/dashboard')}
                  disabled={saving}
                  className="btn-mobile btn-outline-mobile"
                >
                  Cancel
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}

export default EditEvent;