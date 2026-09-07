import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Container, Row, Col, Button, Spinner, Badge } from 'react-bootstrap';
import { 
  FiPlusCircle, 
  FiImage, 
  FiVideo, 
  FiCalendar, 
  FiUsers,
  FiLogOut,
  FiGrid,
  FiTv,
  FiCamera
} from 'react-icons/fi';
import { FaQrcode } from 'react-icons/fa';
import toast from 'react-hot-toast';
import './Dashboard.css';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalPhotos: 0,
    totalVideos: 0,
    totalGuests: 0
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEvents(data || []);
      
      const photoCount = data?.reduce((acc, e) => acc + (e.photo_count || 0), 0) || 0;
      const videoCount = data?.reduce((acc, e) => acc + (e.video_count || 0), 0) || 0;
      
      setStats({
        totalEvents: data?.length || 0,
        totalPhotos: photoCount,
        totalVideos: videoCount,
        totalGuests: 0
      });
    } catch (error) {
      toast.error('Failed to load events');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: 'active',
      closed: 'closed',
      draft: 'draft'
    };
    return (
      <span className={`badge-dashboard ${variants[status] || 'closed'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-classic">
      {/* Navigation */}
      <nav className="dashboard-nav">
        <div className="nav-container">
          <Link to="/dashboard" className="nav-brand">
            <span className="brand-icon">✦</span>
            SnapGuest
          </Link>
          <div className="nav-actions">
            <span className="user-email">{user?.email}</span>
            <button className="btn-logout" onClick={handleLogout}>
              <FiLogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon events">
              <FiCalendar size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.totalEvents}</div>
              <div className="stat-label">Events</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon photos">
              <FiImage size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.totalPhotos}</div>
              <div className="stat-label">Photos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon videos">
              <FiVideo size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.totalVideos}</div>
              <div className="stat-label">Videos</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon guests">
              <FiUsers size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-number">{stats.totalGuests}</div>
              <div className="stat-label">Guests</div>
            </div>
          </div>
        </div>

        {/* Create Event Button */}
        <div className="create-event-wrapper">
          <Link to="/create" className="btn-create-event">
            <FiPlusCircle size={20} />
            Create New Event
          </Link>
        </div>

        {/* Events List */}
        <div className="events-section">
          <div className="events-header">
            <h5 className="events-title">Your Events</h5>
            <span className="events-count">{events.length} events</span>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📸</div>
              <h5 className="empty-title">No events yet</h5>
              <p className="empty-description">Create your first event and start capturing memories</p>
              <Link to="/create" className="btn-empty-create">
                <FiPlusCircle size={18} />
                Create Event
              </Link>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-card-image">
                    {event.cover_image ? (
                      <img src={event.cover_image} alt={event.name} />
                    ) : (
                      <div className="event-placeholder">📸</div>
                    )}
                    <div className="event-card-badge">
                      {getStatusBadge(event.status)}
                    </div>
                  </div>
                  <div className="event-card-body">
                    <div className="event-card-title">{event.name}</div>
                    <div className="event-card-date">
                      <FiCalendar size={12} />
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="event-card-stats">
                      <span>
                        <FiImage size={12} />
                        {event.photo_count || 0}
                      </span>
                      <span>
                        <FiVideo size={12} />
                        {event.video_count || 0}
                      </span>
                    </div>
                    <div className="event-card-actions">
                      <Link to={`/e/${event.slug}`} className="btn-action view">
                        <FaQrcode size={14} />
                        View
                      </Link>
                      <Link to={`/e/${event.slug}/live`} className="btn-action live">
                        <FiTv size={12} />
                        Live Wall
                      </Link>
                      <Link to={`/event/${event.id}/edit`} className="btn-action edit">
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <Link to="/dashboard" className="mobile-nav-item active">
          <FiGrid size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/create" className="mobile-nav-item">
          <FiPlusCircle size={20} />
          <span>New</span>
        </Link>
        <Link to="#" className="mobile-nav-item">
          <FiCamera size={20} />
          <span>Scan</span>
        </Link>
      </div>
    </div>
  );
}

export default Dashboard;