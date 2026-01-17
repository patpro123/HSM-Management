import React, {useEffect, useState} from 'react'
import { API_BASE_URL } from '../config'

export default function AdminPage(){
  const [enrollments, setEnrollments] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    setLoading(true)
    fetch(`${API_BASE_URL}/api/enrollments`)
      .then(r=>r.json())
      .then(b=>{ setEnrollments(b.enrollments || []); setLoading(false) })
      .catch(e=>{ setError('Failed to load enrollments'); setLoading(false) })
  },[])

  if(loading) return <div>Loading...</div>
  if(error) return <div style={{color:'red'}}>{error}</div>

  return (
    <div>
      <h2 style={{marginTop:0}}>Enrollments</h2>
      <div style={{marginTop:12}}>
        {(!enrollments || enrollments.length===0) && <div>No enrollments yet.</div>}
        <ul style={{paddingLeft:0}}>
          {enrollments && enrollments.map(e => (
            <li key={e.id} style={{marginBottom:12, listStyle:'none', background:'#fff', padding:12, borderRadius:8, border:'1px solid #eef2ff'}}>
              <div><strong>Id:</strong> {e.id}</div>
              <div><strong>Date:</strong> {new Date(e.createdAt).toLocaleString()}</div>
              <div><strong>Name:</strong> {e.answers.firstName} {e.answers.lastName}</div>
              <div><strong>Email:</strong> {e.answers.email}</div>
              <div>
                <strong>Streams:</strong>
                <ul style={{marginTop:6}}>
                  {(e.answers.streams||[]).map(s => (
                    <li key={s.instrument} style={{listStyle:'none',padding:6,borderRadius:6,background:'#f7fbff',marginBottom:6}}>
                      <div><strong>{s.instrument}</strong></div>
                      <div>Batch: {s.batch}</div>
                      <div>Payment: {s.payment}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
