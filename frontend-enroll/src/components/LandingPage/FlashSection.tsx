import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api';

interface FlashSectionProps {
  onOpenModal: (e: React.MouseEvent, instrument?: string) => void;
}

interface BannerConfig {
  demo_day_title: string;
  demo_day_description: string;
  demo_day_link_enabled: boolean;
  piano_teacher_title: string;
  piano_teacher_description: string;
}

const FlashSection: React.FC<FlashSectionProps> = ({ onOpenModal }) => {
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await apiGet('/api/flash-banner');
        setConfig(data);
      } catch (err) {
        console.error('Failed to fetch flash banner config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  if (loading || !config) return null;

  return (
    <section className="flash-section" id="announcements">
      <div className="container">
        <div className="flash-grid">
          {/* Card 1: Demo Day */}
          <div className={`flash-card demo-card ${!config.demo_day_link_enabled ? 'link-disabled' : ''}`}>
            <div>
              <div className="card-badge">📢 Special Promo</div>
              <h3 className="card-title">{config.demo_day_title}</h3>
              <p className="card-desc">{config.demo_day_description}</p>
            </div>
            
            {config.demo_day_link_enabled ? (
              <button 
                onClick={(e) => onOpenModal(e, 'Demo Day')}
                className="flash-btn flash-btn-primary glow-shadow"
              >
                Register & Secure Spot Offer →
              </button>
            ) : (
              <div className="disabled-notice-box">
                <button 
                  disabled
                  className="flash-btn flash-btn-disabled"
                >
                  Registrations Closed
                </button>
                <p className="notice-text">
                  The current Demo Day registration period has closed. The placeholders remain for reference; links will reopen for the next schedule.
                </p>
              </div>
            )}
          </div>

          {/* Card 2: New Piano Teacher */}
          <div className="flash-card piano-card">
            <div>
              <div className="card-badge badge-emerald">🎹 Hot Launch</div>
              <h3 className="card-title">{config.piano_teacher_title}</h3>
              <p className="card-desc">{config.piano_teacher_description}</p>
            </div>
            <button 
              onClick={(e) => onOpenModal(e, 'Piano')}
              className="flash-btn flash-btn-emerald"
            >
              Inquire about Batches & Slots →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FlashSection;
