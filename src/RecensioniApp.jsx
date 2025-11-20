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
  Download, // aggiunto
  Loader2,       // <--- NUOVO
  CheckCircle,   // <--- NUOVO
  AlertCircle    // <--- NUOVO
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { supabase } from './supabaseClient';

// === CONFIGURAZIONE EMAILJS ===
// ⚠️ Metti qui i TUOI valori reali presi da EmailJS
const EMAILJS_SERVICE_ID = 'service_u4jt49x';
const EMAILJS_TEMPLATE_ID = 'template_alvdimz';
const EMAILJS_PUBLIC_KEY = '7XpH6J5xigFu_9mum';

// === STORAGE LOCALE (solo per sfondo e email_config) ===
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

// Sostituzione segnaposto nel template email
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
    '{{DataInvioRecensioneConCommenti}}':
      context.dataInvioRecensioneConCommenti || '',
    '{{DataPreparazionePubblicazione}}':
      context.dataPreparazionePubblicazione || '',
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
  // se inizia già con http:// o https://, la lascio com'è
  if (/^https?:\/\//i.test(url)) return url;
  // altrimenti pre-pendo https://
  return `https://${url}`;
};

const normalizeRecipientsList = (value) => {
  if (!value) return '';
  return value
    .split(',')                 // separo per virgola
    .map((s) => s.trim())       // tolgo spazi all’inizio/fine
    .filter((s) => s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) //controllo email
    .join(', ');                // ricompongo con virgola + spazio
};

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

// PALETTE COLORI
const COLORS = {
  accent: 'rgb(255, 97, 15)',
  secondary: 'rgb(5, 191, 224)',
  primary: 'rgb(79, 23, 168)',
  // NUOVI COLORI AGGIUNTI
  success: '#166534',      // Verde scuro (testo/bordi)
  successBg: '#dcfce7',    // Verde chiaro (sfondi)
  error: '#b91c1c',        // Rosso scuro
  errorBg: '#fee2e2'       // Rosso chiaro
};

// Un libro è "assegnato" solo se ha mese + nome/cognome + email
const isBookAssigned = (book) =>
  !!(book.mese && book.nomeCognome && book.email);

// Helper mapping DB -> React
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
  dataInvioRecensioneConCommenti:
    row.data_invio_recensione_con_commenti || '',
  dataPreparazionePubblicazione:
    row.data_preparazione_pubblicazione || ''
});

// Helper mapping React -> DB
const mapBookToDb = (libro, annoCorrente) => ({
  anno: libro.anno ?? annoCorrente,
  titolo: libro.titolo || '',
  autore: libro.autore || '',
  link: libro.link || '',
  pagine:
    libro.pagine === '' || libro.pagine === null
      ? null
      : Number(libro.pagine),
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
  data_invio_recensione_con_commenti:
    libro.dataInvioRecensioneConCommenti || '',
  data_preparazione_pubblicazione:
    libro.dataPreparazionePubblicazione || ''
});

const RecensioniApp = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showLogin, setShowLogin] = useState(true);
  const [anno, setAnno] = useState(2026); // Anno corrente da reinizializzare annualmente
  const [libri, setLibri] = useState([]);
  const [backgroundImage, setBackgroundImage] = useState('');
  // const [pmiLogo, setPmiLogo] = useState('');
  // const [sicLogo, setSicLogo] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [recensoreData, setRecensoreData] = useState({
    mese: '',
    nome: '',
    cognome: '',
    email: ''
  });
  const [isLoading, setIsLoading] = useState(false); // PUNTO 6
  const [emailError, setEmailError] = useState(false); // PUNTO 7
  const [message, setMessage] = useState({ text: '', type: '' });
  // PUNTO 11: Stato per i filtri Admin ('all', 'assigned', 'free')
