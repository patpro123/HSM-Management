import React, {useState, useEffect} from 'react'import { API_BASE_URL } from '../config'import StreamsConfigurator from './StreamsConfigurator'

const QUESTIONS = [
  { key: 'name', label: 'Name', type: 'name' },
  { key: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'address', label: 'Mailing address', type: 'textarea', placeholder: 'Street, City, State, ZIP' },
  { key: 'guardianName', label: 'Name of Guardian', type: 'text', placeholder: 'Guardian full name' },
  { key: 'telephone', label: 'Telephone number (WhatsApp enabled)', type: 'tel', placeholder: '+1 555-555-5555' },
  { key: 'streamsAndConfig', label: 'Streams & Configuration', type: 'streams-combined' },
  { key: 'dateOfJoining', label: 'Date of joining', type: 'date' },
]

function Summary({answers, onEdit, onSubmit}){
  return (
    <div className="summary">
      <h3>Summary</h3>
      <ul style={{paddingLeft:0}}>
        <li><strong>Name:</strong> {`${answers.firstName || ''} ${answers.lastName || ''}`.trim() || '-'}</li>
        <li><strong>Email:</strong> {answers.email || '-'}</li>
        <li><strong>Date of Birth:</strong> {answers.dob || '-'}</li>
        <li><strong>Mailing Address:</strong> {answers.address || '-'}</li>
        <li><strong>Guardian Name:</strong> {answers.guardianName || '-'}</li>
        <li><strong>Telephone (WhatsApp):</strong> {answers.telephone || '-'}</li>
        <li>
          <strong>Streams & Configuration:</strong>
          {(answers.streams && answers.streams.length > 0) ? (
            <ul style={{marginTop:6,paddingLeft:16}}>
              {answers.streams.map(inst => {
                const cfg = (answers.streamsConfig && answers.streamsConfig[inst]) || {}
                return (
                  <li key={inst} style={{marginBottom:6}}>
                    <strong>{inst}</strong><br/>
                    Batch: {cfg.batch || 'Not set'}<br/>
                    Payment: {cfg.payment || 'Not set'}
                  </li>
                )
              })}
            </ul>
          ) : '-'}
        </li>
        <li><strong>Date of Joining:</strong> {answers.dateOfJoining || '-'}</li>
      </ul>
      <div className="actions">
        <button className="btn" onClick={onEdit}>Edit</button>
        <button className="btn primary" onClick={onSubmit}>Submit</button>
      </div>
    </div>
  )
}

