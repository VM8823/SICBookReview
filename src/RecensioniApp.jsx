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
  FileText
} from 'lucide-react';
import emailjs from '@emailjs/browser';

// === CONFIGURAZIONE EMAILJS ===
// Inserisci qui i valori reali quando configuri EmailJS
const EMAILJS_SERVICE_ID = 'INSERISCI_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'INSERISCI_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'INSERISCI_PUBLIC_KEY';

// === STORAGE LOCALE (localStorage) ===
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

// Sostituzione segnaposto nel template email
const applyTemplate = (template, libro) => {
  if (!template) return '';

  const map = {
    '{{Nome}}': libro.nome || '',
    '{{Cognome}}': libro.cognome || '',
    '{{NomeCompleto}}': libro.nomeCognome || '',
    '{{Titolo}}': libro.titolo || '',
    '{{Autore}}': libro.autore || '',
    '{{Mese}}': libro.mese || '',
    '{{DataPubblicazione}}': libro.dataPubblicazione || '',
    '{{DataInvioInfo}}': libro.dataInvioInfo || '',
    '{{DataInvioRecensione}}': libro.dataInvioRecensione || '',
    '{{DataInvioCommenti}}': libro.dataInvioCommenti || '',
    '{{DataInvioRecensioneConCommenti}}':
      libro.dataInvioRecensioneConCommenti || '',
    '{{DataPreparazionePubblicazione}}':
      libro.dataPreparazionePubblicazione || ''
  };

  let result = template;
  Object.entries(map).forEach(([token, value]) => {
    result = result.split(token).join(value);
  });
  return result;
};

