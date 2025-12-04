import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function Dashboard() {
  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState({
    date: '',
    startTime: '',
    endTime: '',
    quantity: '1',
    reason: 'Estudo individual',
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    quantity: '1',
    reason: 'Estudo individual',
  });
  // faq state
  const [showFAQ, setShowFAQ] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  // history state
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearchFilter, setHistorySearchFilter] = useState('');
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 3,
    total: 0,
    totalPages: 0,
  });
  // admin reservations pagination (5 cols × 3 rows = 15 per page)
  const [adminResPage, setAdminResPage] = useState(1);
  const [adminRoomFilter, setAdminRoomFilter] = useState('');
  const [allRooms, setAllRooms] = useState([]);
  const [adminRoomDropdownOpen, setAdminRoomDropdownOpen] = useState(false);
  const ADMIN_RES_PER_PAGE = 15;
  const faqItems = [
    {
      q: 'Quantas reservas posso fazer?',
      a: 'Cada usuário pode ter até 3 reservas ativas ao mesmo tempo.',
    },
    {
      q: 'Posso fazer mais de uma reserva no mesmo dia?',
      a: 'Não. É permitido apenas 1 reserva por dia.',
    },
    {
      q: 'Qual é o tempo mínimo de uma reserva?',
      a: 'O tempo mínimo é de 15 minutos.',
    },
    {
      q: 'Qual é o horário de funcionamento da biblioteca?',
      a: 'Segunda: 7h – 21h55\n\nTerça: 7h – 21h55\n\nQuarta: 7h – 21h55\n\nQuinta: 7h – 21h55\n\nSexta: 7h – 21h55\n\nSábado: 8h – 13h55\n\nDomingo: Fechado',
    },
    {
      q: 'Posso reservar fora do horário de funcionamento?',
      a: 'Não. Todas as reservas precisam estar dentro do horário de funcionamento.',
    },
    {
      q: 'O que acontece se eu não comparecer?',
      a: 'A reserva pode ser cancelada automaticamente conforme as regras internas da biblioteca.',
    },
  ];
  const MIN_SPINNER_MS = 600;
  const getOpeningHours = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 0) return null; // sunday closed
    if (dow === 6) return { open: '08:00', close: '13:55' }; // saturday
    return { open: '07:00', close: '21:55' }; // monday-friday
  };

  // generate all valid times with minutes in 15-minute intervals (00, 15, 30, 45)
  const generateTimeOptions = (openTime, closeTime) => {
    const options = [];
    const parseTime = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const openMinutes = parseTime(openTime);
    const closeMinutes = parseTime(closeTime);

    for (let min = openMinutes; min <= closeMinutes; min += 15) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(
        2,
        '0'
      )}`;
      options.push(timeStr);
    }
    return options;
  };
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const yyyy = todayObj.getFullYear();
  const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
  const dd = String(todayObj.getDate()).padStart(2, '0');
  const todayISO = `${yyyy}-${mm}-${dd}`;

  // create minDate in local time to avoid timezone issues
  const minDate = new Date(yyyy, todayObj.getMonth(), todayObj.getDate());

  const maxObj = new Date(todayObj);
  maxObj.setDate(maxObj.getDate() + 30);
  const maxYYYY = maxObj.getFullYear();
  const maxMM = String(maxObj.getMonth() + 1).padStart(2, '0');
  const maxDD = String(maxObj.getDate()).padStart(2, '0');
  const maxISO = `${maxYYYY}-${maxMM}-${maxDD}`;

  // create maxDate in local time to avoid timezone issues
  const maxDate = new Date(maxYYYY, maxObj.getMonth(), maxObj.getDate());

  // helper: parse time string (HH:MM) to minutes (already lowercase)
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  // helper: validate reservation time inputs (already lowercase)
  const validateReservationTimes = (startTime, endTime) => {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    if (startMin === null || endMin === null) {
      return { valid: false, message: 'Preencha horários válidos' };
    }
    if (startMin > endMin) {
      return { valid: false, message: 'Hora de término inválida' };
    }
    if (endMin - startMin < 15) {
      return {
        valid: false,
        message: 'Tempo mínimo da reserva é 15 minutos',
      };
    }
    return { valid: true };
  };

  // helper: validate opening hours (already lowercase)
  const validateOpeningHours = (dateStr, startTime, endTime) => {
    const hours = getOpeningHours(dateStr);
    if (!hours) {
      return {
        valid: false,
        message: 'Biblioteca fechada nesse dia. Selecione outra data.',
      };
    }
    const openMin = parseTimeToMinutes(hours.open);
    const closeMin = parseTimeToMinutes(hours.close);
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);

    if (startMin < openMin || endMin > closeMin) {
      return {
        valid: false,
        message: `Horário fora do funcionamento: ${hours.open}–${hours.close}`,
      };
    }
    return { valid: true };
  };

  // helper: validate time hasn't passed for today (already lowercase)
  const validateNotPastTime = (dateStr, startTime) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5);

    if (dateStr === todayStr) {
      const startMin = parseTimeToMinutes(startTime);
      const currentMin = parseTimeToMinutes(currentTime);
      if (startMin <= currentMin) {
        return {
          valid: false,
          message:
            'Não é possível fazer reservas para horários que já passaram.',
        };
      }
    }
    return { valid: true };
  };

  // helper: fetch and update reservations data (already lowercase)
  const refreshReservations = () => {
    axios
      .get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then((r) => {
        setReservations(r.data);
      });
  };

  useEffect(() => {
    if (!token) return;
    axios
      .get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then((r) => {
        console.log('Active reservations:', r.data);
        setReservations(r.data);
      });
    // fetch all rooms for filter
    axios
      .get(API + '/rooms', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then((r) => {
        setAllRooms(r.data);
      })
      .catch((err) => {
        console.error('Error fetching rooms:', err);
      });
    // fetch history
    axios
      .get(API + '/reservations/history?page=1', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then((r) => {
        console.log('History data:', r.data);
        setHistory(r.data.data);
        setHistoryPagination(r.data.pagination);
        setHistoryPage(1);
      })
      .catch((err) => {
        console.error('Error fetching history:', err);
        setHistory([]);
      });
  }, []);

  const searchAvailable = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // validate date is not in the past and within 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requested = new Date(search.date + 'T00:00:00');
    requested.setHours(0, 0, 0, 0);
    if (requested < today) {
      setError('Selecione uma data válida.');
      return;
    }

    const maxDateCheck = new Date(today);
    maxDateCheck.setDate(maxDateCheck.getDate() + 30);
    if (requested > maxDateCheck) {
      setError('Você só pode fazer reservas até 30 dias no futuro.');
      return;
    }

    // validate time hasn't passed for today
    const pastTimeCheck = validateNotPastTime(search.date, search.startTime);
    if (!pastTimeCheck.valid) {
      setError(pastTimeCheck.message);
      return;
    }

    // validate quantity
    const qty = parseInt(search.quantity, 10);
    if (!qty || qty < 1 || qty > 1000) {
      setError('Informe uma quantidade válida de pessoas');
      return;
    }

    // validate time format and duration
    const timeValidation = validateReservationTimes(
      search.startTime,
      search.endTime
    );
    if (!timeValidation.valid) {
      setError(timeValidation.message);
      return;
    }

    // validate opening hours
    const hoursValidation = validateOpeningHours(
      search.date,
      search.startTime,
      search.endTime
    );
    if (!hoursValidation.valid) {
      setError(hoursValidation.message);
      return;
    }

    // check if user already has an active or completed reservation on the same date
    // (only for non-admin users)
    if (user?.role !== 'admin') {
      const allReservations = [...reservations, ...history];
      const sameDayReservation = allReservations.find(
        (r) =>
          r.date === search.date &&
          (r.status === 'ativa' || r.status === 'concluída')
      );
      if (sameDayReservation) {
        const message =
          sameDayReservation.status === 'concluída'
            ? 'Você já possui uma reserva concluída para este dia.'
            : 'Você já possui uma reserva para este dia.';
        setError(message);
        return;
      }
    }

    let start = Date.now();
    try {
      setError('');
      setAvailableRooms([]);
      setSelectedRoomId('');
      setLoading(true);
      const res = await axios.get(API + '/rooms/available', {
        params: search,
        headers: { Authorization: 'Bearer ' + token },
      });
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
      setTimeout(() => {
        setAvailableRooms(res.data);
        setSearched(true);
        setLoading(false);
      }, wait);
    } catch (err) {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
      console.log('Error from /rooms/available:', err?.response?.data);
      setTimeout(() => {
        setError(err?.response?.data?.error || 'Erro ao buscar salas');
        setLoading(false);
      }, wait);
    }
  };

  const confirmReservation = async () => {
    if (!selectedRoomId) return setError('Selecione uma sala');

    // validate time format and duration
    const timeValidation = validateReservationTimes(
      search.startTime,
      search.endTime
    );
    if (!timeValidation.valid) return setError(timeValidation.message);

    // validate opening hours
    const hoursValidation = validateOpeningHours(
      search.date,
      search.startTime,
      search.endTime
    );
    if (!hoursValidation.valid) return setError(hoursValidation.message);

    try {
      setError('');
      await axios.post(
        API + '/reservations',
        {
          roomId: selectedRoomId,
          date: search.date,
          startTime: search.startTime,
          endTime: search.endTime,
          quantity: parseInt(search.quantity),
          reason: search.reason,
        },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const r = await axios.get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setReservations(r.data);
      // update history in real time (first page)
      const h = await axios.get(API + '/reservations/history?page=1', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setHistory(h.data.data);
      setHistoryPagination(h.data.pagination);
      setHistoryPage(1);
      setAvailableRooms([]);
      setSelectedRoomId('');
      setSearch({
        date: '',
        startTime: '',
        endTime: '',
        quantity: '1',
        reason: 'Estudo individual',
      });
      setSearched(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao criar reserva');
    }
  };

  const cancel = async (id) => {
    if (!confirm('Confirmar cancelamento?')) return;
    try {
      await axios.delete(API + '/reservations/' + id, {
        headers: { Authorization: 'Bearer ' + token },
      });
      // update active reservations
      const r = await axios.get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setReservations(r.data);
      // update history in real time (first page)
      const h = await axios.get(API + '/reservations/history?page=1', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setHistory(h.data.data);
      setHistoryPagination(h.data.pagination);
      setHistoryPage(1);
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao cancelar reserva');
    }
  };

  const openEdit = (reservation) => {
    setEditingId(reservation.id);
    setEditForm({
      date: reservation.date,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      quantity: String(reservation.quantity),
      reason: reservation.reason,
    });
  };

  const saveEdit = async () => {
    if (!editForm.date || !editForm.startTime || !editForm.endTime) {
      setError('Preencha todos os campos');
      return;
    }

    // validate time format and duration
    const timeValidation = validateReservationTimes(
      editForm.startTime,
      editForm.endTime
    );
    if (!timeValidation.valid) return setError(timeValidation.message);

    try {
      setError('');
      await axios.put(
        API + '/reservations/' + editingId,
        {
          date: editForm.date,
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          quantity: parseInt(editForm.quantity),
          reason: editForm.reason,
        },
        { headers: { Authorization: 'Bearer ' + token } }
      );
      const r = await axios.get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setReservations(r.data);
      // update history in real time (first page)
      const h = await axios.get(API + '/reservations/history?page=1', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setHistory(h.data.data);
      setHistoryPagination(h.data.pagination);
      setHistoryPage(1);
      setEditingId(null);
      setEditForm({
        date: '',
        startTime: '',
        endTime: '',
        quantity: '1',
        reason: 'Estudo individual',
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro ao editar reserva');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      date: '',
      startTime: '',
      endTime: '',
      quantity: '1',
      reason: 'Estudo individual',
    });
  };

  const loadHistoryPage = async (page) => {
    try {
      const r = await axios.get(API + `/reservations/history?page=${page}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      console.log('Pagination data:', r.data);
      setHistory(r.data.data);
      setHistoryPagination(r.data.pagination);
      setHistoryPage(page);
    } catch (err) {
      console.error('Error loading history page:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="py-6">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl text-[#044cf4] font-bold">BookSala</h1>
          <div>
            <span className="mr-4">
              Olá, {user?.name}
              {user?.role === 'admin' && ' (admin)'}
            </span>
            <button onClick={logout} className="px-3 py-1 border rounded">
              Sair
            </button>
          </div>
        </div>

        {/* faq button (discrete) and modal */}
        <button
          onClick={() => setShowFAQ(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#044cf4] hover:bg-[#033bd0] text-white w-12 h-12 flex items-center justify-center rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-[#044cf4]/30"
          aria-label="Abrir FAQ"
          title="FAQ"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="w-6 h-6"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
            <path
              d="M9.09 9a3 3 0 1 1 5.82 1c0 1.5-2 2.25-2 3"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="17" r="1" fill="white" />
          </svg>
        </button>

        {showFAQ && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowFAQ(false)}
            />
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-xl p-6 mx-4">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold text-[#044cf4]">
                  FAQ – Dúvidas Frequentes
                </h2>
                <button
                  onClick={() => setShowFAQ(false)}
                  className="text-gray-500 hover:text-gray-700 ml-4"
                  aria-label="Fechar FAQ"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {faqItems.map((item, idx) => (
                  <div key={idx} className="border border-gray-100 rounded">
                    <button
                      onClick={() =>
                        setOpenFaqIndex(openFaqIndex === idx ? null : idx)
                      }
                      className="w-full text-left px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                    >
                      <span className="font-medium text-gray-800">
                        {item.q}
                      </span>
                      <span className="text-gray-500">
                        {openFaqIndex === idx ? '−' : '+'}
                      </span>
                    </button>
                    {openFaqIndex === idx && (
                      <div className="px-4 py-3 text-gray-700 whitespace-pre-line">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* conditional layout: admin vs user */}
        {user?.role === 'admin' ? (
          // admin layout: new reservation (full width) -> all reservations (full width) -> history
          <div className="space-y-6">
            {/* new reservation form - full width */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="font-bold mb-4 text-lg text-[#044cf4]">
                Nova Reserva
              </h2>
              {error && <div className="text-red-600 mb-2">{error}</div>}

              <form
                onSubmit={searchAvailable}
                disabled={user?.role !== 'admin' && reservations.length >= 3}
              >
                <label className="block">Data</label>
                <DatePicker
                  selected={
                    search.date ? new Date(search.date + 'T00:00:00') : null
                  }
                  onChange={(d) => {
                    if (!d) {
                      setSearch({ ...search, date: '' });
                      setSearched(false);
                      return;
                    }
                    const iso = d.toISOString().slice(0, 10);
                    setError('');
                    setSearch({ ...search, date: iso });
                    setSearched(false);
                  }}
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={(d) => d.getDay() !== 0}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-3 border rounded mb-3"
                />
                <label className="block">Início</label>
                <select
                  value={search.startTime}
                  onChange={(e) => {
                    setSearch({ ...search, startTime: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="">Selecione...</option>
                  {generateTimeOptions('07:00', '21:55').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block">Fim</label>
                <select
                  value={search.endTime}
                  onChange={(e) => {
                    setSearch({ ...search, endTime: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="">Selecione...</option>
                  {generateTimeOptions('07:00', '21:55').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block">Quantidade de pessoas</label>
                <select
                  value={search.quantity}
                  onChange={(e) => {
                    setSearch({ ...search, quantity: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                <label className="block">Motivo da reserva</label>
                <select
                  value={search.reason}
                  onChange={(e) => {
                    setSearch({ ...search, reason: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="Estudo individual">Estudo individual</option>
                  <option value="Estudo em grupo">Estudo em grupo</option>
                  <option value="Leitura">Leitura</option>
                  <option value="Clube do livro">Clube do livro</option>
                  <option value="Pesquisa acadêmica">Pesquisa acadêmica</option>
                  <option value="Outro">Outro</option>
                </select>
                <button
                  disabled={
                    loading ||
                    (user?.role !== 'admin' && reservations.length >= 3)
                  }
                  className={`px-3 py-2 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded ${
                    loading ||
                    (user?.role !== 'admin' && reservations.length >= 3)
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <span className="inline-block w-5 h-5 mr-2 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    'Buscar salas disponíveis'
                  )}
                </button>
              </form>

              {availableRooms.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-[#044cf4]">
                    Salas disponíveis
                  </h3>
                  <ul className="max-h-60 overflow-y-auto border rounded-lg bg-gray-50 p-2">
                    {availableRooms.map((r) => (
                      <li
                        key={r.id}
                        className="p-3 bg-white rounded-lg shadow-sm mb-3 flex justify-between items-center border"
                      >
                        <div>
                          <div className="font-bold text-[#044cf4]">
                            {r.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {r.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Capacidade: {r.capacity} pessoas
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => setSelectedRoomId(r.id)}
                            className={`px-3 py-1 border rounded ${
                              selectedRoomId === r.id
                                ? 'bg-[#044cf4] text-white'
                                : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                            }`}
                          >
                            {selectedRoomId === r.id
                              ? 'Selecionada'
                              : 'Selecionar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <button
                      onClick={confirmReservation}
                      className="px-3 py-2 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded"
                    >
                      Confirmar reserva
                    </button>
                  </div>
                </div>
              )}
              {searched && availableRooms.length === 0 && (
                <div className="mt-4 text-red-600">
                  Salas indisponíveis em{' '}
                  <strong>{formatDate(search.date)}</strong> às{' '}
                  <strong>{search.startTime}</strong>–
                  <strong>{search.endTime}</strong>.
                </div>
              )}
            </div>

            {/* all reservations section - grid layout for admin */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold mb-4 text-lg">Todas as Reservas</h2>

                {/* room filter */}
                <div className="relative inline-block">
                  <button
                    onClick={() =>
                      setAdminRoomDropdownOpen(!adminRoomDropdownOpen)
                    }
                    className="px-3 py-2 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#044cf4] focus:ring-opacity-50 flex items-center gap-2"
                  >
                    {adminRoomFilter || 'Todas as salas'}
                    <svg
                      className={`w-4 h-4 transition-transform ${
                        adminRoomDropdownOpen ? 'rotate-180' : ''
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  {adminRoomDropdownOpen && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                      <div
                        onClick={() => {
                          setAdminRoomFilter('');
                          setAdminResPage(1);
                          setAdminRoomDropdownOpen(false);
                        }}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          adminRoomFilter === ''
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        Todas as salas
                      </div>
                      {allRooms
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((room) => (
                          <div
                            key={room.id}
                            onClick={() => {
                              setAdminRoomFilter(room.name);
                              setAdminResPage(1);
                              setAdminRoomDropdownOpen(false);
                            }}
                            className={`px-3 py-2 cursor-pointer text-sm ${
                              adminRoomFilter === room.name
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {room.name}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {reservations.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma reserva ativa.</p>
              ) : reservations.filter((r) =>
                  adminRoomFilter ? r.Room?.name === adminRoomFilter : true
                ).length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Nenhuma reserva ativa para {adminRoomFilter}.
                </p>
              ) : (
                <>
                  {/* grid: 5 columns x 3 rows */}
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    {reservations
                      .filter((r) =>
                        adminRoomFilter
                          ? r.Room?.name === adminRoomFilter
                          : true
                      )
                      .slice(
                        (adminResPage - 1) * ADMIN_RES_PER_PAGE,
                        adminResPage * ADMIN_RES_PER_PAGE
                      )
                      .map((r) => (
                        <div
                          key={r.id}
                          className="bg-white rounded-lg shadow-md p-4"
                        >
                          {editingId === r.id ? (
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-bold mb-2 text-[#044cf4]">
                                Editar Reserva
                              </h4>
                              <div className="mb-2">
                                <label className="block text-sm">Data</label>
                                <DatePicker
                                  selected={
                                    editForm.date
                                      ? new Date(editForm.date + 'T00:00:00')
                                      : null
                                  }
                                  onChange={(d) => {
                                    if (!d) {
                                      setEditForm({ ...editForm, date: '' });
                                      return;
                                    }
                                    const iso = d.toISOString().slice(0, 10);
                                    setError('');
                                    setEditForm({ ...editForm, date: iso });
                                  }}
                                  minDate={minDate}
                                  maxDate={maxDate}
                                  filterDate={(d) => d.getDay() !== 0}
                                  dateFormat="dd/MM/yyyy"
                                  className="w-full p-3 border rounded mb-3"
                                />
                              </div>
                              <div className="mb-2">
                                <label className="block text-sm">Início</label>
                                <select
                                  value={editForm.startTime}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      startTime: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border rounded mb-3"
                                >
                                  <option value="">Selecione...</option>
                                  {generateTimeOptions('07:00', '21:55').map(
                                    (t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                              <div className="mb-2">
                                <label className="block text-sm">Fim</label>
                                <select
                                  value={editForm.endTime}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      endTime: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border rounded mb-3"
                                >
                                  <option value="">Selecione...</option>
                                  {generateTimeOptions('07:00', '21:55').map(
                                    (t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                              <div className="mb-2">
                                <label className="block text-sm">
                                  Quantidade
                                </label>
                                <select
                                  value={editForm.quantity}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      quantity: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border rounded mb-3"
                                >
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                  <option value="4">4</option>
                                  <option value="5">5</option>
                                </select>
                              </div>
                              <div className="mb-2">
                                <label className="block text-sm">Motivo</label>
                                <select
                                  value={editForm.reason}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      reason: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border rounded mb-3"
                                >
                                  <option value="Estudo individual">
                                    Estudo individual
                                  </option>
                                  <option value="Estudo em grupo">
                                    Estudo em grupo
                                  </option>
                                  <option value="Leitura">Leitura</option>
                                  <option value="Clube do livro">
                                    Clube do livro
                                  </option>
                                  <option value="Pesquisa acadêmica">
                                    Pesquisa acadêmica
                                  </option>
                                  <option value="Outro">Outro</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={saveEdit}
                                  className="px-3 py-1 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-1 bg-gray-400 text-white rounded"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {/* reservation id */}
                              <div className="text-xs text-gray-500 mb-1">
                                ID:{' '}
                                <span className="font-mono font-semibold">
                                  {String(r.id).padStart(5, '0')}
                                </span>
                              </div>
                              {/* room name */}
                              <h4 className="font-semibold text-[#044cf4] text-base mb-2">
                                {r.Room?.name}
                              </h4>

                              {/* date and time */}
                              <div className="space-y-1.5 text-sm text-gray-600 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <rect
                                      x="3"
                                      y="4"
                                      width="18"
                                      height="18"
                                      rx="2"
                                      ry="2"
                                    />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                  </svg>
                                  <span>{formatDate(r.date)}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <circle cx="12" cy="12" r="9" />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 7v5l3 3"
                                    />
                                  </svg>
                                  <span>
                                    {r.startTime}–{r.endTime}
                                  </span>
                                </div>
                              </div>

                              {/* additional info */}
                              <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                                <div className="flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <circle cx="12" cy="8" r="3" />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2"
                                    />
                                  </svg>
                                  <span>
                                    {r.User?.name || '—'}
                                    {r.User?.role === 'admin' && (
                                      <span className="text-xs text-orange-600 ml-1">
                                        (admin)
                                      </span>
                                    )}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                  </svg>
                                  <span>
                                    {r.quantity}{' '}
                                    {r.quantity > 1 ? 'pessoas' : 'pessoa'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 flex-shrink-0"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                    />
                                  </svg>
                                  <span className="truncate">{r.reason}</span>
                                </div>
                              </div>

                              {/* action buttons - horizontal in bottom right */}
                              {(user?.role === 'admin' ||
                                r.User?.matricula === user?.matricula) && (
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => openEdit(r)}
                                    className="px-3 py-1.5 text-xs font-medium border rounded bg-[#e6f0ff] hover:bg-[#d2e7ff] text-[#044cf4] transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => cancel(r.id)}
                                    className="px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* pagination */}
                  {Math.ceil(
                    reservations.filter((r) =>
                      adminRoomFilter ? r.Room?.name === adminRoomFilter : true
                    ).length / ADMIN_RES_PER_PAGE
                  ) > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <div className="text-sm text-gray-600">
                        Página {adminResPage} de{' '}
                        {Math.ceil(
                          reservations.filter((r) =>
                            adminRoomFilter
                              ? r.Room?.name === adminRoomFilter
                              : true
                          ).length / ADMIN_RES_PER_PAGE
                        )}{' '}
                        (
                        {
                          reservations.filter((r) =>
                            adminRoomFilter
                              ? r.Room?.name === adminRoomFilter
                              : true
                          ).length
                        }{' '}
                        reserva
                        {reservations.filter((r) =>
                          adminRoomFilter
                            ? r.Room?.name === adminRoomFilter
                            : true
                        ).length !== 1
                          ? 's'
                          : ''}
                        )
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setAdminResPage(Math.max(1, adminResPage - 1))
                          }
                          disabled={adminResPage === 1}
                          className={`px-3 py-1 border rounded text-sm ${
                            adminResPage === 1
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                          }`}
                        >
                          ← Anterior
                        </button>
                        <button
                          onClick={() =>
                            setAdminResPage(
                              Math.min(
                                Math.ceil(
                                  reservations.length / ADMIN_RES_PER_PAGE
                                ),
                                adminResPage + 1
                              )
                            )
                          }
                          disabled={
                            adminResPage ===
                            Math.ceil(reservations.length / ADMIN_RES_PER_PAGE)
                          }
                          className={`px-3 py-1 border rounded text-sm ${
                            adminResPage ===
                            Math.ceil(reservations.length / ADMIN_RES_PER_PAGE)
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                          }`}
                        >
                          Próxima →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          // user layout: grid with form (2 cols) + reservations (1 col)
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2">
              <h2 className="font-bold mb-4 text-lg text-[#044cf4]">
                Nova Reserva
              </h2>
              {error && <div className="text-red-600 mb-2">{error}</div>}

              {reservations.length >= 3 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
                  <p className="font-bold">Limite de 3 reservas atingido</p>
                </div>
              )}

              <form
                onSubmit={searchAvailable}
                disabled={reservations.length >= 3}
              >
                <label className="block">Data</label>
                <DatePicker
                  selected={
                    search.date ? new Date(search.date + 'T00:00:00') : null
                  }
                  onChange={(d) => {
                    if (!d) {
                      setSearch({ ...search, date: '' });
                      setSearched(false);
                      return;
                    }
                    const iso = d.toISOString().slice(0, 10);
                    setError('');
                    setSearch({ ...search, date: iso });
                    setSearched(false);
                  }}
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={(d) => d.getDay() !== 0}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-3 border rounded mb-3"
                />
                <label className="block">Início</label>
                <select
                  value={search.startTime}
                  onChange={(e) => {
                    setSearch({ ...search, startTime: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="">Selecione...</option>
                  {generateTimeOptions('07:00', '21:55').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block">Fim</label>
                <select
                  value={search.endTime}
                  onChange={(e) => {
                    setSearch({ ...search, endTime: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="">Selecione...</option>
                  {generateTimeOptions('07:00', '21:55').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="block">Quantidade de pessoas</label>
                <select
                  value={search.quantity}
                  onChange={(e) => {
                    setSearch({ ...search, quantity: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                <label className="block">Motivo da reserva</label>
                <select
                  value={search.reason}
                  onChange={(e) => {
                    setSearch({ ...search, reason: e.target.value });
                    setSearched(false);
                  }}
                  className="w-full p-3 border rounded mb-3"
                >
                  <option value="Estudo individual">Estudo individual</option>
                  <option value="Estudo em grupo">Estudo em grupo</option>
                  <option value="Leitura">Leitura</option>
                  <option value="Clube do livro">Clube do livro</option>
                  <option value="Pesquisa acadêmica">Pesquisa acadêmica</option>
                  <option value="Outro">Outro</option>
                </select>
                <button
                  disabled={loading || reservations.length >= 3}
                  className={`px-3 py-2 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded ${
                    loading || reservations.length >= 3
                      ? 'opacity-60 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <span className="inline-block w-5 h-5 mr-2 border-4 border-white border-t-transparent rounded-full animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    'Buscar salas disponíveis'
                  )}
                </button>
              </form>

              {availableRooms.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-[#044cf4]">
                    Salas disponíveis
                  </h3>
                  <ul className="max-h-60 overflow-y-auto border rounded-lg bg-gray-50 p-2">
                    {availableRooms.map((r) => (
                      <li
                        key={r.id}
                        className="p-3 bg-white rounded-lg shadow-sm mb-3 flex justify-between items-center border"
                      >
                        <div>
                          <div className="font-bold text-[#044cf4]">
                            {r.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            {r.description}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Capacidade: {r.capacity} pessoas
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => setSelectedRoomId(r.id)}
                            className={`px-3 py-1 border rounded ${
                              selectedRoomId === r.id
                                ? 'bg-[#044cf4] text-white'
                                : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                            }`}
                          >
                            {selectedRoomId === r.id
                              ? 'Selecionada'
                              : 'Selecionar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <button
                      onClick={confirmReservation}
                      className="px-3 py-2 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded"
                    >
                      Confirmar reserva
                    </button>
                  </div>
                </div>
              )}
              {searched && availableRooms.length === 0 && (
                <div className="mt-4 text-red-600">
                  Salas indisponíveis em{' '}
                  <strong>{formatDate(search.date)}</strong> às{' '}
                  <strong>{search.startTime}</strong>–
                  <strong>{search.endTime}</strong>.
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow md:col-span-1">
              <h2 className="font-bold mb-4 text-lg">Minhas reservas</h2>
              <ul>
                {reservations.map((r) => (
                  <li
                    key={r.id}
                    className="bg-white rounded-lg shadow-md p-4 mb-4"
                  >
                    {editingId === r.id ? (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-bold mb-2 text-[#044cf4]">
                          Editar Reserva
                        </h4>
                        <div className="mb-2">
                          <label className="block text-sm">Data</label>
                          <DatePicker
                            selected={
                              editForm.date
                                ? new Date(editForm.date + 'T00:00:00')
                                : null
                            }
                            onChange={(d) => {
                              if (!d) {
                                setEditForm({ ...editForm, date: '' });
                                return;
                              }
                              const iso = d.toISOString().slice(0, 10);
                              setError('');
                              setEditForm({ ...editForm, date: iso });
                            }}
                            minDate={minDate}
                            maxDate={maxDate}
                            filterDate={(d) => d.getDay() !== 0}
                            dateFormat="dd/MM/yyyy"
                            className="w-full p-3 border rounded mb-3"
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm">Início</label>
                          <select
                            value={editForm.startTime}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                startTime: e.target.value,
                              })
                            }
                            className="w-full p-3 border rounded mb-3"
                          >
                            <option value="">Selecione...</option>
                            {generateTimeOptions('07:00', '21:55').map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm">Fim</label>
                          <select
                            value={editForm.endTime}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                endTime: e.target.value,
                              })
                            }
                            className="w-full p-3 border rounded mb-3"
                          >
                            <option value="">Selecione...</option>
                            {generateTimeOptions('07:00', '21:55').map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm">Quantidade</label>
                          <select
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                quantity: e.target.value,
                              })
                            }
                            className="w-full p-3 border rounded mb-3"
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                        </div>
                        <div className="mb-2">
                          <label className="block text-sm">Motivo</label>
                          <select
                            value={editForm.reason}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                reason: e.target.value,
                              })
                            }
                            className="w-full p-3 border rounded mb-3"
                          >
                            <option value="Estudo individual">
                              Estudo individual
                            </option>
                            <option value="Estudo em grupo">
                              Estudo em grupo
                            </option>
                            <option value="Leitura">Leitura</option>
                            <option value="Clube do livro">
                              Clube do livro
                            </option>
                            <option value="Pesquisa acadêmica">
                              Pesquisa acadêmica
                            </option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 bg-[#044cf4] hover:bg-[#033bd0] text-white rounded"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 bg-gray-400 text-white rounded"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* ID da reserva */}
                        <div className="text-xs text-gray-500 mb-1">
                          ID:{' '}
                          <span className="font-mono font-semibold">
                            {String(r.id).padStart(5, '0')}
                          </span>
                        </div>
                        {/* Nome da sala */}
                        <h4 className="font-semibold text-[#044cf4] text-base mb-2">
                          {r.Room?.name}
                        </h4>

                        {/* Data e horário */}
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <circle cx="12" cy="12" r="9" />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 7v5l3 3"
                            />
                          </svg>
                          <span>
                            {formatDate(r.date)} • {r.startTime}–{r.endTime}
                          </span>
                        </div>

                        {/* Informações adicionais */}
                        <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-4 h-4 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                            <span>
                              {r.quantity}{' '}
                              {r.quantity > 1 ? 'pessoas' : 'pessoa'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-4 h-4 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                              />
                            </svg>
                            <span className="truncate">{r.reason}</span>
                          </div>
                        </div>

                        {/* Botões de ação */}
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEdit(r)}
                            className="px-3 py-1.5 text-xs font-medium border rounded bg-[#e6f0ff] hover:bg-[#d2e7ff] text-[#044cf4] transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => cancel(r.id)}
                            className="px-3 py-1.5 text-xs font-medium border rounded bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* reservation history */}
        <div className="mt-8 bg-white p-4 rounded-lg shadow">
          <h2 className="font-bold mb-4 text-lg">Histórico de Reservas</h2>

          {/* search bar (admin only) */}
          {user?.role === 'admin' && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Pesquise por ID, usuário, sala, motivo..."
                value={historySearchFilter}
                onChange={(e) => {
                  setHistorySearchFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#044cf4]"
              />
            </div>
          )}

          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Nenhuma reserva no histórico.
            </p>
          ) : (
            <div className="space-y-2 w-full">
              {history
                .filter((h) => {
                  if (!historySearchFilter) return true;
                  const searchLower = historySearchFilter.toLowerCase();
                  const id = String(h.id).padStart(5, '0');
                  const userName = h.User?.name || '';
                  const roomName = h.Room?.name || '';
                  const reason = h.reason || '';

                  return (
                    id.includes(searchLower) ||
                    userName.toLowerCase().includes(searchLower) ||
                    roomName.toLowerCase().includes(searchLower) ||
                    reason.toLowerCase().includes(searchLower)
                  );
                })
                .map((h) => (
                  <div
                    key={h.id}
                    className="bg-gray-50 rounded-lg p-3 opacity-75 border border-gray-200"
                  >
                    {/* id and status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-gray-500">
                        ID:{' '}
                        <span className="font-mono font-semibold">
                          {String(h.id).padStart(5, '0')}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          h.status === 'concluída'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-300 text-gray-700'
                        }`}
                      >
                        {h.status === 'concluída' ? 'Concluída' : 'Cancelada'}
                      </span>
                    </div>

                    {/* room name */}
                    <h4 className="font-semibold text-gray-800 mb-2">
                      {h.Room?.name || `Sala ${h.roomId}`}
                    </h4>

                    {/* info line: date and time */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-medium">
                        {formatDate(h.date)} • {h.startTime}–{h.endTime}
                      </span>
                    </div>

                    {/* info line: user, quantity and reason */}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-3 h-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span className="truncate max-w-xs">
                          {h.User?.name || 'Usuário'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-3 h-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <span>
                          {h.quantity} {h.quantity > 1 ? 'pessoas' : 'pessoa'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-3 h-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        <span className="truncate max-w-xs">{h.reason}</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* pagination */}
          {history.length > 0 && historyPagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                Página {historyPagination.page} de{' '}
                {historyPagination.totalPages}({historyPagination.total} reserva
                {historyPagination.total !== 1 ? 's' : ''})
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadHistoryPage(historyPagination.page - 1)}
                  disabled={historyPagination.page === 1}
                  className={`px-3 py-1 border rounded text-sm ${
                    historyPagination.page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                  }`}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => loadHistoryPage(historyPagination.page + 1)}
                  disabled={
                    historyPagination.page === historyPagination.totalPages
                  }
                  className={`px-3 py-1 border rounded text-sm ${
                    historyPagination.page === historyPagination.totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-[#044cf4] hover:bg-[#e6f0ff]'
                  }`}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
