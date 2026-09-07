import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Container, Row, Col, Card, Button, Spinner, Badge } from 'react-bootstrap';
import { FiArrowLeft, FiImage, FiVideo, FiDownload, FiCamera } from 'react-icons/fi';
import toast from 'react-hot-toast';

function EventGallery() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);

  useEffect(() => {
    loadEventAndMedia();
  }, [eventSlug]);

  const loadEventAndMedia = async () => {
    try {
      setLoading(true);
      
      // Load event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', eventSlug)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Load media
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

  const downloadAll = async () => {
    toast.success('Preparing download...');
    // TODO: Implement batch download
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div className="pb-5">
      <nav className="nav-mobile d-flex align-items-center">
        <Link to={`/e/${eventSlug}`} className="text-decoration-none d-flex align-items-center text-dark">
          <FiArrowLeft size={20} className="me-2" />
          <span className="brand">Back</span>
        </Link>
        <span className="ms-auto text-muted small">{media.length} moments</span>
      </nav>

      <Container fluid className="px-3 py-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="fw-bold mb-0">{event?.name}</h5>
            <span className="text-muted small">Live Gallery</span>
          </div>
          {media.length > 0 && (
            <Button variant="primary" size="sm" onClick={downloadAll} className="rounded-pill">
              <FiDownload size={14} className="me-1" />
              Download All
            </Button>
          )}
        </div>

        {media.length === 0 ? (
          <div className="empty-state card-elevated p-5">
            <div className="icon">🖼️</div>
            <h5>No moments yet</h5>
            <p>Be the first to capture a memory!</p>
            <Link to={`/e/${eventSlug}`}>
              <Button variant="primary" className="btn-mobile btn-primary-mobile">
                <FiCamera size={18} className="me-2" />
                Take a Photo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="gallery-grid">
            {media.map((item) => (
              <div
                key={item.id}
                className="gallery-item"
                onClick={() => setSelectedMedia(item)}
              >
                {item.type === 'photo' ? (
                  <img src={item.file_url} alt="Event moment" loading="lazy" />
                ) : (
                  <video src={item.file_url} muted />
                )}
                {item.type === 'video' && (
                  <div className="video-badge">
                    <FiVideo size={10} />
                    Video
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Media Preview Modal */}
        {selectedMedia && (
          <div 
            className="position-fixed top-0 start-0 end-0 bottom-0 bg-dark d-flex align-items-center justify-content-center"
            style={{ zIndex: 9999 }}
            onClick={() => setSelectedMedia(null)}
          >
            <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center p-4">
              {selectedMedia.type === 'photo' ? (
                <img
                  src={selectedMedia.file_url}
                  alt="Full view"
                  className="img-fluid"
                  style={{ maxHeight: '90vh', objectFit: 'contain' }}
                />
              ) : (
                <video
                  src={selectedMedia.file_url}
                  controls
                  autoPlay
                  className="w-100"
                  style={{ maxHeight: '90vh' }}
                />
              )}
              <button
                className="position-absolute top-0 end-0 m-4 btn btn-light btn-sm rounded-circle"
                onClick={() => setSelectedMedia(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

export default EventGallery;