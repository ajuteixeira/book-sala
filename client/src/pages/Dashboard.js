import React, { useEffect, useState } from 'react';
import axios from 'axios';

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
  const MIN_SPINNER_MS = 600;
  const getOpeningHours = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 0) return null; // Sunday closed
    if (dow === 6) return { open: '08:00', close: '13:55' }; // Saturday
    return { open: '07:00', close: '21:55' }; // Mon-Fri
  };
  const isSunday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay() === 0;
  };
  const todayObj = new Date();
  todayObj.setHours(0, 0, 0, 0);
  const yyyy = todayObj.getFullYear();
  const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
  const dd = String(todayObj.getDate()).padStart(2, '0');
  const todayISO = `${yyyy}-${mm}-${dd}`;
  const maxObj = new Date(todayObj);
  maxObj.setDate(maxObj.getDate() + 30);
  const maxYYYY = maxObj.getFullYear();
  const maxMM = String(maxObj.getMonth() + 1).padStart(2, '0');
  const maxDD = String(maxObj.getDate()).padStart(2, '0');
  const maxISO = `${maxYYYY}-${maxMM}-${maxDD}`;

  useEffect(() => {
    if (!token) return;
    axios
      .get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      })
      .then((r) => setReservations(r.data));
  }, []);

  const searchAvailable = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    // client-side validation: times
    const parseTimeToMinutes = (t) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length !== 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const startMin = parseTimeToMinutes(search.startTime);
    const endMin = parseTimeToMinutes(search.endTime);
    if (startMin === null || endMin === null) {
      setError('Preencha horários válidos');
      return;
    }
    if (startMin > endMin) {
      setError('Hora de término inválida');
      return;
    }
    if (endMin - startMin < 15) {
      setError('Tempo mínimo da reserva é 15 minutos');
      return;
    }

    const hours = getOpeningHours(search.date);
    if (!hours) {
      setError('Biblioteca fechada nesse dia. Selecione outra data.');
      return;
    }
    const openMin = parseTimeToMinutes(hours.open);
    const closeMin = parseTimeToMinutes(hours.close);
    if (startMin < openMin || endMin > closeMin) {
      setError(`Horário fora do funcionamento: ${hours.open}–${hours.close}`);
      return;
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
      setTimeout(() => {
        setError(err?.response?.data?.error || 'Erro ao buscar salas');
        setLoading(false);
      }, wait);
    }
  };

  const confirmReservation = async () => {
    if (!selectedRoomId) return setError('Selecione uma sala');
    // validate times before sending
    const parseTimeToMinutes = (t) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length !== 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const sMin = parseTimeToMinutes(search.startTime);
    const eMin = parseTimeToMinutes(search.endTime);
    if (sMin === null || eMin === null)
      return setError('Preencha horários válidos');
    if (sMin > eMin) return setError('Hora de término inválida');
    if (eMin - sMin < 15)
      return setError('Tempo mínimo da reserva é 15 minutos');

    const hours = getOpeningHours(search.date);
    if (!hours)
      return setError('Biblioteca fechada nesse dia. Selecione outra data.');
    const openMin = parseTimeToMinutes(hours.open);
    const closeMin = parseTimeToMinutes(hours.close);
    if (sMin < openMin || eMin > closeMin)
      return setError(
        `Horário fora do funcionamento: ${hours.open}–${hours.close}`
      );

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
      const r = await axios.get(API + '/reservations', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setReservations(r.data);
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
    // validate times before sending edit
    const parseTimeToMinutes = (t) => {
      if (!t) return null;
      const parts = t.split(':');
      if (parts.length !== 2) return null;
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };
    const sMin = parseTimeToMinutes(editForm.startTime);
    const eMin = parseTimeToMinutes(editForm.endTime);
    if (sMin === null || eMin === null)
      return setError('Preencha horários válidos');
    if (sMin > eMin) return setError('Hora de término inválida');
    if (eMin - sMin < 15)
      return setError('Tempo mínimo da reserva é 15 minutos');

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

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">BookSala</h1>
        <div>
          <span className="mr-4">
            Olá, {user?.matricula} ({user?.role})
          </span>
          <button onClick={logout} className="px-3 py-1 border rounded">
            Sair
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">Nova Reserva</h2>
          {error && <div className="text-red-600 mb-2">{error}</div>}

          {user?.role !== 'admin' && reservations.length >= 3 && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
              <p className="font-bold">Limite de 3 reservas atingido</p>
            </div>
          )}

          <form
            onSubmit={searchAvailable}
            disabled={user?.role !== 'admin' && reservations.length >= 3}
          >
            <label className="block">Data</label>
            <input
              type="date"
              value={search.date}
              min={todayISO}
              max={maxISO}
              onChange={(e) => {
                const val = e.target.value;
                if (isSunday(val)) {
                  setError('Domingo fechado. Selecione outro dia.');
                  setSearch({ ...search, date: '' });
                  setSearched(false);
                  return;
                }
                setError('');
                setSearch({ ...search, date: val });
                setSearched(false);
              }}
              className="w-full p-2 border mb-2"
            />
            <label className="block">Início</label>
            <input
              type="time"
              value={search.startTime}
              onChange={(e) => {
                setSearch({ ...search, startTime: e.target.value });
                setSearched(false);
              }}
              className="w-full p-2 border mb-2"
            />
            <label className="block">Fim</label>
            <input
              type="time"
              value={search.endTime}
              onChange={(e) => {
                setSearch({ ...search, endTime: e.target.value });
                setSearched(false);
              }}
              className="w-full p-2 border mb-2"
            />
            <label className="block">Quantidade de pessoas</label>
            <select
              value={search.quantity}
              onChange={(e) => {
                setSearch({ ...search, quantity: e.target.value });
                setSearched(false);
              }}
              className="w-full p-2 border mb-2"
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
              className="w-full p-2 border mb-2"
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
                loading || (user?.role !== 'admin' && reservations.length >= 3)
              }
              className={`px-3 py-2 bg-blue-600 text-white rounded ${
                loading || (user?.role !== 'admin' && reservations.length >= 3)
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
              <h3 className="font-semibold mb-2">Salas disponíveis</h3>
              <ul>
                {availableRooms.map((r) => (
                  <li
                    key={r.id}
                    className="border-b py-2 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold">{r.name}</div>
                      <div className="text-sm">{r.description}</div>
                    </div>
                    <div>
                      <button
                        onClick={() => setSelectedRoomId(r.id)}
                        className={`px-3 py-1 border rounded ${
                          selectedRoomId === r.id
                            ? 'bg-green-500 text-white'
                            : ''
                        }`}
                      >
                        {selectedRoomId === r.id ? 'Selecionada' : 'Selecionar'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <button
                  onClick={confirmReservation}
                  className="px-3 py-2 bg-green-600 text-white rounded"
                >
                  Confirmar reserva
                </button>
              </div>
            </div>
          )}
          {searched && availableRooms.length === 0 && (
            <div className="mt-4 text-red-600">
              Salas indisponíveis em <strong>{formatDate(search.date)}</strong>{' '}
              às <strong>{search.startTime}</strong>–
              <strong>{search.endTime}</strong>.
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">
            {user?.role === 'admin' ? 'Todas as reservas' : 'Minhas reservas'}
          </h2>
          <ul>
            {reservations.map((r) => (
              <li key={r.id} className="border-b py-2">
                {editingId === r.id ? (
                  <div className="bg-gray-100 p-3 rounded">
                    <h4 className="font-bold mb-2">Editar Reserva</h4>
                    <div className="mb-2">
                      <label className="block text-sm">Data</label>
                      <input
                        type="date"
                        value={editForm.date}
                        min={todayISO}
                        max={maxISO}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isSunday(val)) {
                            setError('Domingo fechado. Selecione outro dia.');
                            setEditForm({ ...editForm, date: '' });
                            return;
                          }
                          setError('');
                          setEditForm({ ...editForm, date: val });
                        }}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm">Início</label>
                      <input
                        type="time"
                        value={editForm.startTime}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            startTime: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm">Fim</label>
                      <input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) =>
                          setEditForm({ ...editForm, endTime: e.target.value })
                        }
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm">Quantidade</label>
                      <select
                        value={editForm.quantity}
                        onChange={(e) =>
                          setEditForm({ ...editForm, quantity: e.target.value })
                        }
                        className="w-full p-2 border rounded"
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
                          setEditForm({ ...editForm, reason: e.target.value })
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="Estudo individual">
                          Estudo individual
                        </option>
                        <option value="Estudo em grupo">Estudo em grupo</option>
                        <option value="Leitura">Leitura</option>
                        <option value="Clube do livro">Clube do livro</option>
                        <option value="Pesquisa acadêmica">
                          Pesquisa acadêmica
                        </option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 bg-green-600 text-white rounded"
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
                  <>
                    <div>
                      <strong>{r.Room?.name}</strong> — {formatDate(r.date)}{' '}
                      {r.startTime}–{r.endTime}
                    </div>
                    <div>Usuário: {r.User?.matricula || '—'}</div>
                    <div className="text-sm">
                      Pessoas: {r.quantity} | Motivo: {r.reason}
                    </div>
                    <div className="mt-2 flex gap-2">
                      {(user?.role === 'admin' ||
                        r.User?.matricula === user?.matricula) && (
                        <>
                          <button
                            onClick={() => openEdit(r)}
                            className="px-2 py-1 border rounded bg-blue-100 hover:bg-blue-200"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => cancel(r.id)}
                            className="px-2 py-1 border rounded"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