const [filterStatus, setFilterStatus] = useState('all');

  // Modale post conferma recensore
  const [showPostConfirmModal, setShowPostConfirmModal] = useState(false);
  const [lastConfirmedBookId, setLastConfirmedBookId] = useState(null);

  const [emailConfig, setEmailConfig] = useState({
    subjectTemplate: 'Recensione del mese di {{Mese}} – {{Titolo}}',
    bodyTemplate:
      '<p>Ciao {{Nome}},</p>' +
      '<p>Grazie per l’interesse dimostrato nell’iniziativa. Con piacere ti confermo l’assegnazione della recensione del libro "{{Titolo}}" per il mese di {{Mese}}.</p>' +
      '<p>Al fine di rispettare le tempistiche per la pubblicazione, ricapitolo i prossimi passi e le relative date:</p>' +
      '<table style="border-collapse: collapse; width: 100%;" border="1">' +
      '<thead><tr>' +
      '<th>ATTIVITÀ</th><th>SCADENZA</th><th>RESPONSABILE</th><th>TO</th><th>CC</th>' +
      '</tr></thead><tbody>' +
      '<tr><td>Invio info sulla redazione della recensione</td><td>{{DataInvioInfo}}</td><td>V. Mosca</td><td>{{Nome}} {{Cognome}},<br/>Comitato Comunicazione</td><td>F. Spadera</td></tr>' +
      '<tr><td>Invio recensione, con liberatoria firmata</td><td>{{DataInvioRecensione}}</td><td>{{Nome}} {{Cognome}}</td><td>V. Mosca,<br/>Comitato Comunicazione</td><td>F. Spadera</td></tr>' +
      '<tr><td>Invio commenti sulla recensione (eventuale)</td><td>{{DataInvioCommenti}}</td><td>V. Mosca</td><td>{{Nome}} {{Cognome}}</td><td></td></tr>' +
      '<tr><td>Invio recensione con commenti (eventuale)</td><td>{{DataInvioRecensioneConCommenti}}</td><td>{{Nome}} {{Cognome}}</td><td>V. Mosca,<br/>Comitato Comunicazione</td><td>F. Spadera</td></tr>' +
      '<tr><td>Preparazione pubblicazione sui vari canali del SIC</td><td>{{DataPreparazionePubblicazione}}</td><td>Comitato Comunicazione</td><td>N/A</td><td>N/A</td></tr>' +
      '<tr><td>Pubblicazione</td><td>{{DataPubblicazione}}</td><td>Comitato Comunicazione</td><td>N/A</td><td>N/A</td></tr>' +
      '</tbody></table>' +
      '<p>Allego, inoltre, il template per la recensione (<a href="{{TemplateRecensioneUrl}}" target="_blank" rel="noopener noreferrer">TEMPLATE SIC Book Review</a>), la cover del libro da te scelto (che invierò io) e la liberatoria per l’utilizzo dei dati personali (<a href="{{InformativaPrivacyUrl}}" target="_blank" rel="noopener noreferrer">PMI-SIC Speaker - Liberatoria e Informativa dati personali</a>).</p>' +
      '<p>L’indirizzo del Comitato Comunicazione è: <a href="mailto:comunicazione@pmi-sic.org">comunicazione@pmi-sic.org</a></p>' +
      '<p>Per qualsiasi dubbio, non esitare a contattarmi.</p>' +
      '<p>Porgendoti i miei più cordiali saluti, approfitto per ringraziarti nuovamente per l’interesse dimostrato.</p>' +
      '<p>Cordiali saluti,<br/>Vincenzo Mosca – Socio e Volontario del PMI-SIC<br/>Responsabile del Comitato Editoriale<br/>+39 3339258320 – <a href="mailto:enzo.mosca@pmi-sic.org">enzo.mosca@pmi-sic.org</a></p>',
    fixedRecipients: '',
    reviewTemplateUrl: '',
    privacyTemplateUrl: ''
  });

  const [testEmailAddress, setTestEmailAddress] = useState('');

  // EmailJS init
  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
    }
  }, []);

  // Caricamento iniziale libri + config da localStorage
  useEffect(() => {
    loadData();
  }, [anno]);

  const showMessage = (text, type) => {
    setMessage({ text, type });
    // Nessun timeout: il messaggio resta finché non si chiude
  };
  const closeMessage = () => setMessage({ text: '', type: '' });

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

  // 1) Ultima domenica del mese (data di pubblicazione)
  const getUltimaDomenica = (anno, mese) => {
    // ultimo giorno del mese
    const d = new Date(anno, mese + 1, 0);
    // risalgo finché non trovo una domenica (0)
    while (d.getDay() !== 0) {
      d.setDate(d.getDate() - 1);
    }
    return d; // ritorno un oggetto Date
  };

  // 2) Primo lunedì del mese (come prima, per invio info)
  const getPrimoLunedi = (anno, mese) => {
    const d = new Date(anno, mese, 1);
    // 1 = lunedì
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    return d.toLocaleDateString('it-IT');
  };

  // 3) Helper per date relative
  const addDays = (baseDate, offset) => {
    const d = new Date(baseDate.getTime());
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('it-IT');
  };

  // Calcolo effettivo
  const ultimaDomenica = getUltimaDomenica(anno, meseIndex);

  const dataPubblicazione = ultimaDomenica.toLocaleDateString('it-IT');
  const dataInvioInfo = getPrimoLunedi(anno, meseIndex);

  // tutti nella stessa settimana che termina con la domenica di pubblicazione
  const dataInvioRecensione = addDays(ultimaDomenica, -4);            // mercoledì
  const dataInvioCommenti = addDays(ultimaDomenica, -3);              // giovedì
  const dataInvioRecensioneConCommenti = addDays(ultimaDomenica, -2); // venerdì
  const dataPreparazionePubblicazione = addDays(ultimaDomenica, -1);  // sabato

  return {
    dataPubblicazione,
    dataInvioInfo,
    dataInvioRecensione,
    dataInvioCommenti,
    dataInvioRecensioneConCommenti,
    dataPreparazionePubblicazione
  };
};

  const loadData = async () => {
    try {
      // Libri da Supabase
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('anno', anno)
        .order('id', { ascending: true });

      if (error) {
        console.error('Errore caricamento libri da Supabase', error);
        showMessage('Errore nel caricamento dei libri', 'error');
        setLibri([]);
      } else {
        const mapped = (data || []).map(mapBookFromDb);
        setLibri(mapped);
      }

      // Sfondo e config email da localStorage
            const bgResult = await storage.get('background_image');
      if (bgResult) {
        setBackgroundImage(bgResult.value);
      }

      // const pmiLogoResult = await storage.get('pmi_logo');
      // if (pmiLogoResult) {
        // setPmiLogo(pmiLogoResult.value);
      // }

      // const sicLogoResult = await storage.get('sic_logo');
      // if (sicLogoResult) {
        // setSicLogo(sicLogoResult.value);
      // }

      const emailCfg = await storage.get('email_config');

      if (emailCfg) {
        setEmailConfig((prev) => ({
          ...prev,
          ...JSON.parse(emailCfg.value)
        }));
      }
    } catch (error) {
      console.error('Errore generale in loadData', error);
      showMessage('Errore nel caricamento dei dati', 'error');
    }
  };

  const saveData = async () => {
    try {
      await storage.set('email_config', JSON.stringify(emailConfig));
      showMessage(
        'Config email e sfondo salvati (libri già in Supabase)',
        'success'
      );
    } catch (error) {
      showMessage('Errore nel salvataggio', 'error');
    }
  };

