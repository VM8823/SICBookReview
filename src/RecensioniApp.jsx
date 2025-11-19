import React, { useState, useEffect } from 'react';
import {
  Save,
  Upload,
  X,
  Calendar,
  BookOpen,
  User,
  Mail,
  ExternalLink,
  Lock,
  Unlock,
  FileText,
  Download,      // Icona export
  Filter,        // Icona filtro
  Loader2,       // Icona caricamento
  CheckCircle,   // Icona successo
  AlertCircle    // Icona errore
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { supabase } from './supabaseClient';

// === CONFIGURAZIONE EMAILJS ===
const EMAILJS_SERVICE_ID = 'service_u4jt49x';
const EMAILJS_TEMPLATE_ID = 'template_alvdimz';
const EMAILJS_PUBLIC_KEY = '7XpH6J5xigFu_9mum';

// === STORAGE LOCALE ===
const storage = {
  async get(key) {
    try {
      if (typeof window === 'undefined') return null;
      const value = window.localStorage.getItem(key);
      return value ? { value } : null;
    } catch (error) {
      console.error('Errore lettura storage', error);
      return null;
    }
  },
  async set(key, value) {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error('Errore scrittura storage', error);
    }
  }
};

// Helper: Validazione Email (Regex)
const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

// Sostituzione segnaposto template
const applyTemplate = (template, context) => {
  if (!template) return '';
  const map = {
    '{{Nome}}': context.nome || '',
    '{{Cognome}}': context.cognome || '',
    '{{NomeCompleto}}': context.nomeCognome || '',
    '{{Titolo}}': context.titolo || '',
    '{{Autore}}': context.autore || '',
    '{{Mese}}': context.mese || '',
    '{{DataPubblicazione}}': context.dataPubblicazione || '',
    '{{DataInvioInfo}}': context.dataInvioInfo || '',
    '{{DataInvioRecensione}}': context.dataInvioRecensione || '',
    '{{DataInvioCommenti}}': context.dataInvioCommenti || '',
    '{{DataInvioRecensioneConCommenti}}': context.dataInvioRecensioneConCommenti || '',
    '{{DataPreparazionePubblicazione}}': context.dataPreparazionePubblicazione || '',
    '{{TemplateRecensioneUrl}}': context.reviewTemplateUrl || '',
    '{{InformativaPrivacyUrl}}': context.privacyTemplateUrl || '',
    '{{AmazonUrl}}': context.link || '',
    '{{CoverImage}}': context.copertina || ''
  };
  let result = template;
  Object.entries(map).forEach(([token, value]) => {
    result = result.split(token).join(value);
  });
  return result;
};

const normalizeUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
};

const normalizeRecipientsList = (value) => {
  if (!value) return '';
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && validateEmail(s))
    .join(', ');
};

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

// Palette colori aggiornata
const COLORS = {
  accent: 'rgb(255, 97, 15)',
  secondary: 'rgb(5, 191, 224)',
  primary: 'rgb(79, 23, 168)',
  success: '#166534',
  successBg: '#dcfce7',
  error: '#b91c1c',
  errorBg: '#fee2e2'
};

const isBookAssigned = (book) => !!(book.mese && book.nomeCognome && book.email);

const mapBookFromDb = (row) => ({
  id: row.id,
  anno: row.anno,
  titolo: row.titolo || '',
  autore: row.autore || '',
  link: row.link || '',
  pagine: row.pagine ?? '',
  mese: row.mese || '',
  nomeCognome: row.nome_cognome || '',
  nome: row.nome || '',
  cognome: row.cognome || '',
  email: row.email || '',
  copertina: row.copertina || '',
  dataPubblicazione: row.data_pubblicazione || '',
  dataInvioInfo: row.data_invio_info || '',
  dataInvioRecensione: row.data_invio_recensione || '',
  dataInvioCommenti: row.data_invio_commenti || '',
  dataInvioRecensioneConCommenti: row.data_invio_recensione_con_commenti || '',
  dataPreparazionePubblicazione: row.data_preparazione_pubblicazione || ''
});

