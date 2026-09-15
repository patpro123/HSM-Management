import React, { useEffect, useState } from 'react';
import { pdf, Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { apiGet, apiPost } from '../api';
import hsmLogo from '../images/hsmLogo.jpg';

interface ReceiptData {
  payment_id: string;
  receipt_number: string;
  date: string;
  student_name: string;
  student_phone: string | null;
  student_email: string | null;
  amount: number | string;
  payment_method: string | null;
  description: string;
  location_label: string | null;
  recorded_by_name: string | null;
}

function fmtAmount(val: number | string) {
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── PDF Document ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page:       { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logo:       { width: 60, height: 60, marginRight: 14 },
  schoolName: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  contactLine:{ fontSize: 8.5, color: '#64748b', marginTop: 2 },
  divider:    { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 14 },
  title:      { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 16, letterSpacing: 1 },
  metaRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaLabel:  { fontSize: 8.5, color: '#64748b' },
  metaValue:  { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  row:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label:      { fontSize: 9.5, color: '#475569' },
  value:      { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  amountRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#10b981' },
  amountLabel:{ fontSize: 11, fontFamily: 'Helvetica-Bold' },
  amountValue:{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#10b981' },
  footer:     { marginTop: 40, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
});

const ReceiptPDF: React.FC<{ data: ReceiptData }> = ({ data }) => (
  <Document title={`Receipt ${data.receipt_number}`}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Image src={hsmLogo} style={styles.logo} />
        <View>
          <Text style={styles.schoolName}>Hyderabad School of Music</Text>
          <Text style={styles.contactLine}>Abhyudaya Nagar, Kishan Nagar Colony, Hyderabad – 500086</Text>
          <Text style={styles.contactLine}>+91 96524 44188  |  adminuser@hsm.org.in</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.title}>PAYMENT RECEIPT</Text>

      <View style={styles.metaRow}>
        <View>
          <Text style={styles.metaLabel}>Receipt No.</Text>
          <Text style={styles.metaValue}>{data.receipt_number}</Text>
        </View>
        <View>
          <Text style={styles.metaLabel}>Date</Text>
          <Text style={styles.metaValue}>{fmtDate(data.date)}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Student Name</Text>
        <Text style={styles.value}>{data.student_name}</Text>
      </View>
      {data.location_label && (
        <View style={styles.row}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{data.location_label}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.label}>Description</Text>
        <Text style={styles.value}>{data.description}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Payment Method</Text>
        <Text style={styles.value}>{(data.payment_method || '').toUpperCase()}</Text>
      </View>
      {data.recorded_by_name && (
        <View style={styles.row}>
          <Text style={styles.label}>Received By</Text>
          <Text style={styles.value}>{data.recorded_by_name}</Text>
        </View>
      )}

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount Paid</Text>
        <Text style={styles.amountValue}>{fmtAmount(data.amount)}</Text>
      </View>

      <Text style={styles.footer}>
        This is a computer-generated receipt and does not require a signature.
      </Text>
    </Page>
  </Document>
);

// ── Receipt Panel ────────────────────────────────────────────────────────────

interface ReceiptPanelProps {
  paymentId: string;
  onClose: () => void;
}

const ReceiptPanel: React.FC<ReceiptPanelProps> = ({ paymentId, onClose }) => {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    apiGet(`/api/receipts/${paymentId}`)
      .then((d: ReceiptData) => {
        setData(d);
        setEmailTo(d.student_email || '');
      })
      .catch(() => setError('Failed to load receipt.'))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const buildBlob = async (d: ReceiptData) => (await pdf(<ReceiptPDF data={d} />)).toBlob();

  const handleDownload = async () => {
    if (!data) return;
    const blob = await buildBlob(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${data.receipt_number.replace(/\//g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    if (!data || !emailTo.trim()) return;
    setSendingEmail(true);
    setEmailSent(false);
    try {
      const blob = await buildBlob(data);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await apiPost(`/api/receipts/${paymentId}/email`, {
        to: emailTo.trim(),
        pdf_base64: base64,
        student_name: data.student_name,
        receipt_number: data.receipt_number,
        amount: data.amount,
      });
      setEmailSent(true);
    } catch {
      setError('Failed to send email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleForwardWhatsapp = async () => {
    if (!data) return;
    setSendingWhatsapp(true);
    try {
      await handleDownload();
      const phone = (data.student_phone || '').replace(/\D/g, '');
      const msg = encodeURIComponent(
        `Hi, please find attached the payment receipt (${data.receipt_number}) for ${data.student_name}. — HSM`
      );
      const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
      window.open(url, '_blank');
      apiPost(`/api/receipts/${paymentId}/log-whatsapp`, { recipient: data.student_phone }).catch(() => {});
    } finally {
      setSendingWhatsapp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Payment Receipt</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {loading && <div className="text-sm text-slate-500">Loading receipt...</div>}
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {data && !loading && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt No.</span>
                  <span className="font-semibold">{data.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student</span>
                  <span className="font-semibold">{data.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold text-emerald-600">{fmtAmount(data.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Description</span>
                  <span className="font-semibold">{data.description}</span>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
              >
                Download PDF
              </button>

              <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-600">Send via Email</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => { setEmailTo(e.target.value); setEmailSent(false); }}
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailTo.trim()}
                  className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 disabled:opacity-50 transition text-sm"
                >
                  {sendingEmail ? 'Sending…' : emailSent ? 'Sent ✓' : 'Send Email'}
                </button>
              </div>

              <button
                onClick={handleForwardWhatsapp}
                disabled={sendingWhatsapp}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition text-sm"
              >
                Forward via WhatsApp
              </button>
              {!data.student_phone && (
                <p className="text-xs text-slate-400 text-center -mt-2">No phone on file — WhatsApp will open without a pre-filled contact.</p>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPanel;