const RecensioniApp = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [anno, setAnno] = useState(2026);
  const [libri, setLibri] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [recensoreData, setRecensoreData] = useState({
    mese: '',
    nomeCognome: '',
    email: ''
  });
  const [message, setMessage] = useState({ text: '', type: '' });

  // Modale di conferma dopo la scelta del recensore
  const [showPostConfirmModal, setShowPostConfirmModal] = useState(false);
  const [lastConfirmedBookId, setLastConfirmedBookId] = useState(null);

  // Configurazione template email
  const [emailConfig, setEmailConfig] = useState({
    subjectTemplate: 'Recensione del mese di {{Mese}} – {{Titolo}}',
    bodyTemplate:
      'Ciao {{Nome}},\n\n' +
      'ti confermiamo la recensione del libro "{{Titolo}}" per il mese di {{Mese}}.\n\n' +
      'Ecco le principali scadenze:\n' +
      '- Invio info redazione: {{DataInvioInfo}}\n' +
      '- Invio recensione: {{DataInvioRecensione}}\n' +
      '- Invio commenti: {{DataInvioCommenti}}\n' +
      '- Pubblicazione: {{DataPubblicazione}}\n\n' +
      'Grazie per la collaborazione!\nLa redazione',
    fixedRecipients: '',
    reviewTemplateUrl: '',
    privacyTemplateUrl: ''
  });

  const MESI = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre'
  ];

  // PALETTE COLORI (mixa i 3 RGB dati)
  const COLORS = {
    accent: 'rgb(255, 97, 15)', // arancio
    secondary: 'rgb(5, 191, 224)', // azzurro
    primary: 'rgb(79, 23, 168)' // viola
  };

  // Inizializza EmailJS una volta sola (se configurato)
  useEffect(() => {
    if (
      EMAILJS_PUBLIC_KEY &&
      EMAILJS_PUBLIC_KEY !== 'INSERISCI_PUBLIC_KEY'
    ) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [anno]);

  const loadData = async () => {
    try {
      const result = await storage.get(`libri_${anno}`);
      if (result) {
        setLibri(JSON.parse(result.value));
      } else {
        setLibri([]);
      }

      const bgResult = await storage.get('background_image');
      if (bgResult) {
        setBackgroundImage(bgResult.value);
      }

      const emailCfg = await storage.get('email_config');
      if (emailCfg) {
        setEmailConfig((prev) => ({
          ...prev,
          ...JSON.parse(emailCfg.value)
        }));
      }
    } catch (error) {
      console.log('Nessun dato salvato per questo anno');
    }
  };

  const saveData = async () => {
    try {
      await storage.set(`libri_${anno}`, JSON.stringify(libri));
      await storage.set('email_config', JSON.stringify(emailConfig));
      showMessage('Dati salvati con successo!', 'success');
    } catch (error) {
      showMessage('Errore nel salvataggio', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleLogin = () => {
    if (adminPassword === 'admin2026') {
      setIsAdmin(true);
      setShowLogin(false);
    } else {
      showMessage('Password errata', 'error');
    }
  };

  const calcolaDate = (mese) => {
    const meseIndex = MESI.indexOf(mese);
    if (meseIndex === -1) return {};

    const ultimaDomenica = (anno, mese) => {
      const date = new Date(anno, mese + 1, 0);
      while (date.getDay() !== 0) {
        date.setDate(date.getDate() - 1);
      }
      return date.toLocaleDateString('it-IT');
    };

    const primoLunedi = (anno, mese) => {
      const date = new Date(anno, mese, 1);
      while (date.getDay() !== 1) {
        date.setDate(date.getDate() + 1);
      }
      return date.toLocaleDateString('it-IT');
    };

    const ultimoGiorno = (anno, mese, giorno) => {
      const date = new Date(anno, mese + 1, 0);
      while (date.getDay() !== giorno) {
        date.setDate(date.getDate() - 1);
      }
      return date.toLocaleDateString('it-IT');
    };

    return {
      dataPubblicazione: ultimaDomenica(anno, meseIndex),
      dataInvioInfo: primoLunedi(anno, meseIndex),
      dataInvioRecensione: ultimoGiorno(anno, meseIndex, 3),
      dataInvioCommenti: ultimoGiorno(anno, meseIndex, 4),
      dataInvioRecensioneConCommenti: ultimoGiorno(anno, meseIndex, 5),
      dataPreparazionePubblicazione: ultimoGiorno(anno, meseIndex, 6)
    };
  };

  const aggiungiLibro = () => {
    const nuovoLibro = {
      id: libri.length + 1,
      titolo: '',
      autore: '',
      link: '',
      pagine: '',
      mese: '',
      nomeCognome: '',
      nome: '',
      cognome: '',
      email: '',
      copertina: '',
      ...calcolaDate('')
    };
    setLibri((prev) => [...prev, nuovoLibro]);
  };

  // VERSIONE CORRETTA, FUNZIONALE, CON SALVATAGGIO
  const aggiornaLibro = (id, campo, valore) => {
    setLibri((prevLibri) => {
      const nuoviLibri = prevLibri.map((libro) => {
        if (libro.id !== id) return libro;

        let libroAggiornato = { ...libro, [campo]: valore };

        if (campo === 'mese') {
          const date = calcolaDate(valore);
          libroAggiornato = { ...libroAggiornato, ...date };
        }

        if (campo === 'nomeCognome') {
          const parti = valore.trim().split(' ');
          libroAggiornato = {
            ...libroAggiornato,
            nome: parti[0] || '',
            cognome: parti.slice(1).join(' ') || ''
          };
        }

        return libroAggiornato;
      });

      // salvo subito anche su localStorage
      storage.set(`libri_${anno}`, JSON.stringify(nuoviLibri));
      return nuoviLibri;
    });
  };

  const rimuoviLibro = (id) => {
    setLibri((prev) => prev.filter((libro) => libro.id !== id));
  };

  // Svuota i dati del recensore per un libro (admin)
  const clearReviewer = (id) => {
    setLibri((prevLibri) => {
      const nuoviLibri = prevLibri.map((libro) => {
        if (libro.id === id) {
          return {
            ...libro,
            nomeCognome: '',
            nome: '',
            cognome: '',
            email: '',
            mese: '',
            dataPubblicazione: '',
            dataInvioInfo: '',
            dataInvioRecensione: '',
            dataInvioCommenti: '',
            dataInvioRecensioneConCommenti: '',
            dataPreparazionePubblicazione: ''
          };
        }
        return libro;
      });
      storage.set(`libri_${anno}`, JSON.stringify(nuoviLibri));
      return nuoviLibri;
    });
    showMessage('Recensione svuotata per questo libro', 'success');
  };

  const handleImageUpload = async (e, libroId = null) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        if (libroId) {
          aggiornaLibro(libroId, 'copertina', base64);
        } else {
          setBackgroundImage(base64);
          try {
            await storage.set('background_image', base64);
          } catch (error) {
            console.error('Errore salvataggio immagine');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const selezionaLibro = (libro) => {
    if (libro.nomeCognome) {
      showMessage('Questo libro è già stato selezionato', 'error');
      return;
    }
    setSelectedBook(libro);
    setRecensoreData({
      mese: libro.mese || '',
      nomeCognome: '',
      email: ''
    });
  };

  const confermaRecensione = () => {
    if (
      !recensoreData.mese ||
      !recensoreData.nomeCognome ||
      !recensoreData.email
    ) {
      showMessage('Compila tutti i campi', 'error');
      return;
    }

    const recensioniAttive = libri.filter((l) => l.nomeCognome);

    if (
      recensioniAttive.some(
        (l) => l.mese === recensoreData.mese && l.id !== selectedBook.id
      )
    ) {
      showMessage('Questo mese è già stato scelto', 'error');
      return;
    }

    if (
      recensioniAttive.some(
        (l) => l.email === recensoreData.email && l.id !== selectedBook.id
      )
    ) {
      showMessage('Hai già una recensione assegnata', 'error');
      return;
    }

    const confirmedId = selectedBook.id;

    aggiornaLibro(selectedBook.id, 'mese', recensoreData.mese);
    aggiornaLibro(
      selectedBook.id,
      'nomeCognome',
      recensoreData.nomeCognome
    );
    aggiornaLibro(selectedBook.id, 'email', recensoreData.email);

    setSelectedBook(null);
    setRecensoreData({ mese: '', nomeCognome: '', email: '' });
    setLastConfirmedBookId(confirmedId);
    setShowPostConfirmModal(true);
    showMessage('Recensione confermata!', 'success');
  };

  // Invio email al recensore
  const handleSendEmail = async (libro) => {
    if (
      !EMAILJS_SERVICE_ID ||
      EMAILJS_SERVICE_ID === 'INSERISCI_SERVICE_ID' ||
      !EMAILJS_TEMPLATE_ID ||
      EMAILJS_TEMPLATE_ID === 'INSERISCI_TEMPLATE_ID' ||
      !EMAILJS_PUBLIC_KEY ||
      EMAILJS_PUBLIC_KEY === 'INSERISCI_PUBLIC_KEY'
    ) {
      showMessage(
        'Configura prima EmailJS nel codice (SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY)',
        'error'
      );
      return;
    }

    if (!libro.email) {
      showMessage(
        'Nessuna email recensore impostata per questo libro',
        'error'
      );
      return;
    }

    const subject = applyTemplate(emailConfig.subjectTemplate, libro);
    const body = applyTemplate(emailConfig.bodyTemplate, libro);

    const templateParams = {
      to_email: libro.email,
      to_name: libro.nome || libro.nomeCognome || '',
      subject,
      message_html: body,
      fixed_recipients: emailConfig.fixedRecipients,
      review_template_url: emailConfig.reviewTemplateUrl,
      privacy_template_url: emailConfig.privacyTemplateUrl,
      cover_image: libro.copertina
    };

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );
      showMessage('Email inviata al recensore', 'success');
    } catch (error) {
      console.error('Errore invio email', error);
      showMessage("Errore durante l'invio della email", 'error');
    }
  };

  // Invio email dalla modale post conferma (recensore)
  const handleSendEmailFromModal = () => {
    const libro = libri.find((l) => l.id === lastConfirmedBookId);
    if (!libro) {
      showMessage('Impossibile trovare il libro selezionato', 'error');
      return;
    }
    handleSendEmail(libro);
    setShowPostConfirmModal(false);
  };

  const recensioniAttive = libri.filter((l) => l.nomeCognome).length;
  const isBloccato = recensioniAttive >= 12;

  // Privacy: per il recensore mostro SOLO i libri liberi
  const libriVisibili = isAdmin
    ? libri
    : libri.filter((l) => !l.nomeCognome);

  // --- STILI COMUNI ---
  const appWrapperStyle = {
    minHeight: '100vh',
    padding: '24px',
    backgroundImage: backgroundImage
      ? `url(${backgroundImage})`
      : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary}, ${COLORS.primary})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    fontFamily:
      'Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };

  const appInnerStyle = {
    maxWidth: '1200px',
    margin: '0 auto'
  };

  const headerCardStyle = {
    background: 'rgba(255,255,255,0.96)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    boxShadow: '0 20px 40px rgba(15,23,42,0.10)',
    padding: '24px',
    marginBottom: '24px'
  };

  // Griglia SEMPRE a 3 colonne, per quanti libri vuoi
  const cardGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '20px',
    marginBottom: '32px',
    alignItems: 'stretch'
  };

  const bookCardStyle = {
    background: 'rgba(255,255,255,0.97)',
    borderRadius: '16px',
    boxShadow: '0 10px 20px rgba(15,23,42,0.08)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  };

  const coverStyle = {
    width: '100%',
    maxHeight: '220px',
    objectFit: 'cover',
    display: 'block'
  };

  const bookBodyStyle = {
    padding: '16px 18px 18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    marginBottom: '4px'
  };

  const inputStyle = {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    padding: '6px 10px',
    fontSize: '13px'
  };

  const smallTagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#f3f4f6',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '11px',
    color: '#4b5563'
  };

  // --- SCHERMATA LOGIN ---
  if (showLogin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#e0f2fe,#e0e7ff)',
          padding: '16px',
          fontFamily:
            'Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(15,23,42,0.12)',
            maxWidth: '420px',
            width: '100%',
            padding: '32px'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <BookOpen
              size={56}
              color={COLORS.primary}
              style={{ marginBottom: '12px' }}
            />
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#111827',
                margin: 0
              }}
            >
              Sistema Recensioni
            </h1>
            <p style={{ color: '#6b7280', marginTop: '8px' }}>
              Seleziona il tuo ruolo
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => {
                setShowLogin(false);
                setIsAdmin(false);
              }}
              style={{
                width: '100%',
                background: COLORS.primary,
                color: '#ffffff',
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <User size={18} />
              Accedi come Recensore
            </button>

            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '12px',
                marginTop: '8px'
              }}
            >
              <input
                type="password"
                placeholder="Password amministratore"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleLogin}
                style={{
                  width: '100%',
                  background: '#374151',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Lock size={18} />
                Accedi come Amministratore
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- APP PRINCIPALE ---
  return (
    <div style={appWrapperStyle}>
      <div style={appInnerStyle}>
        {/* HEADER */}
        <div style={headerCardStyle}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={32} color={COLORS.primary} />
                <h1
                  style={{
                    fontSize: '24px',
                    margin: 0,
                    fontWeight: '700',
                    color: '#111827'
                  }}
                >
                  SICBookReview – {anno}
                </h1>
              </div>
              <p
                style={{
                  marginTop: '6px',
                  color: '#6b7280',
                  fontSize: '14px'
                }}
              >
                Modalità{' '}
                <strong>{isAdmin ? 'Amministratore' : 'Recensore'}</strong> ·
                &nbsp;Recensioni assegnate: {recensioniAttive}/12
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {isAdmin && (
                <>
                  <input
                    type="number"
                    value={anno}
                    onChange={(e) =>
                      setAnno(parseInt(e.target.value || '0') || anno)
                    }
                    style={{
                      width: '80px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '6px 8px',
                      fontSize: '13px'
                    }}
                  />
                  <button
                    onClick={aggiungiLibro}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: COLORS.primary,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <BookOpen size={14} />
                    Aggiungi Libro
                  </button>
                  <button
                    onClick={saveData}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: COLORS.accent,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <Save size={14} />
                    Salva
                  </button>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: COLORS.secondary,
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <Upload size={14} />
                    Sfondo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                </>
              )}
              <button
                onClick={() => setShowLogin(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#4b5563',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  padding: '8px 10px',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <Unlock size={14} />
                Cambia Ruolo
              </button>
            </div>
          </div>

          {message.text && (
            <div
              style={{
                marginTop: '16px',
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '13px',
                color: message.type === 'success' ? '#166534' : '#b91c1c',
                background:
                  message.type === 'success' ? '#dcfce7' : '#fee2e2'
              }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* LIBRI o MESSAGGIO SLOT ESAURITI */}
        {!isAdmin && isBloccato ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.98)',
              borderRadius: '18px',
              boxShadow: '0 16px 30px rgba(15,23,42,0.15)',
              padding: '24px',
              textAlign: 'center',
              maxWidth: '640px',
              margin: '16px auto 0 auto'
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#111827',
                margin: 0,
                marginBottom: '8px'
              }}
            >
              Ci dispiace…
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#4b5563',
                margin: 0,
                marginBottom: '4px'
              }}
            >
              Abbiamo raggiunto il numero massimo di candidature per le
              recensioni di quest&apos;anno.
            </p>
            <p
              style={{
                fontSize: '14px',
                color: '#4b5563',
                margin: 0
              }}
            >
              Scrivi una email ai referenti del PMI-SIC, così che possano
              contattarti qualora si liberasse uno slot per una recensione.
            </p>
          </div>
        ) : (
          <div style={cardGridStyle}>
            {libriVisibili.map((libro) => (
              <div key={libro.id} style={bookCardStyle}>
                {libro.copertina && (
                  <img
                    src={libro.copertina}
                    alt={libro.titolo}
                    style={coverStyle}
                  />
                )}

                <div style={bookBodyStyle}>
                  {/* HEADER CARD */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 4
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: COLORS.primary
                      }}
                    >
                      ID: {libro.id}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => rimuoviLibro(libro.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                        title="Elimina libro"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* CONTENUTO PRINCIPALE */}
                  {isAdmin ? (
                    <>
                      <div>
                        <label style={labelStyle}>Titolo</label>
                        <input
                          type="text"
                          value={libro.titolo}
                          onChange={(e) =>
                            aggiornaLibro(
                              libro.id,
                              'titolo',
                              e.target.value
                            )
                          }
                          style={{
                            ...inputStyle,
                            fontWeight: 600,
                            fontSize: '14px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Autore</label>
                        <input
                          type="text"
                          value={libro.autore}
                          onChange={(e) =>
                            aggiornaLibro(
                              libro.id,
                              'autore',
                              e.target.value
                            )
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Link Amazon</label>
                        <input
                          type="url"
                          value={libro.link}
                          onChange={(e) =>
                            aggiornaLibro(
                              libro.id,
                              'link',
                              e.target.value
                            )
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Pagine</label>
                        <input
                          type="number"
                          value={libro.pagine}
                          onChange={(e) =>
                            aggiornaLibro(
                              libro.id,
                              'pagine',
                              e.target.value
                            )
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Copertina</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, libro.id)}
                          style={{ fontSize: '11px' }}
                        />
                      </div>

                      <hr
                        style={{
                          margin: '10px 0',
                          border: 'none',
                          borderTop: '1px solid #e5e7eb'
                        }}
                      />

                      {/* DETTAGLI RECENSORE PER ADMIN */}
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 6
                          }}
                        >
                          <User size={14} color="#6b7280" />
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#111827'
                            }}
                          >
                            Recensore
                          </span>
                        </div>

                        {libro.nomeCognome ? (
                          <>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#374151'
                              }}
                            >
                              <strong>Nome:</strong> {libro.nome || '-'}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#374151'
                              }}
                            >
                              <strong>Cognome:</strong>{' '}
                              {libro.cognome || '-'}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 4,
                                fontSize: '12px',
                                color: '#374151'
                              }}
                            >
                              <Mail size={14} color="#6b7280" />
                              <span>{libro.email}</span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 4,
                                fontSize: '12px',
                                color: '#374151'
                              }}
                            >
                              <Calendar size={14} color="#6b7280" />
                              <span>
                                <strong>Mese:</strong> {libro.mese}
                              </span>
                            </div>

                            {libro.dataPubblicazione && (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: '8px 10px',
                                  background: '#f9fafb',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  color: '#374151'
                                }}
                              >
                                <div>
                                  <strong>Pubblicazione:</strong>{' '}
                                  {libro.dataPubblicazione}
                                </div>
                                <div>
                                  <strong>Invio info:</strong>{' '}
                                  {libro.dataInvioInfo}
                                </div>
                                <div>
                                  <strong>Invio recensione:</strong>{' '}
                                  {libro.dataInvioRecensione}
                                </div>
                                <div>
                                  <strong>Invio commenti:</strong>{' '}
                                  {libro.dataInvioCommenti}
                                </div>
                                <div>
                                  <strong>Recensione+commenti:</strong>{' '}
                                  {libro.dataInvioRecensioneConCommenti}
                                </div>
                                <div>
                                  <strong>Preparazione:</strong>{' '}
                                  {
                                    libro.dataPreparazionePubblicazione
                                  }
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 10
                              }}
                            >
                              <button
                                onClick={() => clearReviewer(libro.id)}
                                style={{
                                  flex: 1,
                                  borderRadius: '8px',
                                  border: '1px solid #d1d5db',
                                  background: '#f3f4f6',
                                  fontSize: '12px',
                                  padding: '6px 8px',
                                  cursor: 'pointer'
                                }}
                              >
                                Svuota recensione
                              </button>
                              <button
                                onClick={() => handleSendEmail(libro)}
                                style={{
                                  flex: 1,
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: COLORS.primary,
                                  color: '#fff',
                                  fontSize: '12px',
                                  padding: '6px 8px',
                                  cursor: 'pointer'
                                }}
                              >
                                Invia email
                              </button>
                            </div>
                          </>
                        ) : (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#9ca3af'
                            }}
                          >
                            Nessun recensore assegnato
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    // VISTA RECENSORE
                    <>
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#111827',
                          margin: 0
                        }}
                      >
                        {libro.titolo || 'Titolo non disponibile'}
                      </h3>
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#4b5563',
                          margin: 0
                        }}
                      >
                        di {libro.autore || 'Autore non disponibile'}
                      </p>
                      {libro.pagine && (
                        <span style={smallTagStyle}>
                          Pagine: {libro.pagine}
                        </span>
                      )}
                      {libro.link && (
                        <a
                          href={libro.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '12px',
                            color: COLORS.primary,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4
                          }}
                        >
                          <ExternalLink size={14} />
                          Vedi su Amazon
                        </a>
                      )}

                      <button
                        onClick={() => selezionaLibro(libro)}
                        style={{
                          marginTop: '10px',
                          width: '100%',
                          borderRadius: '10px',
                          border: 'none',
                          background: COLORS.primary,
                          color: '#fff',
                          fontSize: '13px',
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Seleziona questo libro
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODALE SELEZIONE RECENSORE */}
        {selectedBook && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 50
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '20px',
                maxWidth: '420px',
                width: '100%',
                padding: '20px 22px',
                boxShadow: '0 20px 40px rgba(15,23,42,0.25)'
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '6px'
                }}
              >
                Conferma Recensione
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginTop: 0,
                  marginBottom: '12px'
                }}
              >
                {selectedBook.titolo}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Mese</label>
                  <select
                    value={recensoreData.mese}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        mese: e.target.value
                      })
                    }
                    style={inputStyle}
                  >
                    <option value="">Seleziona mese</option>
                    {MESI.map((m) => (
                      <option
                        key={m}
                        value={m}
                        disabled={libri.some(
                          (l) =>
                            l.mese === m &&
                            l.nomeCognome &&
                            l.id !== selectedBook.id
                        )}
                      >
                        {m}{' '}
                        {libri.some(
                          (l) =>
                            l.mese === m &&
                            l.nomeCognome &&
                            l.id !== selectedBook.id
                        ) && '(occupato)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Nome e Cognome</label>
                  <input
                    type="text"
                    value={recensoreData.nomeCognome}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        nomeCognome: e.target.value
                      })
                    }
                    style={inputStyle}
                    placeholder="Mario Rossi"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={recensoreData.email}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        email: e.target.value
                      })
                    }
                    style={inputStyle}
                    placeholder="mario.rossi@email.com"
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: '16px'
                }}
              >
                <button
                  onClick={() => setSelectedBook(null)}
                  style={{
                    flex: 1,
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontSize: '13px',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Annulla
                </button>
                <button
                  onClick={confermaRecensione}
                  style={{
                    flex: 1,
                    borderRadius: '10px',
                    border: 'none',
                    background: COLORS.primary,
                    color: '#ffffff',
                    fontSize: '13px',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODALE POST-CONFERMA (RECENSORE) */}
        {showPostConfirmModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              zIndex: 60
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                maxWidth: '380px',
                width: '100%',
                padding: '20px',
                boxShadow: '0 20px 30px rgba(15,23,42,0.25)'
              }}
            >
              <h3
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: '8px'
                }}
              >
                Grazie per la tua disponibilità!
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: '#4b5563',
                  marginTop: 0,
                  marginBottom: '14px'
                }}
              >
                La tua candidatura è stata registrata. Riceverai (o potrai
                ricevere) una email con tutti i dettagli del processo di
                recensione.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <button
                  onClick={() => setShowPostConfirmModal(false)}
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    background: '#f9fafb',
                    color: '#111827',
                    fontSize: '13px',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Chiudi
                </button>
                <button
                  onClick={handleSendEmailFromModal}
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: 'none',
                    background: COLORS.primary,
                    color: '#ffffff',
                    fontSize: '13px',
                    padding: '8px 10px',
                    cursor: 'pointer'
                  }}
                >
                  Invia email di conferma
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANNELLO CONFIGURAZIONE EMAIL (solo admin) */}
        {isAdmin && (
          <div
            style={{
              ...headerCardStyle,
              marginTop: '24px'
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                marginTop: 0,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FileText size={20} color={COLORS.primary} />
              Configurazione email ai recensori
            </h2>
            <p
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: 0,
                marginBottom: '12px'
              }}
            >
              Segnaposto disponibili:{' '}
              <code
                style={{
                  background: '#f3f4f6',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  fontSize: '11px'
                }}
              >
                {'{{Nome}} {{Cognome}} {{NomeCompleto}} {{Titolo}} {{Autore}} {{Mese}} {{DataPubblicazione}} {{DataInvioInfo}} {{DataInvioRecensione}} {{DataInvioCommenti}} {{DataInvioRecensioneConCommenti}} {{DataPreparazionePubblicazione}}'}
              </code>
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr)',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Oggetto email (template)</label>
                  <input
                    type="text"
                    value={emailConfig.subjectTemplate}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        subjectTemplate: e.target.value
                      })
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Destinatari fissi (CC/BCC, separati da virgola)
                  </label>
                  <input
                    type="text"
                    value={emailConfig.fixedRecipients}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        fixedRecipients: e.target.value
                      })
                    }
                    style={inputStyle}
                    placeholder="es: redazione@dominio.it, coordinatore@dominio.it"
                  />
                </div>

                <div>
                  <label style={labelStyle}>URL Template Recensione (PDF)</label>
                  <input
                    type="text"
                    value={emailConfig.reviewTemplateUrl}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        reviewTemplateUrl: e.target.value
                      })
                    }
                    style={inputStyle}
                    placeholder="https://.../docs/template-recensione.pdf"
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    URL Informativa Privacy (PDF)
                  </label>
                  <input
                    type="text"
                    value={emailConfig.privacyTemplateUrl}
                    onChange={(e) =>
                      setEmailConfig({
                        ...emailConfig,
                        privacyTemplateUrl: e.target.value
                      })
                    }
                    style={inputStyle}
                    placeholder="https://.../docs/privacy.pdf"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Corpo email (template)</label>
                <textarea
                  rows={11}
                  value={emailConfig.bodyTemplate}
                  onChange={(e) =>
                    setEmailConfig({
                      ...emailConfig,
                      bodyTemplate: e.target.value
                    })
                  }
                  style={{
                    ...inputStyle,
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    resize: 'vertical',
                    minHeight: '180px'
                  }}
                />
              </div>
            </div>

            <p
              style={{
                marginTop: '10px',
                fontSize: '11px',
                color: '#6b7280'
              }}
            >
              Ricorda di cliccare su <strong>Salva</strong> in alto per
              memorizzare anche queste impostazioni nel browser.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecensioniApp;