export default function QuestionFlow(){
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [instruments, setInstruments] = useState([])
  const [loadingInstruments, setLoadingInstruments] = useState(true)
  const [batchesByInstrument, setBatchesByInstrument] = useState({})
  const [loadingBatches, setLoadingBatches] = useState({})
  const q = QUESTIONS[index]

  // Fetch instruments from API on mount
  useEffect(() => {
    async function fetchInstruments() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/instruments`)
        const data = await response.json()
        setInstruments(data.instruments || [])
        setLoadingInstruments(false)
      } catch (err) {
        console.error('Failed to fetch instruments:', err)
        // Fallback to hardcoded list if API fails
        setInstruments([
          { id: '1', name: 'Keyboard', online_supported: true },
          { id: '2', name: 'Guitar', online_supported: true },
          { id: '3', name: 'Piano', online_supported: false },
          { id: '4', name: 'Drums', online_supported: false },
          { id: '5', name: 'Tabla', online_supported: false },
          { id: '6', name: 'Violin', online_supported: false },
          { id: '7', name: 'Hindustani Vocals', online_supported: false },
          { id: '8', name: 'Carnatic Vocals', online_supported: false }
        ])
        setLoadingInstruments(false)
      }
    }
    fetchInstruments()
  }, [])

  function updateAnswer(key, value){
    setAnswers(prev => ({...prev, [key]: value}))
    if(error) setError('')
  }


  function toggleStream(instrumentId, checked){
    setAnswers(prev => {
      const curr = new Set(prev.streams || [])
      if(checked) {
        curr.add(instrumentId)
        fetchBatchesForInstrument(instrumentId)
      } else {
        curr.delete(instrumentId)
      }
      return {...prev, streams: Array.from(curr)}
    })
    if(error) setError('')
  }

  async function fetchBatchesForInstrument(instrumentId) {
    setLoadingBatches(prev => ({ ...prev, [instrumentId]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/batches/${instrumentId}`)
      const data = await response.json()
      setBatchesByInstrument(prev => ({
        ...prev,
        [instrumentId]: data.batches || []
      }))
    } catch (err) {
      console.error(`Failed to fetch batches for instrumentId ${instrumentId}:`, err)
      setBatchesByInstrument(prev => ({
        ...prev,
        [instrumentId]: []
      }))
    } finally {
      setLoadingBatches(prev => ({ ...prev, [instrumentId]: false }))
    }
  }

  function next(){
    const key = q.key

    // per question validations
    if(key === 'name'){
      if(!answers.firstName || !answers.lastName){
        setError('Please enter both first and last name.')
        return
      }
    } else if(key === 'streamsAndConfig'){
      // validate streams selection and configuration
      if(!Array.isArray(answers.streams) || answers.streams.length === 0){
        setError('Please select at least one stream.')
        return
      }
      const configs = answers.streamsConfig || {}
      for(const inst of (answers.streams||[])){
        const c = configs[inst] || {}
        if(!c.batch || !c.payment){
          setError(`Please configure batch and payment for ${inst}.`)
          return
        }
      }
    } else {
      const val = answers[key]
      if(!val){
        setError('Please answer this question before continuing.')
        return
      }
      if(key === 'email' && !/^\S+@\S+\.\S+$/.test(val)){
        setError('Please enter a valid email address.')
        return
      }
      if(key === 'telephone' && !/^\+?[1-9]\d{0,2}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/.test(val)){
        setError('Please enter a valid telephone number (e.g., +1 555-555-5555).')
        return
      }
    }

    if(index < QUESTIONS.length -1) setIndex(i=>i+1)
    else {
      // final validation before summary
      if(!validateAll()){
        setError('Please fill all required fields correctly before proceeding.')
        return
      }
      setShowSummary(true)
    }
  }
  function back(){
    if(showSummary) setShowSummary(false)
    else setIndex(i=> Math.max(0, i-1))
  }

  function validateAll(){
    const { firstName, lastName, email, dob, address, guardianName, telephone, streams, streamsConfig, dateOfJoining } = answers
    if(!firstName || !lastName || !email || !dob || !address || !guardianName || !telephone || !Array.isArray(streams) || streams.length === 0 || !streamsConfig || !dateOfJoining) return false
    if(!/^\S+@\S+\.\S+$/.test(email)) return false
    if(!/^\+?[1-9]\d{0,2}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/.test(telephone)) return false
    // ensure each stream has batch/payment
    for(const inst of streams){
      const c = streamsConfig[inst] || {}
      if(!c.batch || !c.payment) return false
      if(!['Monthly','Quarterly'].includes(c.payment)) return false
    }
    return true
  }

  async function submit(){
    setSubmitting(true)
    if(!validateAll()){
      setError('Missing or invalid fields.')
      setSubmitting(false)
      return
    }

    // build payload streams as array of objects, using instrumentId
    const streamsArray = (answers.streams || []).map(instId => ({
      instrument: instId,
      batch: (answers.streamsConfig && answers.streamsConfig[instId] && answers.streamsConfig[instId].batch) || null,
      payment: (answers.streamsConfig && answers.streamsConfig[instId] && answers.streamsConfig[instId].payment) || null
    }))

    const payload = { answers: { ...answers, streams: streamsArray } }

    try{
      const res = await fetch(`${API_BASE_URL}/api/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if(!res.ok) throw new Error('Server error')
      const body = await res.json()
      setSubmitting(false)
      alert('Enrollment submitted to server.')
      setAnswers({})
      setIndex(0)
      setShowSummary(false)
    }catch(err){
      console.warn('API failing, falling back to localStorage', err)
      const stored = JSON.parse(localStorage.getItem('enrollments')||'[]')
      stored.push({answers, createdAt: new Date().toISOString(), fallback: true})
      localStorage.setItem('enrollments', JSON.stringify(stored))
      setSubmitting(false)
      alert('Server unreachable — enrollment saved locally.')
      setAnswers({})
      setIndex(0)
      setShowSummary(false)
    }
  }

  if(showSummary){
    return <Summary answers={answers} onEdit={()=>setShowSummary(false)} onSubmit={submit} />
  }

  return (
    <div className="qa">
      <div className="question">
        <label className="q-label">{q.label}</label>
        {error && <div className="error-banner">{error}<button className="dismiss" onClick={()=>setError('')}>×</button></div>}
        {q.type === 'name' ? (
          <div className="name-row">
            <input className="input" placeholder="First name" value={answers.firstName||''} onChange={e=>updateAnswer('firstName', e.target.value)} />
            <input className="input" placeholder="Last name" value={answers.lastName||''} onChange={e=>updateAnswer('lastName', e.target.value)} />
          </div>
        ) : q.type === 'textarea' ? (
          <textarea className="input" value={answers[q.key]||''} placeholder={q.placeholder||''} onChange={e=>updateAnswer(q.key, e.target.value)} />
        ) : q.type === 'streams-combined' ? (
          <div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontWeight:500,marginBottom:8}}>Select Instruments</label>
              {loadingInstruments ? (
                <div className="hint">Loading instruments...</div>
              ) : (
                <div className="multiselect-list">
                  {instruments.map(inst => (
                    <label key={inst.id} className="ms-item">
                      <input 
                        type="checkbox" 
                        checked={(answers.streams||[]).includes(inst.id)} 
                        onChange={e=>toggleStream(inst.id, e.target.checked)} 
                      /> 
                      {inst.name}
                      {inst.online_supported && <span style={{marginLeft:6,fontSize:'0.85em',color:'#666'}}>(online available)</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {(answers.streams||[]).length > 0 && (
              <div>
                <label style={{display:'block',fontWeight:500,marginBottom:8}}>Configure Batch & Payment</label>
                <StreamsConfigurator 
                  streams={answers.streams||[]} 
                  configs={answers.streamsConfig||{}} 
                  onChange={c=>updateAnswer('streamsConfig', c)} 
                  errors={{}} 
                  batchesByInstrument={batchesByInstrument}
                  loadingBatches={loadingBatches}
                  instruments={instruments}
                />
              </div>
            )}
          </div>
        ) : q.type === 'select' ? (
          <select className="input" value={answers[q.key]||''} onChange={e=>updateAnswer(q.key, e.target.value)}>
            <option value="">Choose</option>
            {q.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            className="input"
            type={q.type}
            value={answers[q.key]||''}
            placeholder={q.placeholder||''}
            onChange={e=>updateAnswer(q.key, e.target.value)}
          />
        )}  
      </div>

      <div className="actions">
        <button className="btn" onClick={back} disabled={index===0 && !Object.keys(answers).length}>Back</button>
        <button className="btn primary" onClick={next}>Next</button>
      </div>

      <div className="progress">{index+1}/{QUESTIONS.length}</div>

      {submitting && <div className="loading">Submitting...</div>}
    </div>
  )
}
