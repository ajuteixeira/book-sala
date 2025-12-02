import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Dashboard(){
  const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [form, setForm] = useState({roomId:'',date:'',startTime:'',endTime:''});
  const [error, setError] = useState('');

  useEffect(()=> {
    if (!token) return;
    axios.get(API + '/rooms', { headers: { Authorization: 'Bearer ' + token }}).then(r=>setRooms(r.data));
    axios.get(API + '/reservations', { headers: { Authorization: 'Bearer ' + token }}).then(r=>setReservations(r.data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await axios.post(API + '/reservations', form, { headers: { Authorization: 'Bearer ' + token }});
      const r = await axios.get(API + '/reservations', { headers: { Authorization: 'Bearer ' + token }});
      setReservations(r.data);
      setForm({roomId:'',date:'',startTime:'',endTime:''});
    } catch (err) {
      setError(err?.response?.data?.error || 'Erro');
    }
  };

  const cancel = async (id) => {
    if (!confirm('Confirmar cancelamento?')) return;
    await axios.delete(API + '/reservations/' + id, { headers: { Authorization: 'Bearer ' + token }});
    const r = await axios.get(API + '/reservations', { headers: { Authorization: 'Bearer ' + token }});
    setReservations(r.data);
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
          <span className="mr-4">Olá, {user?.matricula} ({user?.role})</span>
          <button onClick={logout} className="px-3 py-1 border rounded">Sair</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">Nova Reserva</h2>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <form onSubmit={submit}>
            <label className="block">Sala</label>
            <select value={form.roomId} onChange={e=>setForm({...form, roomId: e.target.value})} className="w-full p-2 border mb-2">
              <option value="">-- selecione --</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <label className="block">Data</label>
            <input type="date" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2 border mb-2"/>
            <label className="block">Início</label>
            <input type="time" value={form.startTime} onChange={e=>setForm({...form, startTime: e.target.value})} className="w-full p-2 border mb-2"/>
            <label className="block">Fim</label>
            <input type="time" value={form.endTime} onChange={e=>setForm({...form, endTime: e.target.value})} className="w-full p-2 border mb-2"/>
            <button className="px-3 py-2 bg-green-600 text-white rounded">Reservar</button>
          </form>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold mb-2">Minhas Reservas / Todas (se admin)</h2>
          <ul>
            {reservations.map(r => (
              <li key={r.id} className="border-b py-2">
                <div><strong>{r.Room?.name}</strong> — {r.date} {r.startTime}–{r.endTime}</div>
                <div>Usuário: {r.User?.matricula || '—'}</div>
                <div className="mt-2">
                  {(user?.role === 'admin' || r.User?.matricula === user?.matricula) && (
                    <button onClick={() => cancel(r.id)} className="px-2 py-1 border rounded">Cancelar</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