// === FUNZIONE EXPORT CSV (PUNTO 4) ===
  const handleExportCsv = () => {
    if (libri.length === 0) {
      showMessage("Nessun dato da esportare", "error");
      return;
    }

    // 1. Intestazioni delle colonne
    const headers = [
      "ID",
      "Anno",
      "Titolo",
      "Autore",
      "Mese",
      "Recensore Nome",
      "Recensore Cognome",
      "Recensore Email",
      "Data Pubblicazione",
      "Link Amazon"
    ];

    // 2. Mappatura dei dati (gestione virgolette e campi vuoti)
    const rows = libri.map(l => [
      l.id,
      l.anno,
      `"${(l.titolo || '').replace(/"/g, '""')}"`, // Escape delle virgolette per Excel
      `"${(l.autore || '').replace(/"/g, '""')}"`,
      l.mese,
      l.nome,
      l.cognome,
      l.email,
      l.dataPubblicazione,
      l.link
    ]);

    // 3. Unione in stringa CSV (uso punto e virgola per Excel italiano)
    const csvContent = [
      headers.join(';'), 
      ...rows.map(r => r.join(';'))
    ].join('\n');

    // 4. Creazione file Blob con BOM per caratteri speciali (accenti)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 5. Download automatico
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Recensioni_SIC_${anno}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const aggiungiLibro = async () => {
    try {
      const nuovoLibro = {
        id: undefined,
        anno,
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

      const { data, error } = await supabase
        .from('books')
        .insert([mapBookToDb(nuovoLibro, anno)])
        .select()
        .single();

      if (error) {
        console.error('Errore inserimento libro', error);
        showMessage('Errore durante la creazione del libro', 'error');
        return;
      }

      const libroInserito = mapBookFromDb(data);
      setLibri((prev) => [...prev, libroInserito]);
      showMessage('Libro aggiunto', 'success');
    } catch (err) {
      console.error('Errore generico inserimento libro', err);
      showMessage('Errore durante la creazione del libro', 'error');
    }
  };

  const aggiornaLibro = async (id, campo, valore) => {
    const libroEsistente = libri.find((l) => l.id === id);
    if (!libroEsistente) return;

    let libroAggiornato = { ...libroEsistente, [campo]: valore };

    if (campo === 'mese') {
      const date = calcolaDate(valore);
      libroAggiornato = { ...libroAggiornato, ...date };
    }

    if (campo === 'nomeCognome') {
      const parti = valore.trim().split(' ');
      libroAggiornato = {
        ...libroAggiornato,
        nomeCognome: valore,
        nome: parti[0] || '',
        cognome: parti.slice(1).join(' ') || ''
      };
    }

    try {
      const { error } = await supabase
        .from('books')
        .update(mapBookToDb(libroAggiornato, anno))
        .eq('id', id);

      if (error) {
        console.error('Errore aggiornamento libro', error);
        showMessage('Errore durante il salvataggio del libro', 'error');
        return;
      }

      setLibri((prevLibri) =>
        prevLibri.map((l) => (l.id === id ? libroAggiornato : l))
      );
    } catch (err) {
      console.error('Errore generico aggiornamento libro', err);
      showMessage('Errore durante il salvataggio del libro', 'error');
    }
  };

  const rimuoviLibro = async (id) => {
    try {
      const { error } = await supabase.from('books').delete().eq('id', id);

      if (error) {
        console.error('Errore cancellazione libro', error);
        showMessage('Errore durante la cancellazione del libro', 'error');
        return;
      }

      setLibri((prev) => prev.filter((libro) => libro.id !== id));
      showMessage('Libro eliminato', 'success');
    } catch (err) {
      console.error('Errore generico cancellazione libro', err);
      showMessage('Errore durante la cancellazione del libro', 'error');
    }
  };

  const clearReviewer = async (id) => {
    const libroEsistente = libri.find((l) => l.id === id);
    if (!libroEsistente) return;

    const libroPulito = {
      ...libroEsistente,
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

    try {
      const { error } = await supabase
        .from('books')
        .update(mapBookToDb(libroPulito, anno))
        .eq('id', id);

      if (error) {
        console.error('Errore clear reviewer', error);
        showMessage('Errore durante la liberazione del libro', 'error');
        return;
      }

      setLibri((prevLibri) =>
        prevLibri.map((l) => (l.id === id ? libroPulito : l))
      );
      showMessage('Recensione svuotata per questo libro', 'success');
    } catch (err) {
      console.error('Errore generico clear reviewer', err);
      showMessage('Errore durante la liberazione del libro', 'error');
    }
  };

  const handleImageUpload = async (e, libroId = null) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        if (libroId) {
          await aggiornaLibro(libroId, 'copertina', base64);
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

    const clearBackgroundImage = async () => {
    try {
      setBackgroundImage('');
      await storage.set('background_image', '');
    } catch (error) {
      console.error('Errore rimozione sfondo', error);
    }
  };

    // const handleLogoUpload = (e, type) => {
    // const file = e.target.files[0];
    // if (!file) return;

    // const reader = new FileReader();
    // reader.onload = async (event) => {
      // const base64 = event.target.result;
      // try {
        // if (type === 'pmi') {
          // setPmiLogo(base64);
          // await storage.set('pmi_logo', base64);
        // } else if (type === 'sic') {
          // setSicLogo(base64);
          // await storage.set('sic_logo', base64);
        //}
      //} catch (err) {
        //console.error('Errore salvataggio logo', err);
      //}
    //};
    //reader.readAsDataURL(file);
  //}; 

  //const handleLogoRemove = async (type) => {
    //try {
      //if (type === 'pmi') {
        //setPmiLogo('');
        //await storage.set('pmi_logo', '');
      //} else if (type === 'sic') {
        //setSicLogo('');
        //await storage.set('sic_logo', '');
      //}
    //} catch (err) {
      //console.error('Errore rimozione logo', err);
    //}
  //};

  const selezionaLibro = (libro) => {
    if (isBookAssigned(libro)) {
      showMessage('Questo libro è già stato selezionato', 'error');
      return;
    }
    setSelectedBook(libro);
    setRecensoreData({
      mese: '',
      nome: '',
      cognome: '',
      email: ''
    });
  };

  const confermaRecensione = async () => {
    // 1. Validazione campi vuoti
    if (
      !recensoreData.mese ||
      !recensoreData.nome ||
      !recensoreData.cognome ||
      !recensoreData.email
    ) {
      showMessage('Compila tutti i campi', 'error');
      return;
    }

    // 2. Validazione Email (PUNTO 7)
    if (!validateEmail(recensoreData.email)) {
      setEmailError(true);
      showMessage('Inserisci un indirizzo email valido', 'error');
      return;
    }

    // 3. Attiva Loader (PUNTO 6)
    setIsLoading(true);

    try {
      // Controllo: mese già occupato?
      const recensioniAttiveArray = libri.filter(isBookAssigned);
      
      if (
        recensioniAttiveArray.some(
          (l) =>
            l.mese === recensoreData.mese &&
            l.id !== (selectedBook?.id ?? -1)
        )
      ) {
        showMessage('Questo mese è già stato scelto', 'error');
        setIsLoading(false); // Spegni loader
        return;
      }

      // Controllo: email duplicata?
      if (
        recensioniAttiveArray.some(
          (l) =>
            l.email === recensoreData.email &&
            l.id !== (selectedBook?.id ?? -1)
        )
      ) {
        showMessage('Hai già una recensione assegnata', 'error');
        setIsLoading(false); // Spegni loader
        return;
      }

      const libroOriginale = libri.find((l) => l.id === selectedBook.id);
      const date = calcolaDate(recensoreData.mese);
      const nomeCompleto = `${recensoreData.nome.trim()} ${recensoreData.cognome.trim()}`;

      const libroAggiornato = {
        ...libroOriginale,
        mese: recensoreData.mese,
        nomeCognome: nomeCompleto,
        nome: recensoreData.nome.trim(),
        cognome: recensoreData.cognome.trim(),
        email: recensoreData.email.trim(),
        ...date
      };

      // Update su Supabase
      const { error } = await supabase
        .from('books')
        .update(mapBookToDb(libroAggiornato, anno))
        .eq('id', libroAggiornato.id);

      if (error) throw error;

      // Successo
      setLibri((prevLibri) =>
        prevLibri.map((l) => (l.id === libroAggiornato.id ? libroAggiornato : l))
      );
      setSelectedBook(null);
      setRecensoreData({ mese: '', nome: '', cognome: '', email: '' });
      setLastConfirmedBookId(libroAggiornato.id);
      setShowPostConfirmModal(true);
      showMessage('Recensione confermata!', 'success');

    } catch (err) {
      console.error('Errore confermaRecensione', err);
      showMessage('Errore durante il salvataggio', 'error');
    } finally {
      // 4. Spegni Loader (sempre, anche se errore)
      setIsLoading(false);
    }
  };

  const handleSendEmail = async (libro) => {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    showMessage(
      'Configura prima EmailJS nel codice (SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY)',
      'error'
    );
    return;
  }

  if (!libro) {
    showMessage('Nessun libro selezionato per l’invio email', 'error');
    return;
  }

  const rawEmail = libro.email || '';
  const toEmail = rawEmail.trim();

  if (!toEmail) {
    showMessage(
      'Nessuna email recensore valida impostata per questo libro',
      'error'
    );
    return;
  }

  // Contesto con i campi dinamici
  const context = {
    nome: libro.nome || '',
    cognome: libro.cognome || '',
    nomeCognome: libro.nomeCognome || '',
    titolo: libro.titolo || '',
    autore: libro.autore || '',
    mese: libro.mese || '',
    dataPubblicazione: libro.dataPubblicazione || '',
    dataInvioInfo: libro.dataInvioInfo || '',
    dataInvioRecensione: libro.dataInvioRecensione || '',
    dataInvioCommenti: libro.dataInvioCommenti || '',
    dataInvioRecensioneConCommenti:
      libro.dataInvioRecensioneConCommenti || '',
    dataPreparazionePubblicazione:
      libro.dataPreparazionePubblicazione || '',
    reviewTemplateUrl: emailConfig.reviewTemplateUrl || '',
    privacyTemplateUrl: emailConfig.privacyTemplateUrl || '',
    link: normalizeUrl(libro.link || '')
  };

  const subject = applyTemplate(emailConfig.subjectTemplate, {
    ...context,
    Nome: context.nome,
    Cognome: context.cognome,
    NomeCompleto: context.nomeCognome,
    Titolo: context.titolo,
    Autore: context.autore,
    Mese: context.mese
  });

  const normalizedFixedRecipients = normalizeRecipientsList(
    emailConfig.fixedRecipients || ''
  );  

  const templateParams = {
    // 👇 unico destinatario usato nella sezione Email recipients (To = to_email)
    to_email: toEmail,
    to_name:
      (context.nome && context.cognome
        ? `${context.nome} ${context.cognome}`
        : context.nomeCognome) || '',
    subject,
    fixed_recipients: normalizedFixedRecipients, // 👇 nessun CC per ora, niente fixed_recipients
    Nome: context.nome,
    Cognome: context.cognome,
    NomeCompleto: context.nomeCognome,
    Titolo: context.titolo,
    Autore: context.autore,
    Mese: context.mese,
    DataPubblicazione: context.dataPubblicazione,
    DataInvioInfo: context.dataInvioInfo,
    DataInvioRecensione: context.dataInvioRecensione,
    DataInvioCommenti: context.dataInvioCommenti,
    DataInvioRecensioneConCommenti:
      context.dataInvioRecensioneConCommenti,
    DataPreparazionePubblicazione:
      context.dataPreparazionePubblicazione,
    TemplateRecensioneUrl: context.reviewTemplateUrl,
    InformativaPrivacyUrl: context.privacyTemplateUrl,
    AmazonUrl: context.link
  };

  try {
    console.log('Invio email recensore, params:', templateParams);
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
    showMessage('Email inviata al recensore', 'success');
  } catch (error) {
    console.error('Errore invio email recensore', error);
    showMessage("Errore durante l'invio della email al recensore", 'error');
  }
};

  const handleSendTestEmail = async () => {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    showMessage(
      'Configura prima EmailJS nel codice (SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY)',
      'error'
    );
    return;
  }

  const rawEmail = testEmailAddress || '';
  const toEmail = rawEmail.trim();

  if (!toEmail) {
    showMessage('Inserisci una email di test', 'error');
    return;
  }

  const context = {
    nome: 'Mario',
    cognome: 'Rossi',
    nomeCognome: 'Mario Rossi',
    titolo: 'Titolo di esempio',
    autore: 'Autore di esempio',
    mese: 'Gennaio',
    dataPubblicazione: '27/01/2026',
    dataInvioInfo: '04/01/2026',
    dataInvioRecensione: '23/01/2026',
    dataInvioCommenti: '24/01/2026',
    dataInvioRecensioneConCommenti: '25/01/2026',
    dataPreparazionePubblicazione: '26/01/2026',
    reviewTemplateUrl: emailConfig.reviewTemplateUrl || '',
    privacyTemplateUrl: emailConfig.privacyTemplateUrl || '',
    link: normalizeUrl('https://www.pmi-sic.org')
  };

  const subject = applyTemplate(emailConfig.subjectTemplate, {
    ...context,
    Nome: context.nome,
    Cognome: context.cognome,
    NomeCompleto: context.nomeCognome,
    Titolo: context.titolo,
    Autore: context.autore,
    Mese: context.mese
  });

  const normalizedFixedRecipients = normalizeRecipientsList(
    emailConfig.fixedRecipients || ''
  );

  const templateParams = {
    to_email: toEmail,
    to_name: 'Test Recipient',
    fixed_recipients: normalizedFixedRecipients,
    subject,
    Nome: context.nome,
    Cognome: context.cognome,
    NomeCompleto: context.nomeCognome,
    Titolo: context.titolo,
    Autore: context.autore,
    Mese: context.mese,
    DataPubblicazione: context.dataPubblicazione,
    DataInvioInfo: context.dataInvioInfo,
    DataInvioRecensione: context.dataInvioRecensione,
    DataInvioCommenti: context.dataInvioCommenti,
    DataInvioRecensioneConCommenti:
      context.dataInvioRecensioneConCommenti,
    DataPreparazionePubblicazione:
      context.dataPreparazionePubblicazione,
    TemplateRecensioneUrl: context.reviewTemplateUrl,
    InformativaPrivacyUrl: context.privacyTemplateUrl,
    AmazonUrl: context.link
  };

  try {
    console.log('Invio email di prova, params:', templateParams);
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
    showMessage('Email di prova inviata', 'success');
  } catch (error) {
    console.error('Errore invio email di prova', error);
    showMessage("Errore durante l'invio della email di prova", 'error');
  }
};

  const handleSendEmailFromModal = () => {
    const libro = libri.find((l) => l.id === lastConfirmedBookId);
    if (!libro) {
      showMessage('Impossibile trovare il libro selezionato', 'error');
      return;
    }
    handleSendEmail(libro);
    setShowPostConfirmModal(false);
  };

  // ✅ adesso il contatore usa la logica "libro assegnato"
  const recensioniAttive = libri.filter(isBookAssigned).length;
  const isBloccato = recensioniAttive >= 12;

  // --- LOGICA FILTRI E ORDINAMENTO (Punti 11 e 14) ---
  
  // 1. Filtro preliminare
  const libriFiltrati = libri.filter((l) => {
    // Il recensore vede SEMPRE E SOLO quelli liberi (non assegnati)
    if (!isAdmin) return !isBookAssigned(l);
    
    // L'admin vede in base al filtro selezionato
    if (filterStatus === 'assigned') return isBookAssigned(l);
    if (filterStatus === 'free') return !isBookAssigned(l);
    return true; // 'all'
  });

  // 2. Ordinamento
  const libriOrdinati = [...libriFiltrati].sort((a, b) => {
    // Logica Admin: Prima assegnati, poi per mese, poi alfabetico
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
    // Logica Recensore (e fallback alfabetico): Ordine alfabetico titolo
    const titoloA = (a.titolo || '').toLowerCase();
    const titoloB = (b.titolo || '').toLowerCase();
    if (titoloA < titoloB) return -1;
    if (titoloA > titoloB) return 1;
    return 0;
  });

// --- STILI DEFINITIVI (Sostituisci tutto il blocco stili con questo) ---

  const appWrapperStyle = {
  minHeight: '100vh',
  width: '100vw',           // <-- FORZO LA LARGHEZZA A TUTTO SCHERMO
  // overflowX: 'hidden',      // <-- evita eventuali scrollbar orizzontali
  // overflowY: 'auto',       // <-- scrollbar verticale se serve
  padding: '20px 24px',     // un po' di respiro ai bordi
  backgroundImage: backgroundImage
    ? `url(${backgroundImage})`
    : `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.secondary}, ${COLORS.primary})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
  fontFamily: 'Segoe UI, sans-serif',
  display: 'flex',
  justifyContent: 'center'
};

const appInnerStyle = {
  width: '100%',
  maxWidth: '1400px',       // larghezza massima “desktop”
  margin: '0 auto',         // centra il contenuto dentro il wrapper
  boxSizing: 'border-box'
};

  // HEADER in alto, sempre visibile
const mainHeaderStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: 'rgba(255,255,255,0.97)',
  backdropFilter: 'blur(12px)',
  borderRadius: '16px',
  boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
  padding: '20px 24px',
  marginBottom: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16
};

// Card “normali” (es. pannello configurazione email admin)
const panelCardStyle = {
  background: 'rgba(255,255,255,0.97)',
  borderRadius: '16px',
  boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16
};

const emailPanelStyle = {
  ...panelCardStyle,
  marginTop: '24px',
  marginBottom: '24px'
};

  const cardGridStyle = {
    display: 'grid',
    // 300px assicura 4 colonne su schermi standard (1300px+)
    // auto-fill riempie la riga disponibile
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
    gap: '30px', 
    marginTop: '16px',
    marginBottom: '40px',
    alignItems: 'start'
  };

  const getBookCardStyle = (assigned) => ({
    background: assigned ? '#f0fdf4' : '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    border: assigned ? `2px solid ${COLORS.success}` : '1px solid transparent',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s',
    opacity: (isAdmin && filterStatus === 'free' && assigned) ? 0.5 : 1,
    height: '100%' // Assicura altezza uniforme
  });

  const coverStyle = {
    width: '100%',
    height: '380px', // Altezza generosa per vedere bene la copertina
    objectFit: 'contain', // MOSTRA TUTTA LA COPERTINA
    objectPosition: 'center',
    backgroundColor: '#f8fafc', // Grigio chiaro per riempire i bordi
    display: 'block',
    borderBottom: '1px solid #e2e8f0'
  };

  const bookBodyStyle = {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1
  };

  const monthBadgeStyle = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    background: '#ede9fe', 
    color: COLORS.primary,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    border: `1px solid ${COLORS.primary}30`
  };

  // Stili input e label (accessori)
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' };
  const inputStyle = { width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '14px' };
    const smallTagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#f3f4f6',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '11px',
    color: '#4b5563',
    marginTop: '8px'
  };

  // --- SCHERMATA LOGIN ---
  if (showLogin) {
    return (
      <div style={appWrapperStyle}>
         <div
        style={{
          ...appInnerStyle,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            ...panelCardStyle,
            width: '100%',
            maxWidth: '900px',   // larghezza “desktop” comoda
            margin: 0,            // niente margine extra
          }}
        >

            {/* LOGO + TITOLO */}
<div style={{ textAlign: 'center', marginBottom: '24px' }}>
  {/* Logo fisso PMI-SIC dal repo (cartella public) */}
  <img
    src={import.meta.env.BASE_URL + 'pmisiclogo.png'}
    alt="PMI-SIC"
    style={{
      maxWidth: '200px',
      maxHeight: '80px',
      objectFit: 'contain',
      marginBottom: '16px'
    }}
  />

  <h1
    style={{
      fontSize: '26px',
      fontWeight: '700',
      color: '#111827',
      margin: 0
    }}
  >
    SIC Book Review
  </h1>

  <p style={{ color: '#6b7280', marginTop: '8px' }}>
    Seleziona il tuo ruolo
  </p>
</div>


            {/* BOTTONI RUOLO + LOGIN ADMIN */}
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
                    fontSize: '14px',
                    boxSizing: 'border-box'
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
      </div>
    );
  }

  // --- APP PRINCIPALE ---
  return (
    <div style={appWrapperStyle}>
      <div style={appInnerStyle}>
        {/* HEADER STICKY */}
        <div style={mainHeaderStyle}>
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
                  {/* SELETTORE ANNO (PUNTO 5) */}
<div 
  style={{ 
    display: 'flex', 
    alignItems: 'center', 
    background: '#f9fafb', 
    borderRadius: '8px', 
    padding: '0 8px', 
    border: '1px solid #d1d5db',
    height: '34px'
  }}
>
   <span 
     style={{ 
       fontSize: '11px', 
       fontWeight: 700, 
       color: '#6b7280', 
       marginRight: 6,
       letterSpacing: '0.5px'
     }}
   >
     ANNO:
   </span>
   <select
     value={anno}
     onChange={(e) => setAnno(Number(e.target.value))}
     style={{
       border: 'none',
       background: 'transparent',
       fontWeight: 700,
       fontSize: '13px',
       outline: 'none',
       cursor: 'pointer',
       color: '#111827'
     }}
   >
      <option value={2025}>2025</option>
      <option value={2026}>2026</option>
      <option value={2027}>2027</option>
      <option value={2028}>2028</option>
   </select>
</div>

{/* PUNTO 11: FILTRI TOGGLE */}
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '2px', marginRight: '8px' }}>
                {['all', 'assigned', 'free'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    style={{
                      border: 'none',
                      background: filterStatus === status ? '#ffffff' : 'transparent',
                      color: filterStatus === status ? '#111827' : '#6b7280',
                      boxShadow: filterStatus === status ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {status === 'all' ? 'Tutti' : status === 'assigned' ? 'Assegnati' : 'Liberi'}
                  </button>
                ))}
              </div>

                  {/* NUOVO BOTTONE EXPORT CSV */}
    <button
      onClick={handleExportCsv}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#10b981', // Verde smeraldo per distinguerlo
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '13px',
        cursor: 'pointer'
      }}
    >
      <Download size={14} />
      CSV
    </button>
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
                                    <div style={{ display: 'flex', gap: 8 }}>
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
                    {backgroundImage && (
                      <button
                        onClick={clearBackgroundImage}
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          background: '#ffffff',
                          color: '#374151',
                          fontSize: '12px',
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Rimuovi sfondo
                      </button>
                    )}
                  </div>
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
                {false  && isAdmin && (
            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16
              }}
            >
              {/* Logo PMI-SIC (login) */}
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  minWidth: '240px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#111827'
                    }}
                  >
                    Logo PMI-SIC (pagina iniziale)
                  </span>
                  {pmiLogo && (
                    <button
                      onClick={() => handleLogoRemove('pmi')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '11px',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#ffffff',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#111827'
                    }}
                  >
                    <Upload size={14} />
                    Carica logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'pmi')}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {pmiLogo && (
                    <img
                      src={pmiLogo}
                      alt="PMI-SIC preview"
                      style={{
                        height: '32px',
                        width: 'auto',
                        objectFit: 'contain'
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Logo SIC Book Review (header app) */}
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  minWidth: '240px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#111827'
                    }}
                  >
                    Logo SIC Book Review
                  </span>
                  {sicLogo && (
                    <button
                      onClick={() => handleLogoRemove('sic')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '11px',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  
                    <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#ffffff',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#111827'
                    }}
                  >
                    <Upload size={14} />
                    Carica logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'sic')}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {sicLogo && (
                    <img
                      src={sicLogo}
                      alt="SIC Book Review preview"
                      style={{
                        height: '32px',
                        width: 'auto',
                        objectFit: 'contain'
                      }}
                    />
                  )}
                </div>
              </div>
            </div> 
          )}

          {message.text && (
  <div
    style={{
      marginTop: '16px',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 500,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      color: message.type === 'success' ? '#166534' : '#b91c1c',
      background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
      boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
       {message.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
       <span>{message.text}</span>
    </div>
    <button 
      onClick={closeMessage} 
      style={{ 
        background: 'transparent', 
        border: 'none', 
        cursor: 'pointer', 
        color: 'inherit',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <X size={18}/>
    </button>
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
              Scrivi una email ai{' '}
  <a
    href="mailto:comunicazione@pmi-sic.org;enzo.mosca@pmi-sic.org"
    style={{ color: COLORS.primary, textDecoration: 'underline' }}
  >
    referenti del PMI-SIC
  </a>
  , così che possano contattarti qualora si liberasse uno slot per una recensione.
            </p>
          </div>
        ) : (
          <div style={cardGridStyle}>
            {libriOrdinati.map((libro) => (
              <div
                key={libro.id}
                style={getBookCardStyle(isBookAssigned(libro))} // PUNTO 14
              >
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
    alignItems: 'center',
    marginBottom: 4,
    minHeight: '24px' // Aggiunto per mantenere allineamento se ID sparisce
  }}
>
  {/* MODIFICA: ID visibile solo se admin */}
  {isAdmin ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  {isAdmin ? (
    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>
      #{libro.id}
    </span>
  ) : null}
  
  {/* PUNTO 12: Badge Mese (visibile se assegnato e admin) */}
  {isBookAssigned(libro) && isAdmin && (
    <span style={monthBadgeStyle}>
      {libro.mese}
    </span>
  )}
</div>
  ) : (
    <span></span> // Spacer vuoto per mantenere layout se necessario
  )}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isBookAssigned(libro) && (
                          <button
                            onClick={() => clearReviewer(libro.id)}
                            style={{
                              border: 'none',
                              background: '#e5f9ed',
                              color: '#166534',
                              borderRadius: '999px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="Libera questo libro (rimuovi il recensore)"
                          >
                            Libera libro
                          </button>
                        )}
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
                      </div>
                    )}
                  </div>

                  {/* CONTENUTO CARD */}
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

                        {isBookAssigned(libro) ? (
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
                                  {libro
                                    .dataInvioRecensioneConCommenti}
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
                                Libera Libro
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
                          href={normalizeUrl(libro.link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            marginTop: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '6px 10px',
                            borderRadius: '999px',
                            background: COLORS.secondary,
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <ExternalLink size={14} />
                          Amazon
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
                            isBookAssigned(l) &&
                            l.mese === m &&
                            l.id !== selectedBook.id
                        )}
                      >
                        {m}
                        {libri.some(
                          (l) =>
                            isBookAssigned(l) &&
                            l.mese === m &&
                            l.id !== selectedBook.id
                        ) && ' (occupato)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MODIFICA: Due input affiancati per Nome e Cognome */}
<div style={{ display: 'flex', gap: 10 }}>
  <div style={{ flex: 1 }}>
    <label style={labelStyle}>Nome</label>
    <input
      type="text"
      value={recensoreData.nome}
      onChange={(e) =>
        setRecensoreData({
          ...recensoreData,
          nome: e.target.value
        })
      }
      style={inputStyle}
      placeholder="Mario"
    />
  </div>
  <div style={{ flex: 1 }}>
    <label style={labelStyle}>Cognome</label>
    <input
      type="text"
      value={recensoreData.cognome}
      onChange={(e) =>
        setRecensoreData({
          ...recensoreData,
          cognome: e.target.value
        })
      }
      style={inputStyle}
      placeholder="Rossi"
    />
  </div>
</div>

                <div>
  <label style={labelStyle}>Email</label>
  <input
    type="email"
    value={recensoreData.email}
    onChange={(e) => {
      setRecensoreData({
        ...recensoreData,
        email: e.target.value
      });
      setEmailError(false); // Resetta errore mentre scrivi
    }}
    style={{
      ...inputStyle,
      border: emailError ? '1px solid #ef4444' : '1px solid #d1d5db',
      outlineColor: emailError ? '#ef4444' : undefined
    }}
    placeholder="mario.rossi@email.com"
  />
  {emailError && (
    <span style={{ fontSize: '11px', color: '#ef4444', marginTop: 4, display: 'block' }}>
      Indirizzo email non valido
    </span>
  )}
</div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: '16px' }}>
  <button
    onClick={() => setSelectedBook(null)}
    disabled={isLoading} // Disabilita se carica
    style={{
      flex: 1,
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      background: '#f3f4f6',
      color: '#374151',
      fontSize: '13px',
      padding: '8px 10px',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      opacity: isLoading ? 0.7 : 1
    }}
  >
    Annulla
  </button>
  <button
    onClick={confermaRecensione}
    disabled={isLoading} // Disabilita se carica
    style={{
      flex: 1,
      borderRadius: '10px',
      border: 'none',
      background: COLORS.primary,
      color: '#ffffff',
      fontSize: '13px',
      padding: '8px 10px',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: isLoading ? 0.8 : 1
    }}
  >
    {isLoading ? (
      <>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
        Attendere...
      </>
    ) : (
      'Conferma'
    )}
  </button>
</div>

{/* Stile per l'animazione rotazione */}
<style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
              {/* PUNTO 9: Feedback esplicito */}
<div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', margin: '12px 0', border: '1px solid #e5e7eb', textAlign: 'left' }}>
  <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 4px 0' }}>
    <strong>Libro:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.titolo}
  </p>
  <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 4px 0' }}>
    <strong>Mese:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.mese}
  </p>
  <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
    <strong>La tua email:</strong> {libri.find(l => l.id === lastConfirmedBookId)?.email}
  </p>
</div>

<p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '14px' }}>
  Clicca su "Invia email di conferma" per ricevere a breve una email con tutti i dettagli operativi e il template per la recensione.
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
            style={emailPanelStyle}
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
                {
                  '{{Nome}} {{Cognome}} {{NomeCompleto}} {{Titolo}} {{Autore}} {{Mese}} {{DataPubblicazione}} {{DataInvioInfo}} {{DataInvioRecensione}} {{DataInvioCommenti}} {{DataInvioRecensioneConCommenti}} {{DataPreparazionePubblicazione}} {{TemplateRecensioneUrl}} {{InformativaPrivacyUrl}} {{AmazonUrl}}'
                }
              </code>
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.3fr)',
                gap: '16px'
              }}
            >
              {/* COLONNA SINISTRA */}
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
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
                    placeholder="es: comunicazione@pmi-sic.org"
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    URL Template Recensione (Word/PDF)
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
                    style={inputStyle}
                    placeholder="https://.../template-recensione.docx"
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    URL Informativa Privacy (Word/PDF)
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
                    placeholder="https://.../informativa-privacy.docx"
                  />
                </div>
              </div>

              {/* COLONNA DESTRA */}
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

            {/* BLOCCO EMAIL DI PROVA */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#111827'
                }}
              >
                Invia email di prova (senza usare un libro reale)
              </span>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center'
                }}
              >
                <input
                  type="email"
                  placeholder="email per il test (es. la tua)"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    minWidth: '200px'
                  }}
                />
                <button
                  onClick={handleSendTestEmail}
                  style={{
                    borderRadius: '8px',
                    border: 'none',
                    background: COLORS.secondary,
                    color: '#ffffff',
                    fontSize: '12px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Invia email di prova
                </button>
              </div>
              <p
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  margin: 0
                }}
              >
                Verrà inviata una email di esempio utilizzando il template e le
                URL impostate sopra, con dati fittizi (Mario Rossi, date di
                esempio).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecensioniApp;
