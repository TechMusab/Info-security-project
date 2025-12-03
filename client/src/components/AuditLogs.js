import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AuditLogs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [filter, setFilter] = useState('my-logs');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let response;
      if (filter === 'my-logs') {
        response = await axios.get(`${API_URL}/audit/my-logs`);
        setLogs(response.data);
      } else {
        response = await axios.get(`${API_URL}/audit/security-events`);
        setSecurityEvents(response.data);
      }
    } catch (error) {
      console.error('Load logs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return '#dc3545';
      case 'ERROR':
        return '#fd7e14';
      case 'WARNING':
        return '#ffc107';
      case 'INFO':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Security Audit Logs</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button
            className="btn"
            onClick={() => setFilter('my-logs')}
            style={{
              background: filter === 'my-logs' ? '#667eea' : '#e0e0e0',
              color: filter === 'my-logs' ? 'white' : '#333',
              marginRight: '10px'
            }}
          >
            My Logs
          </button>
          <button
            className="btn"
            onClick={() => setFilter('security-events')}
            style={{
              background: filter === 'security-events' ? '#667eea' : '#e0e0e0',
              color: filter === 'security-events' ? 'white' : '#333'
            }}
          >
            Security Events
          </button>
        </div>

        {loading ? (
          <p>Loading logs...</p>
        ) : (
          <div>
            {filter === 'my-logs' ? (
              <div>
                <h3>My Activity Logs</h3>
                {logs.length === 0 ? (
                  <p style={{ color: '#666' }}>No logs found</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    {logs.map((log) => (
                      <div
                        key={log._id}
                        style={{
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getSeverityColor(log.severity)}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong>{log.eventType}</strong>
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          Severity: <span style={{ color: getSeverityColor(log.severity) }}>
                            {log.severity}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3>Security Events (Warnings & Errors)</h3>
                {securityEvents.length === 0 ? (
                  <p style={{ color: '#666' }}>No security events found</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    {securityEvents.map((event) => (
                      <div
                        key={event._id}
                        style={{
                          padding: '12px',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getSeverityColor(event.severity)}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div>
                            <strong>{event.eventType}</strong>
                            {event.userId && (
                              <span style={{ marginLeft: '8px', fontSize: '14px', color: '#666' }}>
                                User: {event.userId.username || event.userId}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          Severity: <span style={{ color: getSeverityColor(event.severity) }}>
                            {event.severity}
                          </span>
                          {event.ipAddress && (
                            <span style={{ marginLeft: '16px' }}>IP: {event.ipAddress}</span>
                          )}
                        </div>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                            <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogs;

