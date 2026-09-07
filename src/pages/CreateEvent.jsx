import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Container, Row, Col, Card, Form, Button, Spinner } from 'react-bootstrap';
import { FiArrowLeft, FiUpload, FiSliders, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
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

  const [slugError, setSlugError] = useState('');

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = generateSlug(name);
    setFormData({
      ...formData,
      name,
      slug
    });
    setSlugError('');
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    });
  };

  const handleSlugChange = (e) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '');
    setFormData({
      ...formData,
      slug
    });
    setSlugError('');
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
    setLoading(true);

    try {
      if (!formData.name.trim()) {
        toast.error('Please enter an event name');
        setLoading(false);
        return;
      }

      if (!formData.slug.trim()) {
        toast.error('Please enter a valid URL');
        setLoading(false);
        return;
      }

      if (!formData.event_date) {
        toast.error('Please select an event date');
        setLoading(false);
        return;
      }

      const { data: existingEvent, error: checkError } = await supabase
        .from('events')
        .select('slug')
        .eq('slug', formData.slug)
        .single();

      if (existingEvent) {
        setSlugError('This URL is already taken');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .insert([{
          name: formData.name.trim(),
          slug: formData.slug,
          event_date: formData.event_date,
          description: formData.description.trim(),
          guest_upload_limit: formData.guest_upload_limit,
          video_max_duration: formData.video_max_duration,
          status: formData.status,
          camera_modes: formData.camera_modes,
          primary_color: formData.primary_color
        }])
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
        <div className="mb-3">
          <h4 className="fw-bold mb-1">Create Event</h4>
          <p className="text-muted small mb-0">Set up your event and get your QR code</p>
        </div>

        <Card className="border-0 card-elevated">
          <Card.Body className="p-3 p-md-4">
            <Form onSubmit={handleSubmit} className="form-mobile">
              {/* Event Name */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event Name *</Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  placeholder="e.g., Sarah & David's Wedding"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  disabled={loading}
                  className="form-control"
                />
                <Form.Text className="form-text">
                  This appears on the guest camera
                </Form.Text>
              </Form.Group>

              {/* URL Slug */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event URL *</Form.Label>
                <div className="input-group">
                  <span className="input-group-text">snapguest.com/e/</span>
                  <Form.Control
                    type="text"
                    name="slug"
                    placeholder="your-event"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    required
                    disabled={loading}
                    isInvalid={!!slugError}
                    className="form-control"
                  />
                </div>
                <Form.Text className="form-text">
                  Use letters, numbers, and hyphens
                </Form.Text>
                {slugError && (
                  <div className="text-danger small mt-1">{slugError}</div>
                )}
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
                  disabled={loading}
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
                  placeholder="Describe your event..."
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                  className="form-control"
                  style={{ resize: 'none' }}
                />
                <Form.Text className="form-text">
                  Shown to guests when they scan the QR
                </Form.Text>
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
                  disabled={loading}
                  className="form-control"
                />
                <Form.Text className="form-text">1-100 photos/videos per guest</Form.Text>
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
                  disabled={loading}
                  className="form-control"
                />
                <Form.Text className="form-text">5-60 seconds max</Form.Text>
              </Form.Group>

              {/* Status */}
              <Form.Group className="form-group">
                <Form.Label className="form-label">Event Status</Form.Label>
                <Form.Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={loading}
                  className="form-select"
                >
                  <option value="active">Active - Guests can upload</option>
                  <option value="draft">Draft - Not published</option>
                  <option value="closed">Closed - No uploads</option>
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
                    disabled={loading}
                  >
                    {formData.camera_modes.includes(mode) && <FiCheck size={12} />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
              <Form.Text className="form-text">
                Select which camera modes guests can use
              </Form.Text>

              {/* Primary Color */}
              <Form.Group className="form-group mt-3">
                <Form.Label className="form-label">Primary Color</Form.Label>
                <div className="d-flex align-items-center gap-3">
                  <Form.Control
                    type="color"
                    name="primary_color"
                    value={formData.primary_color}
                    onChange={handleChange}
                    style={{ width: '50px', height: '40px', padding: '2px' }}
                    disabled={loading}
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
                  disabled={loading}
                  className="btn-mobile btn-primary-mobile"
                >
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FiUpload size={18} />
                      Create Event
                    </>
                  )}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate('/dashboard')}
                  disabled={loading}
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

export default CreateEvent;