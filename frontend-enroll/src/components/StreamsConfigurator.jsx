import React from 'react'

const PAYMENT_OPTIONS = ['Monthly', 'Quarterly']

export default function StreamsConfigurator({streams = [], configs = {}, onChange, errors = {}, batchesByInstrument = {}, loadingBatches = {}, instruments = []}){
  function update(streamId, field, value){
    const next = {...configs}
    next[streamId] = { ...(next[streamId] || {}), [field]: value }
    onChange(next)
  }

  if(!streams || streams.length === 0) return <div className="hint">No streams selected.</div>

  // Helper to get instrument name from id
  const getInstrumentName = (id) => {
    const found = instruments.find(i => i.id === id)
    return found ? found.name : id
  }

  return (
    <div>
      {streams.map(instId => {
        const cfg = configs[instId] || {}
        const batches = batchesByInstrument[instId] || []
        const loading = loadingBatches[instId]
        return (
          <div key={instId} className="stream-card">
            <div className="stream-card-header">
              <div className="card-title">{getInstrumentName(instId)}</div>
            </div>
            <div className="stream-card-body">
              <label style={{display:'block',marginBottom:6,fontWeight:500}}>Batch</label>
              {loading ? (
                <div className="hint">Loading batches...</div>
              ) : batches.length === 0 ? (
                <div className="hint">No batches available for this instrument</div>
              ) : (
                <select className="input" value={cfg.batch||''} onChange={e=>update(instId, 'batch', e.target.value)}>
                  <option value="">Choose batch</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.recurrence}>
                      {b.recurrence} - Teacher: {b.teacher_name || 'TBA'}
                    </option>
                  ))}
                </select>
              )}

              <label style={{display:'block',marginTop:12,marginBottom:6,fontWeight:500}}>Payment</label>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                {PAYMENT_OPTIONS.map(p => (
                  <label key={p} style={{display:'flex',alignItems:'center',gap:6}}>
                    <input type="radio" name={`pay-${instId}`} checked={cfg.payment===p} onChange={()=>update(instId,'payment',p)} />
                    {p}
                  </label>
                ))}
              </div>

              {errors[instId] && <div className="error-banner" style={{marginTop:12}}>{errors[instId]}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
