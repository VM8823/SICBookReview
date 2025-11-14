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
// 1. Crea un account su https://www.emailjs.com
// 2. Crea un "Email Service" (es. collegato a Gmail/Outlook)
// 3. Crea un "Email Template" minimale che usi le variabili:
//    {{subject}}, {{message_html}}, {{to_email}}, {{to_name}},
//    {{fixed_recipients}}, {{review_template_url}}, {{privacy_template_url}}, {{cover_image}}
// 4. Inserisci qui sotto i tuoi ID:
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
    fixedRecipients: '', // es: redazione@dominio.it, coordinatore@dominio.it
    reviewTemplateUrl: '', // URL al PDF con il template recensione
    privacyTemplateUrl: '' // URL al PDF con l'informativa privacy
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

  // Inizializza EmailJS una volta sola
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
    setLibri([...libri, nuovoLibro]);
  };

  const aggiornaLibro = (id, campo, valore) => {
    const nuoviLibri = libri.map((libro) => {
      if (libro.id === id) {
        const libroAggiornato = { ...libro, [campo]: valore };

        if (campo === 'mese') {
          const date = calcolaDate(valore);
          return { ...libroAggiornato, ...date };
        }

        if (campo === 'nomeCognome') {
          const parti = valore.trim().split(' ');
          libroAggiornato.nome = parti[0] || '';
          libroAggiornato.cognome = parti.slice(1).join(' ') || '';
        }

        return libroAggiornato;
      }
      return libro;
    });
    setLibri(nuoviLibri);
  };

  const rimuoviLibro = (id) => {
    setLibri(libri.filter((libro) => libro.id !== id));
  };

  // Svuota i dati del recensore per un libro (admin)
  const clearReviewer = (id) => {
    const nuoviLibri = libri.map((libro) => {
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
    setLibri(nuoviLibri);
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
    // privacy: il recensore non può selezionare libri già assegnati
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

    aggiornaLibro(selectedBook.id, 'mese', recensoreData.mese);
    aggiornaLibro(
      selectedBook.id,
      'nomeCognome',
      recensoreData.nomeCognome
    );
    aggiornaLibro(selectedBook.id, 'email', recensoreData.email);

    setSelectedBook(null);
    setRecensoreData({ mese: '', nomeCognome: '', email: '' });
    showMessage('Recensione confermata!', 'success');
  };

  // Invio email al recensore (admin)
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
      cover_image: libro.copertina // base64; da usare come allegato o immagine inline nel template EmailJS
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

  const recensioniAttive = libri.filter((l) => l.nomeCognome).length;
  const isBloccato = recensioniAttive >= 12;

  // Privacy: per il recensore mostro SOLO i libri liberi (senza nomeCognome)
  const libriVisibili = isAdmin
    ? libri
    : libri.filter((l) => !l.nomeCognome);

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <BookOpen className="mx-auto h-16 w-16 text-indigo-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">
              Sistema Recensioni
            </h1>
            <p className="text-gray-600 mt-2">Seleziona il tuo ruolo</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                setShowLogin(false);
                setIsAdmin(false);
              }}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <User className="h-5 w-5" />
              Accedi come Recensore
            </button>

            <div className="border-t pt-4">
              <input
                type="password"
                placeholder="Password amministratore"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 mb-2"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
              <button
                onClick={handleLogin}
                className="w-full bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-800 transition flex items-center justify-center gap-2"
              >
                <Lock className="h-5 w-5" />
                Accedi come Amministratore
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{
        backgroundImage: backgroundImage
          ? `url(${backgroundImage})`
          : 'linear-gradient(to bottom right, #f0f9ff, #e0e7ff)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-indigo-600" />
                Gestione Recensioni {anno}
              </h1>
              <p className="text-gray-600 mt-2">
                {isAdmin ? 'Modalità Amministratore' : 'Modalità Recensore'} -
                Recensioni assegnate: {recensioniAttive}/12
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {isAdmin && (
                <>
                  <input
                    type="number"
                    value={anno}
                    onChange={(e) => setAnno(parseInt(e.target.value))}
                    className="border rounded-lg px-4 py-2 w-24"
                  />
                  <button
                    onClick={aggiungiLibro}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    Aggiungi Libro
                  </button>
                  <button
                    onClick={saveData}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Salva
                  </button>
                  <label className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition cursor-pointer flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Sfondo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e)}
                      className="hidden"
                    />
                  </label>
                </>
              )}
              <button
                onClick={() => setShowLogin(true)}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
              >
                <Unlock className="h-4 w-4" />
                Cambia Ruolo
              </button>
            </div>
          </div>

          {message.text && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {isBloccato && !isAdmin && (
            <div className="mb-4 p-4 rounded-lg bg-yellow-100 text-yellow-800">
              Limite di 12 recensioni raggiunto. Contatta l&apos;amministratore
              per modifiche.
            </div>
          )}
        </div>

        {/* CARD LIBRI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {libriVisibili.map((libro) => (
            <div
              key={libro.id}
              className="bg-white/95 backdrop-blur rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition"
            >
              {libro.copertina && (
                <img
                  src={libro.copertina}
                  alt={libro.titolo}
                  className="w-full h-48 object-cover"
                />
              )}

              <div className="p-6">
                {isAdmin ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-indigo-600">
                        ID: {libro.id}
                      </span>
                      <button
                        onClick={() => rimuoviLibro(libro.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Titolo"
                      value={libro.titolo}
                      onChange={(e) =>
                        aggiornaLibro(libro.id, 'titolo', e.target.value)
                      }
                      className="w-full border rounded-lg px-3 py-2 font-semibold text-lg"
                    />

                    <input
                      type="text"
                      placeholder="Autore"
                      value={libro.autore}
                      onChange={(e) =>
                        aggiornaLibro(libro.id, 'autore', e.target.value)
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />

                    <input
                      type="url"
                      placeholder="Link Amazon"
                      value={libro.link}
                      onChange={(e) =>
                        aggiornaLibro(libro.id, 'link', e.target.value)
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />

                    <input
                      type="number"
                      placeholder="Pagine"
                      value={libro.pagine}
                      onChange={(e) =>
                        aggiornaLibro(libro.id, 'pagine', e.target.value)
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />

                    <label className="block">
                      <span className="text-sm text-gray-600">Copertina</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, libro.id)}
                        className="block w-full text-sm mt-1"
                      />
                    </label>

                    {/* Dati recensore visibili/modificabili da admin */}
                    {libro.nomeCognome && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold">
                            {libro.nomeCognome}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{libro.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-indigo-600">
                            {libro.mese}
                          </span>
                        </div>

                        {libro.dataPubblicazione && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
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
                              <strong>
                                Recensione con commenti:
                              </strong>{' '}
                              {libro.dataInvioRecensioneConCommenti}
                            </div>
                            <div>
                              <strong>Preparazione:</strong>{' '}
                              {libro.dataPreparazionePubblicazione}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => clearReviewer(libro.id)}
                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 text-sm"
                          >
                            Svuota recensione
                          </button>
                          <button
                            onClick={() => handleSendEmail(libro)}
                            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 text-sm"
                          >
                            Invia email
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      {libro.titolo || 'Titolo non disponibile'}
                    </h3>
                    <p className="text-gray-600 mb-2">
                      di {libro.autore || 'Autore non disponibile'}
                    </p>
                    {libro.pagine && (
                      <p className="text-sm text-gray-500 mb-2">
                        Pagine: {libro.pagine}
                      </p>
                    )}
                    {libro.link && (
                      <a
                        href={libro.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-sm flex items-center gap-1 mb-3"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Vedi su Amazon
                      </a>
                    )}
                  </div>
                )}

                {/* In modalità recensore: bottone selezione solo se libro libero */}
                {!isAdmin &&
                  !isBloccato &&
                  libro.titolo && (
                    <button
                      onClick={() => selezionaLibro(libro)}
                      className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
                    >
                      Seleziona questo libro
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>

        {/* MODALE SELEZIONE RECENSORE */}
        {selectedBook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Conferma Recensione</h3>
              <p className="text-gray-600 mb-4">{selectedBook.titolo}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Mese
                  </label>
                  <select
                    value={recensoreData.mese}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        mese: e.target.value
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
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
                  <label className="block text-sm font-semibold mb-2">
                    Nome e Cognome
                  </label>
                  <input
                    type="text"
                    value={recensoreData.nomeCognome}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        nomeCognome: e.target.value
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Mario Rossi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={recensoreData.email}
                    onChange={(e) =>
                      setRecensoreData({
                        ...recensoreData,
                        email: e.target.value
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="mario.rossi@email.com"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedBook(null)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Annulla
                </button>
                <button
                  onClick={confermaRecensione}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PANNELLO CONFIGURAZIONE EMAIL (solo admin) */}
        {isAdmin && (
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 md:p-8 mt-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6 text-indigo-600" />
              Configurazione email ai recensori
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Usa i segnaposto per personalizzare le email in base al libro
              scelto:
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                {'{{Nome}} {{Cognome}} {{NomeCompleto}} {{Titolo}} {{Autore}} {{Mese}} {{DataPubblicazione}} {{DataInvioInfo}} {{DataInvioRecensione}} {{DataInvioCommenti}} {{DataInvioRecensioneConCommenti}} {{DataPreparazionePubblicazione}}'}
              </code>
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-semibold">
                  Oggetto email (template)
                </label>
                <input
                  type="text"
                  value={emailConfig.subjectTemplate}
                  onChange={(e) =>
                    setEmailConfig({
                      ...emailConfig,
                      subjectTemplate: e.target.value
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />

                <label className="block text-sm font-semibold">
                  Destinatari fissi (CC/BCC)
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
                  placeholder="es: redazione@dominio.it, coordinatore@dominio.it"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                <label className="block text-sm font-semibold">
                  URL Template Recensione (PDF)
                </label>
                <input
                  type="text"
                  value={emailConfig.reviewTemplateUrl}
                  onChange={(e) =>
                    setEmailConfig({
                      ...emailConfig,
                      reviewTemplateUrl: e.target.value
                    })
                  }
                  placeholder="https://tuo-dominio/docs/template-recensione.pdf"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />

                <label className="block text-sm font-semibold">
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
                  placeholder="https://tuo-dominio/docs/privacy.pdf"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold">
                  Corpo email (template)
                </label>
                <textarea
                  rows={10}
                  value={emailConfig.bodyTemplate}
                  onChange={(e) =>
                    setEmailConfig({
                      ...emailConfig,
                      bodyTemplate: e.target.value
                    })
                  }
                  className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-4">
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