const mapBookToDb = (libro, annoCorrente) => ({
  anno: libro.anno ?? annoCorrente,
  titolo: libro.titolo || '',
  autore: libro.autore || '',
  link: libro.link || '',
  pagine: libro.pagine === '' || libro.pagine === null ? null : Number(libro.pagine),
  mese: libro.mese || '',
  nome_cognome: libro.nomeCognome || '',
  nome: libro.nome || '',
  cognome: libro.cognome || '',
  email: libro.email || '',
  copertina: libro.copertina || '',
  data_pubblicazione: libro.dataPubblicazione || '',
  data_invio_info: libro.dataInvioInfo || '',
  data_invio_recensione: libro.dataInvioRecensione || '',
  data_invio_commenti: libro.dataInvioCommenti || '',
  data_invio_recensione_con_commenti: libro.dataInvioRecensioneConCommenti || '',
  data_preparazione_pubblicazione: libro.dataPreparazionePubblicazione || ''
});

const RecensioniApp = () => {
  // Stati Generali
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Stati Dati
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [libri, setLibri] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState('');
  
  // Stati Selezione e Modali
  const [selectedBook, setSelectedBook] = useState(null);
  const [recensoreData, setRecensoreData] = useState({ mese: '', nome: '', cognome: '', email: '' });
  const [emailError, setEmailError] = useState(false);
  const [showPostConfirmModal, setShowPostConfirmModal] = useState(false);
  const [lastConfirmedBookId, setLastConfirmedBookId] = useState(null);
  
  // Stati Filtri e Messaggi
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'assigned', 'free'
  const [message, setMessage] = useState({ text: '', type: '' });

  const [emailConfig, setEmailConfig] = useState({
    subjectTemplate: 'Recensione del mese di {{Mese}} – {{Titolo}}',
    bodyTemplate: '<p>Ciao {{Nome}},</p><p>Grazie per l’interesse...</p>', 
    fixedRecipients: '',
    reviewTemplateUrl: '',
    privacyTemplateUrl: ''
  });
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // Init EmailJS
  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY) emailjs.init(EMAILJS_PUBLIC_KEY);
  }, []);

  // Caricamento dati al cambio anno
  useEffect(() => { loadData(); }, [anno]);

  // Messaggio persistente con chiusura manuale
  const showMessage = (text, type) => {
    setMessage({ text, type });
  };
  const closeMessage = () => setMessage({ text: '', type: '' });

  // Login
  const handleLogin = () => {
    if (adminPassword === 'admin2026') {
      setIsAdmin(true);
      setShowLogin(false);
    } else {
      showMessage('Password errata', 'error');
    }
  };

  // Calcolo Date
  const calcolaDate = (mese) => {
    const meseIndex = MESI.indexOf(mese);
    if (meseIndex === -1) return {};
    const getUltimaDomenica = (anno, mese) => {
      const d = new Date(anno, mese + 1, 0);
      while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
      return d;
    };
    const getPrimoLunedi = (anno, mese) => {
      const d = new Date(anno, mese, 1);
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      return d.toLocaleDateString('it-IT');
    };
    const addDays = (baseDate, offset) => {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() + offset);
      return d.toLocaleDateString('it-IT');
    };
    const ultimaDomenica = getUltimaDomenica(anno, meseIndex);
    return {
      dataPubblicazione: ultimaDomenica.toLocaleDateString('it-IT'),
      dataInvioInfo: getPrimoLunedi(anno, meseIndex),
      dataInvioRecensione: addDays(ultimaDomenica, -4),
      dataInvioCommenti: addDays(ultimaDomenica, -3),
      dataInvioRecensioneConCommenti: addDays(ultimaDomenica, -2),
      dataPreparazionePubblicazione: addDays(ultimaDomenica, -1)
    };
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('anno', anno)
        .order('id', { ascending: true });

      if (error) throw error;
      setLibri((data || []).map(mapBookFromDb));

      // Carico config solo se non già caricata
      const bgResult = await storage.get('background_image');
      if (bgResult) setBackgroundImage(bgResult.value);
      
      const emailCfg = await storage.get('email_config');
      if (emailCfg) setEmailConfig(prev => ({ ...prev, ...JSON.parse(emailCfg.value) }));
      
    } catch (error) {
      console.error(error);
      showMessage('Errore caricamento dati', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // EXPORT CSV (Nativo, sicuro, senza librerie esterne)
  const handleExportCsv = () => {
    if (libri.length === 0) {
      showMessage("Nessun dato da esportare", "error");
      return;
    }

    const headers = [
      "ID", "Anno", "Titolo", "Autore", "Mese", 
      "Recensore Nome", "Recensore Cognome", "Recensore Email", 
      "Data Pubblicazione", "Link Amazon"
    ];

    // Mappatura righe con escape delle virgolette
    const rows = libri.map(l => [
      l.id,
      l.anno,
      `"${(l.titolo || '').replace(/"/g, '""')}"`,
      `"${(l.autore || '').replace(/"/g, '""')}"`,
      l.mese,
      l.nome,
      l.cognome,
      l.email,
      l.dataPubblicazione,
      l.link
    ]);

    // Costruzione stringa CSV con separatore punto e virgola (Excel IT)
    const csvContent = [
      headers.join(';'), 
      ...rows.map(r => r.join(';'))
    ].join('\n');

    // Blob con BOM (\ufeff) per supporto caratteri speciali
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Recensioni_SIC_${anno}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload Immagine su Supabase Storage
  const handleImageUpload = async (e, libroId = null) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsLoading(true);

    try {
      const fileExt = file.name.split('.').pop();
      // Nome univoco timestamp
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('covers').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      if (libroId) {
        await aggiornaLibro(libroId, 'copertina', publicUrl);
      } else {
        setBackgroundImage(publicUrl);
        storage.set('background_image', publicUrl);
      }
      showMessage('Immagine caricata con successo', 'success');
    } catch (error) {
      console.error(error);
      showMessage('Errore upload immagine', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // CRUD
  const aggiungiLibro = async () => {
    setIsLoading(true);
    try {
      const nuovo = { anno, titolo: '', autore: '', ...calcolaDate('') };
      const { data, error } = await supabase.from('books').insert([mapBookToDb(nuovo, anno)]).select().single();
      if (error) throw error;
      setLibri(prev => [...prev, mapBookFromDb(data)]);
      showMessage('Libro aggiunto', 'success');
    } catch (err) {
      showMessage('Errore creazione libro', 'error');
    } finally { setIsLoading(false); }
  };

  const aggiornaLibro = async (id, campo, valore) => {
    const libro = libri.find(l => l.id === id);
    if (!libro) return;
    let aggiornato = { ...libro, [campo]: valore };
    
    if (campo === 'mese') aggiornato = { ...aggiornato, ...calcolaDate(valore) };
    // Fallback nome completo per admin
    if (campo === 'nomeCognome') {
      const p = valore.trim().split(' ');
      aggiornato = { ...aggiornato, nome: p[0]||'', cognome: p.slice(1).join(' ')||'' };
    }

    try {
      const { error } = await supabase.from('books').update(mapBookToDb(aggiornato, anno)).eq('id', id);
      if (error) throw error;
      setLibri(prev => prev.map(l => l.id === id ? aggiornato : l));
    } catch (err) {
      console.error(err);
      showMessage('Errore salvataggio', 'error');
    }
  };

  const rimuoviLibro = async (id) => {
    if(!window.confirm("Sei sicuro di voler eliminare questo libro?")) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('books').delete().eq('id', id);
      if (error) throw error;
      setLibri(prev => prev.filter(l => l.id !== id));
      showMessage('Libro eliminato', 'success');
    } catch (err) {
      showMessage('Errore cancellazione', 'error');
    } finally { setIsLoading(false); }
  };

  const clearReviewer = async (id) => {
    if(!window.confirm("Vuoi liberare questo libro e rimuovere il recensore?")) return;
    setIsLoading(true);
    try {
      const libro = libri.find(l => l.id === id);
      const pulito = { 
        ...libro, 
        nomeCognome: '', nome: '', cognome: '', email: '', mese: '',
        dataPubblicazione: '', dataInvioInfo: '', dataInvioRecensione: '', 
        dataInvioCommenti: '', dataInvioRecensioneConCommenti: '', dataPreparazionePubblicazione: '' 
      };
      const { error } = await supabase.from('books').update(mapBookToDb(pulito, anno)).eq('id', id);
      if (error) throw error;
      setLibri(prev => prev.map(l => l.id === id ? pulito : l));
      showMessage('Libro liberato', 'success');
    } catch (err) {
      showMessage('Errore operazione', 'error');
    } finally { setIsLoading(false); }
  };

  // Selezione Recensore
  const selezionaLibro = (libro) => {
    if (isBookAssigned(libro)) { showMessage('Libro già assegnato', 'error'); return; }
    setSelectedBook(libro);
    setRecensoreData({ mese: '', nome: '', cognome: '', email: '' });
    setEmailError(false);
  };

  const confermaRecensione = async () => {
    // Validazione
    if (!recensoreData.mese || !recensoreData.nome || !recensoreData.cognome || !recensoreData.email) {
      showMessage('Compila tutti i campi', 'error');
      return;
    }
    if (!validateEmail(recensoreData.email)) {
      setEmailError(true);
      showMessage('Indirizzo email non valido', 'error');
      return;
    }

    setIsLoading(true);

    const recensioniAttiveArray = libri.filter(isBookAssigned);
    // Check mese
    if (recensioniAttiveArray.some(l => l.mese === recensoreData.mese && l.id !== selectedBook.id)) {
      showMessage('Mese già impegnato', 'error');
      setIsLoading(false); return;
    }
    // Check email duplicate
    if (recensioniAttiveArray.some(l => l.email === recensoreData.email && l.id !== selectedBook.id)) {
      showMessage('Hai già una recensione in corso', 'error');
      setIsLoading(false); return;
    }

    const libroOriginale = libri.find(l => l.id === selectedBook.id);
    const date = calcolaDate(recensoreData.mese);
    const nomeCompleto = `${recensoreData.nome.trim()} ${recensoreData.cognome.trim()}`;

    const aggiornato = {
      ...libroOriginale,
      mese: recensoreData.mese,
      nomeCognome: nomeCompleto,
      nome: recensoreData.nome.trim(),
      cognome: recensoreData.cognome.trim(),
      email: recensoreData.email.trim(),
      ...date
    };

    try {
      const { error } = await supabase.from('books').update(mapBookToDb(aggiornato, anno)).eq('id', aggiornato.id);
      if (error) throw error;
      
      setLibri(prev => prev.map(l => l.id === aggiornato.id ? aggiornato : l));
      setSelectedBook(null);
      setLastConfirmedBookId(aggiornato.id);
      setShowPostConfirmModal(true);
      showMessage('Prenotazione confermata!', 'success');
    } catch (err) {
      console.error(err);
      showMessage('Errore salvataggio prenotazione', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async (libro) => {
    if (!EMAILJS_SERVICE_ID) { showMessage('Config EmailJS mancante', 'error'); return; }
    setIsLoading(true);
    
    try {
      let coverUrl = libro.copertina || '';
      // Check sicurezza Base64: se è base64 non lo mando
      if (coverUrl.startsWith('data:')) coverUrl = '';

      const context = {
        nome: libro.nome, cognome: libro.cognome, nomeCognome: libro.nomeCognome,
        titolo: libro.titolo, autore: libro.autore, mese: libro.mese,
        dataPubblicazione: libro.dataPubblicazione, dataInvioInfo: libro.dataInvioInfo,
        dataInvioRecensione: libro.dataInvioRecensione, dataInvioCommenti: libro.dataInvioCommenti,
        dataInvioRecensioneConCommenti: libro.dataInvioRecensioneConCommenti,
        dataPreparazionePubblicazione: libro.dataPreparazionePubblicazione,
        reviewTemplateUrl: emailConfig.reviewTemplateUrl, privacyTemplateUrl: emailConfig.privacyTemplateUrl,
        link: normalizeUrl(libro.link), copertina: coverUrl
      };
      
      const subject = applyTemplate(emailConfig.subjectTemplate, context);
      const templateParams = {
        to_email: libro.email,
        cc_email: normalizeRecipientsList(emailConfig.fixedRecipients),
        CoverImage: coverUrl, // Url Immagine per il template
        subject,
        ...context
      };

      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
      showMessage('Email inviata correttamente', 'success');
    } catch (error) {
      console.error(error);
      showMessage('Errore invio email', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) return;
    const toEmail = testEmailAddress.trim();
    if (!toEmail) { showMessage('Email test mancante', 'error'); return; }
    setIsLoading(true);

    try {
      const context = {
        nome: 'Mario', cognome: 'Rossi', nomeCognome: 'Mario Rossi',
        titolo: 'Titolo Test', autore: 'Autore Test', mese: 'Gennaio',
        dataPubblicazione: '27/01/2026', dataInvioInfo: '04/01/2026',
        dataInvioRecensione: '23/01/2026', dataInvioCommenti: '24/01/2026',
        dataInvioRecensioneConCommenti: '25/01/2026', dataPreparazionePubblicazione: '26/01/2026',
        reviewTemplateUrl: emailConfig.reviewTemplateUrl, privacyTemplateUrl: emailConfig.privacyTemplateUrl,
        link: normalizeUrl('https://www.google.com'), copertina: ''
      };
      const subject = applyTemplate(emailConfig.subjectTemplate, context);
      
      const templateParams = {
        to_email: toEmail,
        cc_email: normalizeRecipientsList(emailConfig.fixedRecipients),
        to_name: 'Test Recipient',
        subject,
        ...context
      };
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
      showMessage('Email di prova inviata', 'success');
    } catch (error) {
      showMessage('Errore invio prova', 'error');
    } finally { setIsLoading(false); }
  };

  const handleSendEmailFromModal = () => {
    const libro = libri.find((l) => l.id === lastConfirmedBookId);
    if (!libro) return;
    handleSendEmail(libro);
    setShowPostConfirmModal(false);
  };

  // Gestione Filtri e Ordinamento
  const recensioniAttive = libri.filter(isBookAssigned).length;
  const isBloccato = recensioniAttive >= 12;

  const libriFiltrati = libri.filter(l => {
    if (!isAdmin) return !isBookAssigned(l);
    if (filterStatus === 'assigned') return isBookAssigned(l);
    if (filterStatus === 'free') return !isBookAssigned(l);
    return true;
  });

  const libriOrdinati = [...libriFiltrati].sort((a, b) => {
    if (isAdmin) {
        const aAssigned = isBookAssigned(a);
        const bAssigned = isBookAssigned(b);
        if (aAssigned && !bAssigned) return -1;
        if (!aAssigned && bAssigned) return 1;
        if (aAssigned && bAssigned) {
             const ia = MESI.indexOf(a.mese);
             const ib = MESI.indexOf(b.mese);
             if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
        }
    }
    return (a.titolo||'').localeCompare(b.titolo||'');
  });

  // Styles
  const appWrapperStyle = { minHeight: '100vh', padding: '16px 12px', backgroundImage: backgroundImage ? `url(${backgroundImage})` : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary}, ${COLORS.primary})`, backgroundSize: 'cover', backgroundAttachment: 'fixed', fontFamily: 'Segoe UI, sans-serif' };
  const headerCardStyle = { position: 'sticky', top: 8, zIndex: 40, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderRadius: '16px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', padding: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: 12 };
  const cardGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' };
  
  const getBookCardStyle = (assigned) => ({
    background: assigned ? '#f0fdf4' : 'rgba(255,255,255,0.98)',
    borderRadius: '14px',
    boxShadow: assigned ? '0 4px 12px rgba(22, 101, 52, 0.15)' : '0 8px 16px rgba(0,0,0,0.08)',
    border: assigned ? `1px solid ${COLORS.success}` : '1px solid transparent',
    overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s',
    opacity: (isAdmin && filterStatus==='free' && assigned) ? 0.5 : 1
  });

  const monthBadgeStyle = {
    display: 'inline-block', padding: '4px 8px', borderRadius: '6px',
    background: '#ede9fe', color: COLORS.primary, fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px'
  };

  // Login Screen
  if (showLogin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary}, ${COLORS.primary})` }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
             <BookOpen size={48} color={COLORS.primary} />
             <h2 style={{ margin: '10px 0 0', color: '#333' }}>SIC Book Review</h2>
          </div>
          <button onClick={() => {setShowLogin(false); setIsAdmin(false)}} style={{ width: '100%', padding: '12px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: '10px', marginBottom: 20, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><User size={18}/> Recensore</button>
          <div style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
             <input type="password" placeholder="Password Admin" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: 10 }} />
             <button onClick={handleLogin} style={{ width: '100%', padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: 8 }}><Lock size={18}/> Admin</button>
          </div>
        </div>
      </div>
    );
  }

  // APP PRINCIPALE
  return (
    <div style={appWrapperStyle}>
      <div style={{ maxWidth: isAdmin ? '1200px' : '1000px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={headerCardStyle}>
          {/* Riga 1: Titolo e Contatori */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: COLORS.primary, padding: 8, borderRadius: 10, color: '#fff' }}><BookOpen size={24} /></div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#1e293b' }}>SIC Book Review</h1>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {isAdmin ? 'Pannello Amministratore' : 'Portale Recensori'} · Assegnati: <strong>{recensioniAttive}/12</strong>
                </span>
              </div>
            </div>

            {/* Messaggio Persistente */}
            {message.text && (
              <div style={{ 
                flex: 1, minWidth: '280px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: message.type === 'success' ? COLORS.successBg : COLORS.errorBg,
                color: message.type === 'success' ? COLORS.success : COLORS.error
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   {message.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                   {message.text}
                </div>
                <button onClick={closeMessage} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16}/></button>
              </div>
            )}
          </div>

          {/* Riga 2: Controlli Admin */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            {isAdmin ? (
              <>
                {/* Selettore Anno */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '8px', padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                   <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginRight: 6 }}>ANNO:</span>
                   <select value={anno} onChange={(e) => setAnno(Number(e.target.value))} style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                   </select>
                </div>

                {/* Filtri Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: 4, gap: 2 }}>
                  {['all', 'assigned', 'free'].map(status => (
                    <button 
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      style={{ 
                        border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                        background: filterStatus === status ? '#fff' : 'transparent',
                        color: filterStatus === status ? '#0f172a' : '#64748b',
                        boxShadow: filterStatus === status ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {status === 'all' ? 'Tutti' : status === 'assigned' ? 'Assegnati' : 'Liberi'}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1 }} /> 

                {/* Export CSV Nativo */}
                <button onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={aggiungiLibro} style={{ display: 'flex', alignItems: 'center', gap: 6, background: COLORS.primary, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <BookOpen size={14} /> Nuovo
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: COLORS.secondary, color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  <Upload size={14} /> Sfondo
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </>
            ) : (
              /* Header Recensore */
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Scegli un libro disponibile e candidati per la recensione.</span>
                <button onClick={() => setShowLogin(true)} style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', color: '#475569' }}>Logout</button>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader2 size={40} color={COLORS.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Caricamento in corso...</p>
          </div>
        )}

        {!isLoading && (
          <div style={cardGridStyle}>
            {libriOrdinati.map((libro) => {
              const assigned = isBookAssigned(libro);
              return (
                <div key={libro.id} style={getBookCardStyle(assigned)}>
                  {libro.copertina && <img src={libro.copertina} alt="cover" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    
                    {/* Riga ID/Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: '24px' }}>
                      {isAdmin ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>ID: {libro.id}</span>
                      ) : <span/>}
                      
                      {assigned && isAdmin && (
                         <span style={monthBadgeStyle}>{libro.mese}</span>
                      )}
                    </div>

                    {/* Titolo e Info */}
                    <div>
                       <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0', lineHeight: 1.3 }}>{libro.titolo || 'Titolo...'}</h3>
                       <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{libro.autore}</p>
                    </div>

                    {/* Link Amazon */}
                    {libro.link && (
                       <a href={normalizeUrl(libro.link)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', color: COLORS.secondary, textDecoration: 'none', fontWeight: 600 }}>
                         <ExternalLink size={12} /> Vedi su Amazon
                       </a>
                    )}

                    {/* Sezione Admin Edit */}
                    {isAdmin && (
                      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Campi veloci */}
                        <input type="text" placeholder="Titolo" value={libro.titolo} onChange={e => aggiornaLibro(libro.id, 'titolo', e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" placeholder="Autore" value={libro.autore} onChange={e => aggiornaLibro(libro.id, 'autore', e.target.value)} style={{ flex:1, padding: 6, borderRadius: 4, border: '1px solid #e2e8f0', fontSize: '12px' }} />
                            <input type="number" placeholder="Pg" value={libro.pagine} onChange={e => aggiornaLibro(libro.id, 'pagine', e.target.value)} style={{ width: 50, padding: 6, borderRadius: 4, border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        </div>
                        <input type="file" onChange={e => handleImageUpload(e, libro.id)} style={{ fontSize: '10px' }} />
                        
                        {/* Sezione Assegnazione */}
                        {assigned ? (
                          <div style={{ background: '#f0fdf4', padding: 8, borderRadius: 6, fontSize: '12px' }}>
                            <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>Assegnato a:</div>
                            <div>{libro.nome} {libro.cognome}</div>
                            <div style={{ color: '#64748b', fontSize: '11px' }}>{libro.email}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                               <button onClick={() => clearReviewer(libro.id)} style={{ flex: 1, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', padding: 4 }}>Libera</button>
                               <button onClick={() => handleSendEmail(libro)} style={{ flex: 1, background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 4 }}>Email</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Non assegnato</div>
                        )}
                        
                        <button onClick={() => rimuoviLibro(libro.id)} style={{ background: 'transparent', border: 'none', color: COLORS.error, fontSize: '11px', cursor: 'pointer', alignSelf: 'flex-end' }}>Elimina Libro</button>
                      </div>
                    )}

                    {/* Sezione Recensore Action */}
                    {!isAdmin && (
                      <button onClick={() => selezionaLibro(libro)} style={{ marginTop: 12, width: '100%', padding: '10px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                        Candidati per questo libro
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODALE CANDIDATURA */}
        {selectedBook && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Conferma Candidatura</h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px' }}>{selectedBook.titolo}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                 <div>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Mese Pubblicazione</label>
                   <select value={recensoreData.mese} onChange={e => setRecensoreData({...recensoreData, mese: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                      <option value="">Seleziona...</option>
                      {MESI.map(m => (
                        <option key={m} value={m} disabled={libri.some(l => isBookAssigned(l) && l.mese === m && l.id !== selectedBook.id)}>
                           {m} {libri.some(l => isBookAssigned(l) && l.mese === m && l.id !== selectedBook.id) ? '(Occupato)' : ''}
                        </option>
                      ))}
                   </select>
                 </div>
                 
                 <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                       <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Nome</label>
                       <input type="text" value={recensoreData.nome} onChange={e => setRecensoreData({...recensoreData, nome: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} placeholder="Mario"/>
                    </div>
                    <div style={{ flex: 1 }}>
                       <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Cognome</label>
                       <input type="text" value={recensoreData.cognome} onChange={e => setRecensoreData({...recensoreData, cognome: e.target.value})} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} placeholder="Rossi"/>
                    </div>
                 </div>

                 <div>
                   <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Email</label>
                   <input 
                      type="email" 
                      value={recensoreData.email} 
                      onChange={e => { setRecensoreData({...recensoreData, email: e.target.value}); setEmailError(false); }} 
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: emailError ? `1px solid ${COLORS.error}` : '1px solid #cbd5e1', outlineColor: emailError ? COLORS.error : COLORS.primary }} 
                      placeholder="mario@email.com"
                   />
                   {emailError && <span style={{ fontSize: '11px', color: COLORS.error }}>Inserisci un indirizzo email valido</span>}
                 </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                 <button onClick={() => setSelectedBook(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Annulla</button>
                 <button onClick={confermaRecensione} disabled={isLoading} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                    {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s infinite' }}/> : 'Conferma'}
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* MODALE SUCCESSO CON DETTAGLI */}
        {showPostConfirmModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
             <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '380px', padding: '30px', textAlign: 'center' }}>
                <div style={{ background: '#dcfce7', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                   <CheckCircle size={30} color="#166534" />
                </div>
                <h3 style={{ margin: '0 0 8px', color: '#1e293b' }}>Candidatura Inviata!</h3>
                <p style={{ fontSize: '14px', color: '#64748b' }}>Grazie per la tua disponibilità.</p>
                
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, margin: '16px 0', textAlign: 'left', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                   <div style={{ marginBottom: 4 }}><strong>Libro:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.titolo}</div>
                   <div style={{ marginBottom: 4 }}><strong>Mese:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.mese}</div>
                   <div><strong>Email di contatto:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.email}</div>
                </div>

                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 20px' }}>Riceverai a breve una mail di conferma con i dettagli operativi.</p>
                
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <button onClick={handleSendEmailFromModal} style={{ width: '100%', padding: 12, background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Invia email di conferma</button>
                  <button onClick={() => setShowPostConfirmModal(false)} style={{ width: '100%', padding: 12, background: 'transparent', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Chiudi</button>
                </div>
             </div>
          </div>
        )}

        {/* CONFIGURAZIONE EMAIL (SOLO ADMIN) */}
        {isAdmin && (
          <div style={{ ...headerCardStyle, marginTop: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} /> Configurazione email</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={{fontSize: '12px', fontWeight: 600, color: '#64748b'}}>Oggetto (template)</label><input type="text" value={emailConfig.subjectTemplate} onChange={(e) => setEmailConfig({ ...emailConfig, subjectTemplate: e.target.value })} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{fontSize: '12px', fontWeight: 600, color: '#64748b'}}>CC (fissi)</label><input type="text" value={emailConfig.fixedRecipients} onChange={(e) => setEmailConfig({ ...emailConfig, fixedRecipients: e.target.value })} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{fontSize: '12px', fontWeight: 600, color: '#64748b'}}>URL Template Recensione</label><input type="text" value={emailConfig.reviewTemplateUrl} onChange={(e) => setEmailConfig({ ...emailConfig, reviewTemplateUrl: e.target.value })} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{fontSize: '12px', fontWeight: 600, color: '#64748b'}}>URL Privacy</label><input type="text" value={emailConfig.privacyTemplateUrl} onChange={(e) => setEmailConfig({ ...emailConfig, privacyTemplateUrl: e.target.value })} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1' }} /></div>
              </div>
              <div>
                <label style={{fontSize: '12px', fontWeight: 600, color: '#64748b'}}>Corpo email</label>
                <textarea rows={11} value={emailConfig.bodyTemplate} onChange={(e) => setEmailConfig({ ...emailConfig, bodyTemplate: e.target.value })} style={{ width: '100%', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical', minHeight: '200px' }} />
              </div>
            </div>
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="email" placeholder="tua-email@test.com" value={testEmailAddress} onChange={(e) => setTestEmailAddress(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #cbd5e1' }} />
              <button onClick={handleSendTestEmail} style={{ borderRadius: '8px', border: 'none', background: COLORS.secondary, color: '#ffffff', fontSize: '12px', padding: '8px 12px', cursor: 'pointer' }}>Prova Email</button>
            </div>
          </div>
        )}
      </div>
      
      {/* Stile CSS per rotazione loader */}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RecensioniApp;