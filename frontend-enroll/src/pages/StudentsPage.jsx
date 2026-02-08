import React, { useState, useEffect } from 'react'

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterInstrument, setFilterInstrument] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('card')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/enrollments')
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to fetch: ${res.status}`)
      }
      const data = await res.json()
      setStudents(data.enrollments || [])
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setImagePreview(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = async (studentId) => {
    if (!imagePreview || !selectedStudent) return
    try {
      setUploadingImage(true)
      const res = await fetch(`/api/students/${studentId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview })
      })
      if (!res.ok) throw new Error('Upload failed')
      setImagePreview(null)
      await fetchStudents()
      setSelectedStudent(null)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const getUniqueInstruments = () => {
    const instruments = new Set()
    students.forEach(s => s.batches?.forEach(b => b.instrument && instruments.add(b.instrument)))
    return Array.from(instruments).sort()
  }

  const getUniqueTeachers = () => {
    const teachers = new Set()
    students.forEach(s => s.batches?.forEach(b => b.teacher && teachers.add(b.teacher)))
    return Array.from(teachers).sort()
  }

  const getUniqueBatches = () => {
    const batches = new Set()
    students.forEach(s => s.batches?.forEach(b => b.batch_recurrence && batches.add(b.batch_recurrence)))
    return Array.from(batches).sort()
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = !searchQuery || 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone?.includes(searchQuery) ||
      student.guardian_contact?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesInstrument = !filterInstrument || 
      student.batches?.some(b => b.instrument === filterInstrument)
    
    const matchesTeacher = !filterTeacher || 
      student.batches?.some(b => b.teacher === filterTeacher)
    
    const matchesBatch = !filterBatch || 
      student.batches?.some(b => b.batch_recurrence === filterBatch)
    
    return matchesSearch && matchesInstrument && matchesTeacher && matchesBatch
  })

  const clearFilters = () => {
    setSearchQuery('')
    setFilterInstrument('')
    setFilterTeacher('')
    setFilterBatch('')
    setCurrentPage(1)
  }

  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex)

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading students...</div>

  return (
    <div className="students-container">
      <div className="students-header">
        <h2>Student Directory</h2>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card View"
            >
              ⊞
            </button>
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ☰
            </button>
          </div>
          <button className="filter-toggle-btn" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? '✕ Hide Filters' : '🔍 Show Filters'}
          </button>
          <button className="refresh-btn" onClick={fetchStudents}>↻ Refresh</button>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, phone, or guardian..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Instrument</label>
            <select value={filterInstrument} onChange={(e) => setFilterInstrument(e.target.value)}>
              <option value="">All Instruments</option>
              {getUniqueInstruments().map(inst => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Teacher</label>
            <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
              <option value="">All Teachers</option>
              {getUniqueTeachers().map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Batch</label>
            <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
              <option value="">All Batches</option>
              {getUniqueBatches().map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
          {(filterInstrument || filterTeacher || filterBatch) && (
            <button className="clear-filters-btn" onClick={clearFilters}>Clear All Filters</button>
          )}
        </div>
      )}

      <div className="results-count">
        Showing {startIndex + 1}-{Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
        {filteredStudents.length < students.length && ` (filtered from ${students.length} total)`}
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {students.length === 0 ? (
        <div className="empty-state">No students enrolled yet.</div>
      ) : filteredStudents.length === 0 ? (
        <div className="empty-state">No students match your search criteria.</div>
      ) : viewMode === 'grid' ? (
        <div className="students-table-container">
          <table className="students-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>DOB</th>
                <th>Phone</th>
                <th>Guardian</th>
                <th>Instruments</th>
                <th>Classes Left</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student.student_id}>
                  <td>
                    <div className="table-image-cell">
                      {student.metadata?.image ? (
                        <img src={student.metadata.image} alt={student.name} className="table-student-image" />
                      ) : (
                        <div className="table-image-placeholder">📷</div>
                      )}
                    </div>
                  </td>
                  <td className="student-name-cell">{student.name}</td>
                  <td>{student.dob}</td>
                  <td>{student.phone}</td>
                  <td>{student.guardian_contact}</td>
                  <td>
                    {student.batches && student.batches.length > 0 ? (
                      <div className="table-instruments">
                        {student.batches.map((b, idx) => (
                          <span key={idx} className="instrument-tag">{b.instrument}</span>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                  <td><span className="classes-badge">{student.classes_remaining}</span></td>
                  <td><span className={`status-badge ${student.status}`}>{student.status}</span></td>
                  <td>
                    <button 
                      className="table-action-btn"
                      onClick={() => setSelectedStudent(student)}
                      title="Upload photo"
                    >
                      📸
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="students-grid">
          {paginatedStudents.map((student) => (
            <div key={student.student_id} className="student-card">
              <div className="card-image-container">
                {student.metadata?.image ? (
                  <img src={student.metadata.image} alt={student.name} className="student-image" />
                ) : (
                  <div className="student-image-placeholder">
                    <span className="placeholder-icon">📷</span>
                  </div>
                )}
                <button
                  className="edit-image-btn"
                  onClick={() => setSelectedStudent(student)}
                >
                  📸
                </button>
              </div>

              <div className="card-body">
                <h3 className="student-name">{student.name}</h3>
                <div className="student-meta">
                  <p><strong>DOB:</strong> {student.dob}</p>
                  <p><strong>Phone:</strong> {student.phone}</p>
                  <p><strong>Guardian:</strong> {student.guardian_contact}</p>
                </div>

                <div className="enrollment-info">
                  <p><strong>Classes Remaining:</strong> <span className="classes-badge">{student.classes_remaining}</span></p>
                  <p><strong>Status:</strong> <span className={`status-badge ${student.status}`}>{student.status}</span></p>
                </div>

                {student.batches && student.batches.length > 0 && (
                  <div className="batches-list">
                    <p><strong>Batches:</strong></p>
                    <ul>
                      {student.batches.map((batch, idx) => (
                        <li key={idx}>
                          <span className="batch-instrument">{batch.instrument}</span>
                          <span className="batch-time">{batch.batch_recurrence}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredStudents.length > 0 && totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
          >
            ««
          </button>
          <button 
            className="pagination-btn"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          
          <div className="pagination-info">
            <select 
              className="page-select"
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <option key={page} value={page}>Page {page}</option>
              ))}
            </select>
            <span className="pagination-text">of {totalPages}</span>
            
            <select 
              className="items-per-page-select"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={12}>12 per page</option>
              <option value={24}>24 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          
          <button 
            className="pagination-btn"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
          <button 
            className="pagination-btn"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            »»
          </button>
        </div>
      )}

      {selectedStudent && (
        <div className="modal-overlay" onClick={() => { setSelectedStudent(null); setImagePreview(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Upload Photo for {selectedStudent.name}</h3>
            <div className="image-upload-section">
              {imagePreview ? (
                <div className="preview-container">
                  <img src={imagePreview} alt="preview" className="image-preview" />
                  <div className="preview-actions">
                    <button
                      className="btn primary"
                      onClick={() => handleImageUpload(selectedStudent.student_id)}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? 'Uploading...' : 'Confirm Upload'}
                    </button>
                    <button
                      className="btn"
                      onClick={() => setImagePreview(null)}
                      disabled={uploadingImage}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="upload-area">
                  <label htmlFor="image-input" className="upload-label">
                    <span className="upload-icon">📤</span>
                    <span>Click to select image</span>
                    <input
                      id="image-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
            <button className="btn close-btn" onClick={() => { setSelectedStudent(null); setImagePreview(null) }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
